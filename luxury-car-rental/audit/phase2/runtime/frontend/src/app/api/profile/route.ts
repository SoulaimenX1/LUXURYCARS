import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { buildApiUrl } from '@/lib/api';

// ==========================================================
// RÉCUPÉRER LE JWT DE L'UTILISATEUR
// ==========================================================

async function getAccessToken(): Promise<string | undefined> {
    // Le JWT est stocké dans un cookie HttpOnly.
    const cookieStore = await cookies();

    return cookieStore.get('access_token')?.value;
}

// ==========================================================
// LIRE UNE RÉPONSE DU BACKEND
// ==========================================================

async function forwardResponse(response: Response) {
    // Lire la réponse NestJS sans supposer qu'elle est
    // toujours au format JSON.
    const text = await response.text();

    let data: unknown;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            message: text || 'Unexpected backend response.',
        };
    }

    return NextResponse.json(data, {
        status: response.status,
    });
}

// ==========================================================
// GET /api/profile
// ==========================================================
//
// Cette route appelle le backend :
//
// GET http://localhost:3001/profile/me
// ==========================================================

export async function GET() {
    try {
        const token = await getAccessToken();

        // Refuser les utilisateurs non connectés.
        if (!token) {
            return NextResponse.json(
                { message: 'Authentication required.' },
                { status: 401 },
            );
        }

        const response = await fetch(
            buildApiUrl('/profile/me'),
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
            { message: 'Unable to retrieve profile.' },
            { status: 500 },
        );
    }
}

// ==========================================================
// PATCH /api/profile
// ==========================================================
//
// Cette route appelle le backend :
//
// PATCH http://localhost:3001/profile/me
//
// Elle permet au client de modifier ses informations
// personnelles (prénom, nom, téléphone).
// ==========================================================

export async function PATCH(request: Request) {
    try {
        const token = await getAccessToken();

        // Refuser les utilisateurs non connectés.
        if (!token) {
            return NextResponse.json(
                { message: 'Authentication required.' },
                { status: 401 },
            );
        }

        // Récupérer les données du formulaire.
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { message: 'Invalid JSON request.' },
                { status: 400 },
            );
        }

        // Envoyer les informations à NestJS.
        const response = await fetch(
            buildApiUrl('/profile/me'),
            {
                method: 'PATCH',

                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },

                body: JSON.stringify(body),

                cache: 'no-store',
            },
        );

        // Retourner le résultat exact du backend.
        return forwardResponse(response);
    } catch {
        return NextResponse.json(
            { message: 'Unable to update profile.' },
            { status: 500 },
        );
    }
}
