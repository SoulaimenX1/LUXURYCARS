import {
    NextResponse,
} from 'next/server';

import {
    cookies,
} from 'next/headers';

import {
    buildApiUrl,
} from '@/lib/api';

// ==========================================================
// GET /api/auth/session
// ==========================================================
//
// Variante silencieuse de /api/auth/me.
//
// Elle répond toujours 200 :
//
//   { user: { ... } }  -> utilisateur connecté
//   { user: null }     -> visiteur anonyme
//
// Cela évite les erreurs 401 dans la console du navigateur
// lorsque le header commun vérifie la session sur les pages
// publiques.
// ==========================================================

export async function GET() {
    try {
        const cookieStore =
            await cookies();

        const accessToken =
            cookieStore
                .get('access_token')
                ?.value;

        // Aucun cookie : visiteur anonyme.
        if (!accessToken) {
            return NextResponse.json(
                {
                    user: null,
                },
                {
                    status: 200,
                },
            );
        }

        const backendResponse =
            await fetch(
                buildApiUrl('/auth/me'),
                {
                    method: 'GET',

                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,
                    },

                    cache: 'no-store',
                },
            );

        // JWT refusé ou expiré : visiteur anonyme.
        if (!backendResponse.ok) {
            return NextResponse.json(
                {
                    user: null,
                },
                {
                    status: 200,
                },
            );
        }

        const data =
            await backendResponse.json();

        return NextResponse.json(
            {
                user: data,
            },
            {
                status: 200,
            },
        );
    } catch {
        // En cas d'erreur inattendue, rester silencieux :
        // le header considère simplement l'utilisateur
        // comme anonyme.
        return NextResponse.json(
            {
                user: null,
            },
            {
                status: 200,
            },
        );
    }
}
