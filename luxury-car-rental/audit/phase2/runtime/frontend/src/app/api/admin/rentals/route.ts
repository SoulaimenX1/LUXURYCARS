import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// Le JWT reste dans le cookie HttpOnly, jamais dans le navigateur.
async function token() {
  return (await cookies()).get('access_token')?.value;
}

async function forward(response: Response) {
  const text = await response.text();
  if (!text) return new NextResponse(null, { status: response.status });
  try {
    const data: unknown = JSON.parse(text);
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ message: 'Invalid backend response.' }, { status: 502 });
  }
}

// Obtenir les locations de l'entreprise.
export async function GET() {
  const accessToken = await token();
  if (!accessToken) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await fetch(buildApiUrl('/rentals/admin'), {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
    });
    return forward(response);
  } catch {
    return NextResponse.json({ message: 'Unable to load rentals.' }, { status: 502 });
  }
}

// Vérifier que l'action provient bien du site actuel.
function isTrustedRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

// Démarrer une location depuis une réservation confirmée.
export async function POST(request: Request) {
  if (!isTrustedRequest(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const accessToken = await token();
  if (!accessToken) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON body required.' }, { status: 415 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Invalid rental data.' }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  if (typeof data.reservationNumber !== 'string' ||
      !/^RES-\d{4}-\d{6}$/.test(data.reservationNumber) ||
      typeof data.mileageKm !== 'number' || !Number.isInteger(data.mileageKm) || data.mileageKm < 0 ||
      typeof data.fuelLevelPct !== 'number' || !Number.isInteger(data.fuelLevelPct) ||
      data.fuelLevelPct < 0 || data.fuelLevelPct > 100 ||
      !['excellent', 'good', 'fair', 'damaged'].includes(String(data.overallCondition)) ||
      (data.notes !== undefined && (typeof data.notes !== 'string' || data.notes.length > 1000))) {
    return NextResponse.json({ message: 'Invalid vehicle handover information.' }, { status: 400 });
  }
  try {
    const response = await fetch(buildApiUrl('/rentals/admin/start'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store',
    });
    return forward(response);
  } catch {
    return NextResponse.json({ message: 'Unable to start rental.' }, { status: 502 });
  }
}
