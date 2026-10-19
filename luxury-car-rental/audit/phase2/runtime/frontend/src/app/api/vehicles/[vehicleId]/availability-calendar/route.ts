import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// GET /api/vehicles/:vehicleId/availability-calendar
//   ?locationId=<uuid>&month=YYYY-MM
// ==========================================================
//
// Calendrier de disponibilité RÉEL : chaque jour est calculé à
// partir des réservations, locations actives, indisponibilités
// et horaires du point de service. Rien n'est simulé.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await context.params;
  const url = new URL(request.url);
  const locationId = url.searchParams.get('locationId') ?? '';
  const month = url.searchParams.get('month') ?? '';

  if (!UUID.test(vehicleId)) {
    return NextResponse.json(
      { message: 'Invalid vehicle identifier.' },
      { status: 400 },
    );
  }
  if (!UUID.test(locationId) || !MONTH.test(month)) {
    return NextResponse.json(
      { message: 'locationId and month (YYYY-MM) are required.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      buildApiUrl(
        `/vehicles/${vehicleId}/availability-calendar?locationId=${locationId}&month=${month}`,
      ),
      { cache: 'no-store' },
    );
    const payload: unknown = await response.json();

    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { message: 'Availability service unavailable.' },
      { status: 502 },
    );
  }
}
