import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// ==========================================================
// API NEXT.JS POUR LES RÉSERVATIONS
// GET  /api/reservations => GET  /reservations/me (NestJS)
// POST /api/reservations => POST /reservations    (NestJS)
// ==========================================================

interface CreateReservationBody {
  vehicleId: string;
  pickupDate?: string;
  returnDate?: string;
  pickupAt?: string;
  returnAt?: string;
  pickupLocationId?: string;
  dropoffLocationId?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  customerNotes?: string;
  extraIds?: string[];
  promotionCode?: string;
  pickupMethod?: 'branch'|'airport'|'hotel';
  deliveryAddress?: string;
  // Modes de service (additifs) : porte-à-porte validé par zone
  // + devis persisté revalidé côté NestJS.
  pickupServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
  dropoffServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
  pickupDoor?: unknown;
  dropoffDoor?: unknown;
  quoteId?: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Un instant ISO valide (date + heure), rejeté s'il n'est pas
// réversible (ex. 2026-02-31).
function isValidInstant(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

// Récupérer le JWT exclusivement côté serveur.
async function getToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

// Refuser un POST venant d'une autre origine (protection CSRF simple).
function hasInvalidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

// Lire les réponses du backend et conserver leur statut HTTP.
async function forwardResponse(response: Response): Promise<NextResponse> {
  const text = await response.text();
  if (!text) {
    return new NextResponse(null, { status: response.status });
  }
  try {
    const json: unknown = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: 'Unexpected response from reservation service.' },
      { status: 502 },
    );
  }
}

// ==========================================================
// CONSULTER LES RÉSERVATIONS DU CLIENT CONNECTÉ
// ==========================================================
export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const backendResponse = await fetch(buildApiUrl('/reservations/me'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return forwardResponse(backendResponse);
  } catch {
    return NextResponse.json(
      { message: 'Unable to load reservations.' },
      { status: 502 },
    );
  }
}

// ==========================================================
// CRÉER UNE RÉSERVATION
// ==========================================================
export async function POST(request: Request) {
  if (hasInvalidOrigin(request)) {
    return NextResponse.json(
      { message: 'Invalid request origin.' },
      { status: 403 },
    );
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json(
      { message: 'JSON body required.' },
      { status: 415 },
    );
  }

  // Ne jamais envoyer un body non validé directement à NestJS.
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return NextResponse.json({ message: 'Invalid reservation.' }, { status: 400 });
  }

  const body = input as Record<string, unknown>;
  const vehicleId = body.vehicleId;
  const pickupAt = body.pickupAt;
  const returnAt = body.returnAt;
  const pickupLocationId = body.pickupLocationId;
  const dropoffLocationId = body.dropoffLocationId;
  const pickupAddress = body.pickupAddress;
  const dropoffAddress = body.dropoffAddress;
  const customerNotes = body.customerNotes;
  const extraIds = body.extraIds;
  const promotionCode = body.promotionCode;
  const pickupMethod = body.pickupMethod;
  const deliveryAddress = body.deliveryAddress;
  const pickupServiceMode = body.pickupServiceMode;
  const dropoffServiceMode = body.dropoffServiceMode;
  const pickupDoor = body.pickupDoor;
  const dropoffDoor = body.dropoffDoor;
  const quoteId = body.quoteId;

  const validMode = (value: unknown) =>
    value === undefined || value === 'APPROVED_POINT' || value === 'DOOR_TO_DOOR';
  const validDoor = (value: unknown) =>
    value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value));

  const invalidCommon =
    (customerNotes !== undefined && typeof customerNotes !== 'string') ||
    (typeof customerNotes === 'string' && customerNotes.length > 1000) ||
    (extraIds !== undefined && (!Array.isArray(extraIds) || extraIds.length > 10 || !extraIds.every(v => typeof v === 'string' && UUID.test(v)))) ||
    (promotionCode !== undefined && (typeof promotionCode !== 'string' || !/^[A-Z0-9_-]{3,30}$/.test(promotionCode))) ||
    (pickupMethod !== undefined && !['branch','airport','hotel'].includes(String(pickupMethod))) ||
    (deliveryAddress !== undefined && (typeof deliveryAddress !== 'string' || deliveryAddress.length > 250)) ||
    (pickupLocationId !== undefined && (typeof pickupLocationId !== 'string' || !UUID.test(pickupLocationId))) ||
    (dropoffLocationId !== undefined && (typeof dropoffLocationId !== 'string' || !UUID.test(dropoffLocationId))) ||
    (pickupAddress !== undefined && (typeof pickupAddress !== 'string' || pickupAddress.length > 250)) ||
    (dropoffAddress !== undefined && (typeof dropoffAddress !== 'string' || dropoffAddress.length > 250)) ||
    !validMode(pickupServiceMode) ||
    !validMode(dropoffServiceMode) ||
    !validDoor(pickupDoor) ||
    !validDoor(dropoffDoor) ||
    (quoteId !== undefined && (typeof quoteId !== 'string' || !UUID.test(quoteId)));

  // Le contrat autoritaire exige des instants precis (date + heure).
  const invalidPeriod =
    typeof pickupAt !== 'string' || typeof returnAt !== 'string' ||
    !isValidInstant(pickupAt) || !isValidInstant(returnAt) ||
    new Date(returnAt).getTime() <= new Date(pickupAt).getTime();

  if (
    typeof vehicleId !== 'string' ||
    !UUID.test(vehicleId) ||
    invalidCommon ||
    invalidPeriod
  ) {
    return NextResponse.json(
      { message: 'Invalid reservation details or rental period.' },
      { status: 400 },
    );
  }

  // Ces champs sont exactement ceux du CreateReservationDto NestJS.
  const payload: CreateReservationBody = {
    vehicleId,
    pickupAt: pickupAt as string,
    returnAt: returnAt as string,
  };
  if (typeof pickupLocationId === 'string') payload.pickupLocationId = pickupLocationId;
  if (typeof dropoffLocationId === 'string') payload.dropoffLocationId = dropoffLocationId;
  if (typeof pickupAddress === 'string') payload.pickupAddress = pickupAddress;
  if (typeof dropoffAddress === 'string') payload.dropoffAddress = dropoffAddress;
  if (Array.isArray(extraIds)) payload.extraIds = extraIds as string[];
  if (typeof promotionCode === 'string') payload.promotionCode = promotionCode;
  if (pickupMethod === 'branch' || pickupMethod === 'airport' || pickupMethod === 'hotel') payload.pickupMethod = pickupMethod;
  if (typeof deliveryAddress === 'string') payload.deliveryAddress = deliveryAddress;
  if (pickupServiceMode === 'APPROVED_POINT' || pickupServiceMode === 'DOOR_TO_DOOR') {
    payload.pickupServiceMode = pickupServiceMode;
  }
  if (dropoffServiceMode === 'APPROVED_POINT' || dropoffServiceMode === 'DOOR_TO_DOOR') {
    payload.dropoffServiceMode = dropoffServiceMode;
  }
  if (pickupDoor !== undefined) payload.pickupDoor = pickupDoor;
  if (dropoffDoor !== undefined) payload.dropoffDoor = dropoffDoor;
  if (typeof quoteId === 'string') payload.quoteId = quoteId;
  if (typeof customerNotes === 'string' && customerNotes.trim()) {
    payload.customerNotes = customerNotes.trim();
  }

  try {
    const backendResponse = await fetch(buildApiUrl('/reservations'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    // Le backend décide de la disponibilité et du prix final.
    return forwardResponse(backendResponse);
  } catch {
    return NextResponse.json(
      { message: 'Reservation service is currently unavailable.' },
      { status: 502 },
    );
  }
}
