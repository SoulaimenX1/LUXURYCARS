import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// ==========================================================
// POST /api/delivery/quotes
// ==========================================================
//
// Devis de livraison PERSISTÉ côté NestJS (validité limitée,
// prix entièrement serveur, révalidé à la réservation).
// Authentification requise : le JWT est lu dans le cookie
// HttpOnly côté serveur, jamais exposé au navigateur.

function hasInvalidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

async function getToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

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
      { message: 'Unexpected response from the quote service.' },
      { status: 502 },
    );
  }
}

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
    return NextResponse.json({ message: 'JSON body required.' }, { status: 415 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return NextResponse.json({ message: 'Invalid quote request.' }, { status: 400 });
  }

  try {
    // Le backend NestJS valide et calcule tout (le DTO interdit
    // tout montant envoyé par le navigateur).
    const backendResponse = await fetch(buildApiUrl('/delivery/quotes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
    return forwardResponse(backendResponse);
  } catch {
    return NextResponse.json(
      { message: 'Quote service is currently unavailable.' },
      { status: 502 },
    );
  }
}
