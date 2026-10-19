import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// POST /api/availability/alternatives
// ==========================================================
//
// Quand le véhicule choisi est indisponible sur l'intervalle
// demandé, NestJS/PostgreSQL calcule :
//   * la prochaine période réellement disponible pour CE
//     véhicule (même durée) ;
//   * des véhicules réellement disponibles sur l'intervalle.
//
// Aucune date ni aucun véhicule n'est inventé : tout provient
// de la base. Le véhicule sélectionné n'est jamais remplacé
// automatiquement.

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

  if (
    typeof vehicleId !== 'string' ||
    !UUID.test(vehicleId) ||
    typeof pickupLocationId !== 'string' ||
    !UUID.test(pickupLocationId) ||
    typeof pickupAt !== 'string' ||
    typeof returnAt !== 'string'
  ) {
    return NextResponse.json(
      { message: 'vehicleId, pickupLocationId, pickupAt and returnAt are required.' },
      { status: 400 },
    );
  }

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
    const response = await fetch(buildApiUrl('/availability/alternatives'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId,
        pickupLocationId,
        pickupAt,
        returnAt,
        ...(typeof dropoffLocationId === 'string' ? { dropoffLocationId } : {}),
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
