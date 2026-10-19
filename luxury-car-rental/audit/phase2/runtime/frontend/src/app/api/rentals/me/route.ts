import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// Transmettre la session côté serveur, sans exposer le JWT au navigateur.
export async function GET() {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const response = await fetch(buildApiUrl('/rentals/me'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data: unknown = await response.json();
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load your rentals.' }, { status: 502 });
  }
}
