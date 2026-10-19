import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

type Context = { params: Promise<{ blockId: string }> };

const REASONS = ['maintenance', 'repair', 'inspection', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Protection contre les appels intersites pour les actions administratives.
function trusted(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

// Modifier un bloc de maintenance existant.
export async function PATCH(request: Request, context: Context) {
  if (!trusted(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  const { blockId } = await context.params;
  if (!UUID.test(blockId)) {
    return NextResponse.json({ message: 'Invalid block ID.' }, { status: 400 });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ message: 'JSON body required.' }, { status: 415 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ message: 'Invalid maintenance data.' }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  if (data.startsAt !== undefined) {
    if (typeof data.startsAt !== 'string' || Number.isNaN(Date.parse(data.startsAt))) {
      return NextResponse.json({ message: 'Invalid start date.' }, { status: 400 });
    }
    payload.startsAt = data.startsAt;
  }
  if (data.endsAt !== undefined) {
    if (typeof data.endsAt !== 'string' || Number.isNaN(Date.parse(data.endsAt))) {
      return NextResponse.json({ message: 'Invalid end date.' }, { status: 400 });
    }
    payload.endsAt = data.endsAt;
  }
  if (data.reason !== undefined) {
    if (typeof data.reason !== 'string' || !REASONS.includes(data.reason)) {
      return NextResponse.json({ message: 'Invalid reason.' }, { status: 400 });
    }
    payload.reason = data.reason;
  }
  if (data.notes !== undefined) {
    if (typeof data.notes !== 'string' || data.notes.length > 1000) {
      return NextResponse.json({ message: 'Invalid notes.' }, { status: 400 });
    }
    payload.notes = data.notes;
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ message: 'No changes supplied.' }, { status: 400 });
  }
  try {
    const response = await fetch(buildApiUrl(`/reservations/admin/unavailability/${blockId}`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
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
    return NextResponse.json({ message: 'Unable to update maintenance block.' }, { status: 502 });
  }
}

// Libérer un bloc de maintenance.
// Le motif de libération est FACULTATIF : il alimente l'historique
// d'audit côté backend sans modifier la réservation ni les paiements.
export async function DELETE(request: Request, context: Context) {
  if (!trusted(request)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  const { blockId } = await context.params;
  if (!UUID.test(blockId)) {
    return NextResponse.json({ message: 'Invalid block ID.' }, { status: 400 });
  }

  // Corps facultatif : { reason?: string }.
  let releaseReason: string | undefined;
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body: unknown = await request.json();
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const reason = (body as Record<string, unknown>).reason;
        if (reason !== undefined) {
          if (typeof reason !== 'string' || reason.length > 500) {
            return NextResponse.json({ message: 'Invalid release reason.' }, { status: 400 });
          }
          const trimmed = reason.trim();
          if (trimmed) releaseReason = trimmed;
        }
      }
    } catch {
      return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
    }
  }

  try {
    const response = await fetch(buildApiUrl(`/reservations/admin/unavailability/${blockId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(releaseReason ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
      ...(releaseReason ? { body: JSON.stringify({ reason: releaseReason }) } : {}),
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
    return NextResponse.json({ message: 'Unable to release maintenance block.' }, { status: 502 });
  }
}
