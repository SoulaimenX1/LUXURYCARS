import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// Proxy sécurisé : seul NestJS peut autoriser un compte ADMIN.
export async function GET() {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await fetch(buildApiUrl('/admin/customers'), {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const result: unknown = await response.json();
    return NextResponse.json(result, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'Unable to load customers.' }, { status: 502 });
  }
}
