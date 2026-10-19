import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// ==========================================================
// Affectations véhicule <-> point de service
// GET  /api/admin/locations/:locationId/vehicles  => { vehicleIds }
// POST /api/admin/locations/:locationId/vehicles  => { vehicleIds }
// ==========================================================
//
// Le navigateur ne transmet jamais d'identifiant non vérifié :
// le body est reconstruit après contrôle des UUID.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ locationId: string }> };

function originRejected(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

async function token(): Promise<string | null> {
  return (await cookies()).get('access_token')?.value ?? null;
}

export async function GET(request: Request, context: Context) {
  const { locationId } = await context.params;
  if (!UUID.test(locationId)) {
    return NextResponse.json({ message: 'Invalid location.' }, { status: 400 });
  }

  const accessToken = await token();
  if (!accessToken) {
    return NextResponse.json(
      { message: 'Authentication required' },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(
      buildApiUrl(`/locations/admin/${locationId}/vehicles`),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      },
    );
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json(
      { message: 'Assignments unavailable' },
      { status: 502 },
    );
  }
}

export async function POST(request: Request, context: Context) {
  const { locationId } = await context.params;
  if (!UUID.test(locationId)) {
    return NextResponse.json({ message: 'Invalid location.' }, { status: 400 });
  }
  if (originRejected(request)) {
    return NextResponse.json({ message: 'Origin rejected' }, { status: 403 });
  }

  const accessToken = await token();
  if (!accessToken) {
    return NextResponse.json(
      { message: 'Authentication required' },
      { status: 401 },
    );
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON required' }, { status: 415 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }

  const raw =
    typeof input === 'object' && input !== null
      ? (input as { vehicleIds?: unknown }).vehicleIds
      : undefined;

  if (!Array.isArray(raw) || raw.length > 500) {
    return NextResponse.json({ message: 'Invalid vehicle list.' }, { status: 400 });
  }
  if (raw.some((value) => typeof value !== 'string' || !UUID.test(value))) {
    return NextResponse.json({ message: 'Invalid vehicle list.' }, { status: 400 });
  }

  const payload = JSON.stringify({
    vehicleIds: Array.from(new Set(raw.map((value) => String(value).toLowerCase()))),
  });

  try {
    const response = await fetch(
      buildApiUrl(`/locations/admin/${locationId}/vehicles`),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
        cache: 'no-store',
      },
    );
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json(
      { message: 'Assignments unavailable' },
      { status: 502 },
    );
  }
}
