import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

const REASONS = ['maintenance', 'repair', 'inspection', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Protection contre les appels intersites pour les actions administratives.
function trusted(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

// Créneaux de maintenance pour la grille administrative.
export async function GET(request: Request) {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ message: 'Invalid month' }, { status: 400 });
  }
  try {
    const response = await fetch(buildApiUrl(`/reservations/admin/unavailability?month=${month}`), {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const result: unknown = await response.json();
    return NextResponse.json(result, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'Unable to load maintenance periods.' }, { status: 502 });
  }
}

// Bloquer un véhicule (maintenance/réparation).
export async function POST(request: Request) {
  if (!trusted(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON body required.' }, { status: 415 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Invalid maintenance data.' }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const notes = data.notes;
  if (typeof data.vehicleId !== 'string' || !UUID.test(data.vehicleId) ||
      typeof data.startsAt !== 'string' || Number.isNaN(Date.parse(data.startsAt)) ||
      typeof data.endsAt !== 'string' || Number.isNaN(Date.parse(data.endsAt)) ||
      typeof data.reason !== 'string' || !REASONS.includes(data.reason) ||
      (notes !== undefined && (typeof notes !== 'string' || notes.length > 1000))) {
    return NextResponse.json({ message: 'Invalid maintenance data.' }, { status: 400 });
  }
  try {
    const response = await fetch(buildApiUrl('/reservations/admin/unavailability'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        vehicleId: data.vehicleId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        reason: data.reason,
        notes: typeof notes === 'string' ? notes : undefined,
      }),
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
  } catch {
    return NextResponse.json({ message: 'Unable to block vehicle.' }, { status: 502 });
  }
}
