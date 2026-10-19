import { buildApiUrl } from '@/lib/api';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Context = { params: Promise<{ reservationNumber: string }> };

const RESERVATION_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vérifie l'origine de la requête (protection CSRF simple).
function originRejected(request: Request): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return true;
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return true;
    } catch {
      return true;
    }
  }
  return false;
}

// Valide et normalise le corps de la demande de modification.
async function parseEdit(
  request: Request,
): Promise<{ payload?: Record<string, unknown>; response?: NextResponse }> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return { response: NextResponse.json({ message: 'JSON body required.' }, { status: 415 }) };
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return { response: NextResponse.json({ message: 'Invalid JSON request.' }, { status: 400 }) }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { response: NextResponse.json({ message: 'Invalid modification data.' }, { status: 400 }) };
  }

  const data = body as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  for (const field of ['vehicleId', 'pickupLocationId', 'dropoffLocationId'] as const) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== 'string' || !UUID.test(data[field] as string)) {
        return { response: NextResponse.json({ message: `Invalid ${field}.` }, { status: 400 }) };
      }
      payload[field] = data[field];
    }
  }
  for (const field of ['pickupAt', 'returnAt'] as const) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== 'string' || Number.isNaN(Date.parse(data[field] as string))) {
        return { response: NextResponse.json({ message: `Invalid ${field}.` }, { status: 400 }) };
      }
      payload[field] = data[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    return { response: NextResponse.json({ message: 'No modification supplied.' }, { status: 400 }) };
  }
  return { payload };
}

// Relaie la requête vers NestJS et renvoie sa réponse telle quelle.
async function forward(
  endpoint: string,
  method: 'PATCH' | 'POST',
  token: string,
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!text) return new NextResponse(null, { status: response.status });
    try {
      return NextResponse.json(JSON.parse(text) as unknown, {
        status: response.status, headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return NextResponse.json({ message: 'Invalid backend response.' }, { status: 502 });
    }
  } catch (error) {
    console.error('[admin/reservations] edit proxy failed:', error);
    return NextResponse.json(
      { message: 'The reservation service is temporarily unavailable. Please try again in a moment.' },
      { status: 502 },
    );
  }
}

// PATCH : applique réellement la modification.
export async function PATCH(request: Request, context: Context) {
  if (originRejected(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });

  const { reservationNumber } = await context.params;
  if (!RESERVATION_NUMBER_PATTERN.test(reservationNumber)) {
    return NextResponse.json({ message: 'Invalid reservation number.' }, { status: 400 });
  }

  const parsed = await parseEdit(request);
  if (parsed.response) return parsed.response;

  return forward(
    `/reservations/admin/by-number/${encodeURIComponent(reservationNumber)}/edit`,
    'PATCH',
    token,
    parsed.payload as Record<string, unknown>,
  );
}

// POST : prévisualisation (disponibilité + écart de prix), sans écriture.
export async function POST(request: Request, context: Context) {
  if (originRejected(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });

  const { reservationNumber } = await context.params;
  if (!RESERVATION_NUMBER_PATTERN.test(reservationNumber)) {
    return NextResponse.json({ message: 'Invalid reservation number.' }, { status: 400 });
  }

  const parsed = await parseEdit(request);
  if (parsed.response) return parsed.response;

  return forward(
    `/reservations/admin/by-number/${encodeURIComponent(reservationNumber)}/edit/preview`,
    'POST',
    token,
    parsed.payload as Record<string, unknown>,
  );
}
