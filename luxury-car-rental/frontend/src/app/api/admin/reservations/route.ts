
import { buildApiUrl } from '@/lib/api';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ==========================================================
// TYPES
// ==========================================================

type AdminAction = 'confirm' | 'reject';

interface DecisionBody {
    reservationNumber: string;
    action: AdminAction;
    reason?: string;
}

// ==========================================================
// RÉCUPÉRER LE JWT HTTPONLY
// ==========================================================

async function getToken(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get('access_token')?.value;
}

// ==========================================================
// TRANSMETTRE LA RÉPONSE DU BACKEND
// ==========================================================

async function forwardResponse(response: Response) {
    const text = await response.text();

    if (!text) {
        return new NextResponse(null, {
            status: response.status,
        });
    }

    try {
        const data: unknown = JSON.parse(text);

        return NextResponse.json(data, {
            status: response.status,
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch {
        return NextResponse.json(
            { message: 'Invalid response from backend.' },
            { status: 502 },
        );
    }
}

// ==========================================================
// GET /api/admin/reservations
// ==========================================================
//
// Appelle NestJS :
//
// GET /reservations/admin/pending
//
// NestJS vérifie automatiquement le rôle ADMIN.
// ==========================================================

export async function GET() {
    const token = await getToken();

    if (!token) {
        return NextResponse.json(
            { message: 'Authentication required.' },
            { status: 401 },
        );
    }

    try {
        const response = await fetch(
            buildApiUrl('/reservations/admin/pending'),
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: 'no-store',
            },
        );

        return forwardResponse(response);
    } catch {
        return NextResponse.json(
            { message: 'Unable to load pending reservations.' },
            { status: 502 },
        );
    }
}

// ==========================================================
// PATCH /api/admin/reservations
// ==========================================================
//
// Body envoyé par le frontend :
//
// {
//   "reservationNumber": "RES-2026-000008",
//   "action": "confirm"
// }
//
// OU :
//
// {
//   "reservationNumber": "RES-2026-000008",
//   "action": "reject",
//   "reason": "Driving licence expires before the return date."
// }
//
// Le backend NestJS réalise les contrôles métier.
// ==========================================================

export async function PATCH(request: Request) {
    // --------------------------------------------------------
    // VÉRIFIER L'ORIGINE DE LA REQUÊTE
    // --------------------------------------------------------

    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');

    if (fetchSite === 'cross-site') {
        return NextResponse.json(
            { message: 'Cross-site request rejected.' },
            { status: 403 },
        );
    }

    if (origin) {
        try {
            if (
                new URL(origin).origin !==
                new URL(request.url).origin
            ) {
                return NextResponse.json(
                    { message: 'Invalid request origin.' },
                    { status: 403 },
                );
            }
        } catch {
            return NextResponse.json(
                { message: 'Invalid request origin.' },
                { status: 403 },
            );
        }
    }

    // --------------------------------------------------------
    // AUTHENTIFICATION
    // --------------------------------------------------------

    const token = await getToken();

    if (!token) {
        return NextResponse.json(
            { message: 'Authentication required.' },
            { status: 401 },
        );
    }

    // --------------------------------------------------------
    // LIRE LE BODY JSON
    // --------------------------------------------------------

    if (
        !request.headers
            .get('content-type')
            ?.includes('application/json')
    ) {
        return NextResponse.json(
            { message: 'JSON body required.' },
            { status: 415 },
        );
    }

    let input: unknown;

    try {
        input = await request.json();
    } catch {
        return NextResponse.json(
            { message: 'Invalid JSON request.' },
            { status: 400 },
        );
    }

    if (
        typeof input !== 'object' ||
        input === null ||
        Array.isArray(input)
    ) {
        return NextResponse.json(
            { message: 'Invalid decision data.' },
            { status: 400 },
        );
    }

    const body = input as Record<string, unknown>;

    const reservationNumber = body.reservationNumber;
    const action = body.action;
    const reason = body.reason;

    // --------------------------------------------------------
    // VALIDER LE NUMÉRO DE RÉSERVATION
    // --------------------------------------------------------

    if (
        typeof reservationNumber !== 'string' ||
        !/^RES-\d{4}-\d{6}$/.test(reservationNumber)
    ) {
        return NextResponse.json(
            { message: 'Invalid reservation number.' },
            { status: 400 },
        );
    }

    // --------------------------------------------------------
    // VALIDER L'ACTION
    // --------------------------------------------------------

    if (action !== 'confirm' && action !== 'reject') {
        return NextResponse.json(
            { message: 'Invalid administrator action.' },
            { status: 400 },
        );
    }

    // --------------------------------------------------------
    // VALIDER LE MOTIF DE REFUS
    // --------------------------------------------------------

    if (action === 'reject') {
        if (
            typeof reason !== 'string' ||
            reason.trim().length < 5 ||
            reason.trim().length > 500
        ) {
            return NextResponse.json(
                {
                    message:
                        'Rejection reason must contain 5 to 500 characters.',
                },
                { status: 400 },
            );
        }
    }

    const decision: DecisionBody = {
        reservationNumber,
        action,
    };

    if (action === 'reject' && typeof reason === 'string') {
        decision.reason = reason.trim();
    }

    // --------------------------------------------------------
    // CONTACTER LE BACKEND NESTJS
    // --------------------------------------------------------

    try {
        const endpoint = buildApiUrl(
            `/reservations/admin/by-number/${encodeURIComponent(
                decision.reservationNumber,
            )}/${decision.action}`,
        );

        const response = await fetch(endpoint, {
            method: 'PATCH',

            headers: {
                Authorization: `Bearer ${token}`,

                ...(decision.action === 'reject'
                    ? { 'Content-Type': 'application/json' }
                    : {}),
            },

            // Confirm ne nécessite aucun body.
            // Reject reçoit uniquement le motif.
            ...(decision.action === 'reject'
                ? {
                    body: JSON.stringify({
                        reason: decision.reason,
                    }),
                }
                : {}),

            cache: 'no-store',
        });

        return forwardResponse(response);
    } catch {
        return NextResponse.json(
            { message: 'Unable to process administrator decision.' },
            { status: 502 },
        );
    }
}

