import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

type Context = { params: Promise<{ customerId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: Record<string, 'suspend' | 'reactivate'> = {
  suspend: 'suspend',
  reactivate: 'reactivate',
};

// Proxy sécurisé : seul NestJS peut autoriser un compte ADMIN.
// Le statut du compte est modifié côté serveur ; le front n'envoie
// jamais de statut arbitraire, uniquement l'action demandée.
export async function PATCH(request: Request, context: Context) {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });

  const { customerId } = await context.params;
  if (!UUID.test(customerId)) {
    return NextResponse.json({ message: 'Invalid customer ID.' }, { status: 400 });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON body required.' }, { status: 415 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  }
  const action = ACTIONS[(body as Record<string, unknown>).action as string];
  if (!action) {
    return NextResponse.json({ message: 'Invalid account action.' }, { status: 400 });
  }

  try {
    const response = await fetch(buildApiUrl(`/admin/customers/${customerId}/${action}`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
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
    return NextResponse.json({ message: 'Unable to update the customer account.' }, { status: 502 });
  }
}
