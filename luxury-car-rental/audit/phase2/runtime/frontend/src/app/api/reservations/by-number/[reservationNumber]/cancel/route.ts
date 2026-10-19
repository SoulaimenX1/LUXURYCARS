import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// ==========================================================
// PATCH /api/reservations/by-number/:reservationNumber/cancel
// => PATCH /reservations/by-number/:reservationNumber/cancel
// ==========================================================

type RouteContext = {
  params: Promise<{ reservationNumber: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  // Rejeter les requêtes provenant d'un autre site.
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json(
          { message: 'Invalid request origin.' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: 'Invalid request origin.' },
        { status: 403 },
      );
    }
  }

  // Le paramètre dynamique est asynchrone avec Next.js 16.
  const { reservationNumber } = await context.params;
  if (!/^RES-\d{4}-\d{6}$/.test(reservationNumber)) {
    return NextResponse.json(
      { message: 'Invalid reservation number.' },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) {
    return NextResponse.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    // Aucun body nécessaire : NestJS récupère le client via le JWT.
    const backendResponse = await fetch(
      buildApiUrl(
        `/reservations/by-number/${encodeURIComponent(reservationNumber)}/cancel`,
      ),
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );

    const responseText = await backendResponse.text();
    if (!responseText) {
      return new NextResponse(null, { status: backendResponse.status });
    }

    try {
      const data: unknown = JSON.parse(responseText);
      return NextResponse.json(data, { status: backendResponse.status });
    } catch {
      return NextResponse.json(
        { message: 'Invalid response from reservation service.' },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { message: 'Unable to cancel the reservation.' },
      { status: 502 },
    );
  }
}
