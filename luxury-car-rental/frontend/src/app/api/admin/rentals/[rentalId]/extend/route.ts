import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

type Context = { params: Promise<{ rentalId: string }> };

// Protection contre les appels intersites pour les actions administratives.
function trusted(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function POST(request: Request, context: Context) {
  if (!trusted(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  const { rentalId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rentalId)) {
    return NextResponse.json({ message: 'Invalid rental ID.' }, { status: 400 });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON body required.' }, { status: 415 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Invalid extension data.' }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  if (typeof data.newReturnDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.newReturnDate) ||
      (data.reason !== undefined && (typeof data.reason !== 'string' || data.reason.length > 500))) {
    return NextResponse.json({ message: 'Invalid extension date or reason.' }, { status: 400 });
  }
  try {
    const response = await fetch(buildApiUrl(`/rentals/admin/${rentalId}/extend`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ newReturnDate: data.newReturnDate, reason: data.reason }),
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
    return NextResponse.json({ message: 'Unable to extend rental.' }, { status: 502 });
  }
}
