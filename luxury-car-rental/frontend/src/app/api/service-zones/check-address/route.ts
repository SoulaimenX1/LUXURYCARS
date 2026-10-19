import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// POST /api/service-zones/check-address
// ==========================================================
//
// Vérification PUBLIQUE d'une adresse client : zone de service
// active, ville desservie, fuseau et horaires. Aucun montant,
// aucune donnée persistée, aucun service de géocodage payant.

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
  const { countryCode, city } = body;

  if (
    typeof countryCode !== 'string' ||
    !/^[A-Za-z]{2}$/.test(countryCode) ||
    (city !== undefined && (typeof city !== 'string' || city.length > 100))
  ) {
    return NextResponse.json(
      { message: 'countryCode (ISO 2 letters) and an optional city are required.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(buildApiUrl('/service-zones/check-address'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: countryCode.toUpperCase(),
        ...(typeof city === 'string' ? { city } : {}),
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
      { message: 'Address verification is currently unavailable.' },
      { status: 502 },
    );
  }
}
