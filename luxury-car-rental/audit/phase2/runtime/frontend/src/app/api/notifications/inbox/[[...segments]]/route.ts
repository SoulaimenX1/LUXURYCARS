import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

type Context = { params: Promise<{ segments?: string[] }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

function route(segments: string[], method: 'GET' | 'PATCH'): boolean {
  if (method === 'GET') return segments.length === 0 || (segments.length === 1 && ['unread-count','preferences','stream'].includes(segments[0]));
  if (segments.length === 1 && ['read-all','preferences'].includes(segments[0])) return true;
  return segments.length === 2 && uuid.test(segments[0]) && ['read','archive'].includes(segments[1]);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

async function forward(request: Request, context: Context, method: 'GET' | 'PATCH') {
  const segments = (await context.params).segments ?? [];
  if (!route(segments, method)) return NextResponse.json({ message: 'Unknown notification route' }, { status: 404 });
  if (method === 'PATCH' && !sameOrigin(request)) return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  const destination = new URL(buildApiUrl(`/notifications/inbox${segments.length ? '/' + segments.join('/') : ''}`));
  // Flux temps réel (Server-Sent Events) : la réponse est un corps
  // en flux, transmis tel quel. `no-transform` + `X-Accel-Buffering`
  // empêchent toute mise en tampon qui retarderait les notifications.
  if (method === 'GET' && segments.length === 1 && segments[0] === 'stream') {
    try {
      const upstream = await fetch(destination, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
      });
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { message: 'Notification stream unavailable' },
          { status: upstream.ok ? 502 : upstream.status },
        );
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch {
      return NextResponse.json({ message: 'Notification service unavailable' }, { status: 502 });
    }
  }
  if (method === 'GET') {
    const incoming = new URL(request.url);
    for (const key of ['category', 'unread', 'page']) {
      const value = incoming.searchParams.get(key);
      if (value !== null) destination.searchParams.set(key, value);
    }
  }
  let body: string | undefined;
  if (method === 'PATCH' && segments[0] === 'preferences') {
    if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ message: 'JSON required' }, { status: 415 });
    try {
      const data: unknown = await request.json();
      const fields = ['bookingUpdates','rentalReminders','fleetNews','emailEnabled'];
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
        Object.keys(data).some(k => !fields.includes(k)) || fields.some(k => typeof (data as Record<string, unknown>)[k] !== 'boolean')) {
        return NextResponse.json({ message: 'Invalid preferences' }, { status: 400 });
      }
      body = JSON.stringify(data);
    } catch { return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 }); }
  }
  try {
    const result = await fetch(destination, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
      cache: 'no-store',
    });
    const json: unknown = await result.json();
    return NextResponse.json(json, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ message: 'Notification service unavailable' }, { status: 502 }); }
}

export async function GET(req: Request, ctx: Context) { return forward(req, ctx, 'GET'); }
export async function PATCH(req: Request, ctx: Context) { return forward(req, ctx, 'PATCH'); }
