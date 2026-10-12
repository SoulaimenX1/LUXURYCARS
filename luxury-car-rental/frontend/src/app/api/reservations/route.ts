import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// ==========================================================
// API NEXT.JS POUR LES RÉSERVATIONS
// GET  /api/reservations => GET  /reservations/me (NestJS)
// POST /api/reservations => POST /reservations    (NestJS)
// ==========================================================

interface CreateReservationBody {
  brandName: string;
  modelName: string;
  pickupDate: string;
  returnDate: string;
  customerNotes?: string;
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

// Vérifier une date réelle au format YYYY-MM-DD.
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
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
  const brandName = body.brandName;
  const modelName = body.modelName;
  const pickupDate = body.pickupDate;
  const returnDate = body.returnDate;
  const customerNotes = body.customerNotes;

  if (
    typeof brandName !== 'string' || !brandName.trim() ||
    typeof modelName !== 'string' || !modelName.trim() ||
    typeof pickupDate !== 'string' ||
    typeof returnDate !== 'string' ||
    !isValidDate(pickupDate) ||
    !isValidDate(returnDate) ||
    returnDate <= pickupDate ||
    (customerNotes !== undefined && typeof customerNotes !== 'string') ||
    (typeof customerNotes === 'string' && customerNotes.length > 1000)
  ) {
    return NextResponse.json(
      { message: 'Invalid reservation details or rental period.' },
      { status: 400 },
    );
  }

  // Ces champs sont exactement ceux du CreateReservationDto NestJS.
  const payload: CreateReservationBody = {
    brandName: brandName.trim(),
    modelName: modelName.trim(),
    pickupDate,
    returnDate,
  };
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
