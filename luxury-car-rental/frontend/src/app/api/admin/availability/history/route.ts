import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// Historique des blocs de maintenance libérés (journal d'audit F-05).
// Lecture réservée aux administrateurs authentifiés.
export async function GET(request: Request) {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  const month = new URL(request.url).searchParams.get('month') ?? '';
  const query = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? `?month=${month}` : '';
  try {
    const response = await fetch(buildApiUrl(`/reservations/admin/unavailability/history${query}`), {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const result: unknown = await response.json();
    return NextResponse.json(result, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'Unable to load maintenance history.' }, { status: 502 });
  }
}
