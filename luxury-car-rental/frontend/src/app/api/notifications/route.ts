import { buildApiUrl } from '@/lib/api';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ==========================================================
// GET /api/notifications
// ==========================================================
//
// Récupère le flux de notifications depuis NestJS.
//
// Frontend : localhost:3000/api/notifications
// Backend  : localhost:3001/notifications
//
// Le flux est réservé aux utilisateurs connectés : le JWT
// reste dans le cookie HttpOnly et est transmis au backend.
// ==========================================================

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    return NextResponse.json(
      {
        message: 'Authentication required.',
      },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(
      buildApiUrl('/notifications'),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    );

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          message:
            'Invalid response from the notification service.',
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(data, {
        status: response.status,
      });
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { message: 'Invalid notification format.' },
        { status: 502 },
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      {
        message: 'Notification service unavailable.',
      },
      { status: 502 },
    );
  }
}
