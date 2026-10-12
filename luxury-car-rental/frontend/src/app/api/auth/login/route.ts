import {
    NextResponse,
} from 'next/server';

import {
    buildApiUrl,
} from '@/lib/api';

// ==========================================================
// TYPES UTILISÉS PAR LA ROUTE
// ==========================================================

interface LoginRequestBody {
    email?: string;
    password?: string;
}

interface BackendLoginResponse {
    accessToken?: string;

    tokenType?: string;

    user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
        status?: string;
    };

    message?: string | string[];
    error?: string;
    statusCode?: number;
}

// ==========================================================
// POST /api/auth/login
// ==========================================================
//
// Le navigateur appelle cette route Next.js.
//
// Cette route appelle ensuite :
//
// POST http://localhost:3001/auth/login
//
// Si NestJS retourne un JWT valide,
// celui-ci est stocké dans un cookie HttpOnly.
//
// Avantage :
//
// le JavaScript exécuté dans le navigateur
// ne peut pas lire directement le JWT.
// ==========================================================

export async function POST(
    request: Request,
) {
    try {
        const body =
            await request.json() as LoginRequestBody;

        // ------------------------------------------------------
        // VALIDATION MINIMALE CÔTÉ FRONTEND
        // ------------------------------------------------------

        if (
            !body.email ||
            !body.password
        ) {
            return NextResponse.json(
                {
                    message:
                        'Email and password are required.',
                },
                {
                    status: 400,
                },
            );
        }

        // ------------------------------------------------------
        // APPEL DU BACKEND NESTJS
        // ------------------------------------------------------

        const backendResponse =
            await fetch(
                buildApiUrl(
                    '/auth/login',
                ),
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',
                    },

                    body: JSON.stringify({
                        email:
                            body.email.trim(),

                        password:
                            body.password,
                    }),

                    // Toujours demander une réponse fraîche.
                    cache: 'no-store',
                },
            );

        const data =
            await backendResponse
                .json() as BackendLoginResponse;

        // ------------------------------------------------------
        // ERREUR RETOURNÉE PAR NESTJS
        // ------------------------------------------------------

        if (
            !backendResponse.ok
        ) {
            return NextResponse.json(
                data,
                {
                    status:
                        backendResponse.status,
                },
            );
        }

        // ------------------------------------------------------
        // VÉRIFIER QUE LE JWT EXISTE
        // ------------------------------------------------------

        if (
            !data.accessToken
        ) {
            return NextResponse.json(
                {
                    message:
                        'Authentication token was not returned by the backend.',
                },
                {
                    status: 500,
                },
            );
        }

        // ------------------------------------------------------
        // CONSTRUIRE LA RÉPONSE NEXT.JS
        // ------------------------------------------------------

        const response =
            NextResponse.json(
                {
                    user:
                        data.user,

                    tokenType:
                        data.tokenType ??
                        'Bearer',
                },
                {
                    status: 200,
                },
            );

        // ------------------------------------------------------
        // STOCKER LE JWT DANS UN COOKIE HTTPONLY
        // ------------------------------------------------------
        //
        // httpOnly :
        // empêche JavaScript côté navigateur de lire le JWT.
        //
        // sameSite=lax :
        // réduit certains risques CSRF.
        //
        // maxAge :
        // 30 jours, cohérent avec notre JWT actuel.
        // Le cookie reste donc présent jusqu'à la
        // déconnexion explicite (sign out).
        // ------------------------------------------------------

        response.cookies.set(
            'access_token',
            data.accessToken,
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV ===
                    'production',

                sameSite: 'lax',

                path: '/',

                maxAge:
                    30 * 24 * 60 * 60,
            },
        );

        return response;
    } catch {
        // ------------------------------------------------------
        // BACKEND INDISPONIBLE OU ERREUR INATTENDUE
        // ------------------------------------------------------

        return NextResponse.json(
            {
                message:
                    'Unable to connect to the authentication service.',
            },
            {
                status: 500,
            },
        );
    }
}
