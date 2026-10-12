import {
    NextResponse,
} from 'next/server';

// ==========================================================
// POST /api/auth/logout
// ==========================================================
//
// Notre JWT actuel est stocké dans
// un cookie HttpOnly.
//
// Pour déconnecter l'utilisateur,
// il suffit donc de supprimer ce cookie.
//
// Nous ajouterons plus tard la gestion
// complète des refresh tokens si elle
// devient nécessaire.
// ==========================================================

export async function POST() {
    const response =
        NextResponse.json(
            {
                message:
                    'Logged out successfully.',
            },
            {
                status: 200,
            },
        );

    // Supprimer le cookie JWT.
    response.cookies.set(
        'access_token',
        '',
        {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                'production',

            sameSite:
                'lax',

            path:
                '/',

            maxAge:
                0,
        },
    );

    return response;
}
