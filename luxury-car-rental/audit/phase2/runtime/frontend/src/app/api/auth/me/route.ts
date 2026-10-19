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
// GET /api/auth/me
// ==========================================================
//
// Cette route récupère le JWT depuis le cookie HttpOnly.
//
// Ensuite, elle appelle le backend NestJS :
//
// GET http://localhost:3001/auth/me
//
// Le navigateur n'a donc jamais besoin de lire directement
// le JWT.
// ==========================================================

export async function GET() {
    try {
        // ------------------------------------------------------
        // RÉCUPÉRER LE COOKIE
        // ------------------------------------------------------

        const cookieStore =
            await cookies();

        const accessToken =
            cookieStore
                .get('access_token')
                ?.value;

        // ------------------------------------------------------
        // UTILISATEUR NON CONNECTÉ
        // ------------------------------------------------------

        if (!accessToken) {
            return NextResponse.json(
                {
                    message:
                        'Authentication required.',
                },
                {
                    status: 401,
                },
            );
        }

        // ------------------------------------------------------
        // APPEL DU BACKEND NESTJS
        // ------------------------------------------------------

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

        const data =
            await backendResponse.json();

        // ------------------------------------------------------
        // TOKEN INVALIDE OU EXPIRÉ
        // ------------------------------------------------------

        if (!backendResponse.ok) {
            const response =
                NextResponse.json(
                    data,
                    {
                        status:
                            backendResponse.status,
                    },
                );

            // Si NestJS refuse le JWT,
            // supprimer également le cookie local.
            if (
                backendResponse.status ===
                401
            ) {
                response.cookies.set(
                    'access_token',
                    '',
                    {
                        httpOnly: true,

                        secure:
                            process.env.NODE_ENV ===
                            'production',

                        sameSite: 'lax',

                        path: '/',

                        maxAge: 0,
                    },
                );
            }

            return response;
        }

        // ------------------------------------------------------
        // UTILISATEUR AUTHENTIFIÉ
        // ------------------------------------------------------

        return NextResponse.json(
            data,
            {
                status: 200,
            },
        );
    } catch {
        return NextResponse.json(
            {
                message:
                    'Unable to retrieve the authenticated user.',
            },
            {
                status: 500,
            },
        );
    }
}
