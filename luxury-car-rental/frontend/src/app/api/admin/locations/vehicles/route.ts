import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// ==========================================================
// GET /api/admin/locations/vehicles
// Liste réelle des véhicules affectables à un point de service.
// Réservée à l'administration (le backend exige le rôle).
// ==========================================================

export async function GET() {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) {
    return NextResponse.json(
      { message: 'Authentication required' },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(buildApiUrl('/locations/admin/vehicles'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ message: 'Vehicles unavailable' }, { status: 502 });
  }
}
