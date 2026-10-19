import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// POST /api/availability/check
// ==========================================================
//
// Revalide l'intervalle complet (véhicule + lieu + horaires +
// durée + conflits) avant toute écriture. Le backend NestJS est
// la seule source de vérité : le calendrier n'est qu'indicatif.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasInvalidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

export async function POST(request: Request) {
  if (hasInvalidOrigin(request)) {
    return NextResponse.json(
      { message: 'Invalid request origin.' },
      { status: 403 },
    );
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON required.' }, { status: 415 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }

  const body = (input ?? {}) as Record<string, unknown>;
  const { vehicleId, pickupLocationId, pickupAt, returnAt, dropoffLocationId } = body;
  const pickupServiceMode = body.pickupServiceMode;
  const dropoffServiceMode = body.dropoffServiceMode;
  const pickupDoor = body.pickupDoor;
  const dropoffDoor = body.dropoffDoor;

  const validMode = (value: unknown) =>
    value === undefined || value === 'APPROVED_POINT' || value === 'DOOR_TO_DOOR';
  // La forme complète de l'adresse est validée par NestJS ; on
  // vérifie seulement que c'est bien un objet (jamais un tableau).
  const validDoor = (value: unknown) =>
    value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value));

  // Un lieu de prise en charge reste obligatoire sauf pour une
  // collecte porte-à-porte (validée par zone côté backend).
  const needsPickupPoint = pickupServiceMode !== 'DOOR_TO_DOOR';

  if (
    typeof vehicleId !== 'string' ||
    !UUID.test(vehicleId) ||
    typeof pickupAt !== 'string' ||
    typeof returnAt !== 'string' ||
    (needsPickupPoint &&
      (typeof pickupLocationId !== 'string' || !UUID.test(pickupLocationId))) ||
    (!needsPickupPoint &&
      pickupLocationId !== undefined &&
      (typeof pickupLocationId !== 'string' || !UUID.test(pickupLocationId))) ||
    !validMode(pickupServiceMode) ||
    !validMode(dropoffServiceMode) ||
    !validDoor(pickupDoor) ||
    !validDoor(dropoffDoor)
  ) {
    return NextResponse.json(
      {
        message:
          'vehicleId, pickupAt, returnAt and a pickup point (or door mode) are required.',
      },
      { status: 400 },
    );
  }

  // Le lieu de restitution (s'il diffère) doit aussi être validé :
  // politique même pays et compatibilité véhicule/lieu.
  if (
    dropoffLocationId !== undefined &&
    (typeof dropoffLocationId !== 'string' || !UUID.test(dropoffLocationId))
  ) {
    return NextResponse.json(
      { message: 'dropoffLocationId must be a valid identifier.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(buildApiUrl('/availability/check'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId,
        pickupLocationId,
        pickupAt,
        returnAt,
        ...(typeof dropoffLocationId === 'string' ? { dropoffLocationId } : {}),
        ...(typeof pickupServiceMode === 'string' ? { pickupServiceMode } : {}),
        ...(typeof dropoffServiceMode === 'string' ? { dropoffServiceMode } : {}),
        ...(pickupDoor ? { pickupDoor } : {}),
        ...(dropoffDoor ? { dropoffDoor } : {}),
      }),
      cache: 'no-store',
    });
    const payload: unknown = await response.json();

    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { message: 'Availability service unavailable.' },
      { status: 502 },
    );
  }
}
