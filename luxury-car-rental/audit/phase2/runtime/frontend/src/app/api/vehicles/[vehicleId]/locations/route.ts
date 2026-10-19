import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// GET /api/vehicles/:vehicleId/locations
// ==========================================================
//
// Lieux de prise en charge RÉELS (PostgreSQL) pour ce véhicule.
// Aucune branche n'est codée en dur côté frontend : la liste
// dépend du pays, des horaires et des affectations du véhicule.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await context.params;

  if (!UUID.test(vehicleId)) {
    return NextResponse.json(
      { message: 'Invalid vehicle identifier.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      buildApiUrl(`/vehicles/${vehicleId}/locations`),
      { cache: 'no-store' },
    );
    const payload: unknown = await response.json();

    return NextResponse.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { message: 'Pickup location service unavailable.' },
      { status: 502 },
    );
  }
}
