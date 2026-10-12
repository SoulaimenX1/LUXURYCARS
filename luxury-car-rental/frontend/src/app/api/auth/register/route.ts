import {
    NextResponse,
} from 'next/server';

import {
    buildApiUrl,
} from '@/lib/api';

// ==========================================================
// TYPES
// ==========================================================

interface RegisterRequestBody {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
}

// ==========================================================
// POST /api/auth/register
// ==========================================================
//
// Cette route transmet l'inscription à NestJS :
//
// POST /auth/register
//
// Le backend crée toujours un utilisateur
// avec le rôle "customer".
// ==========================================================

export async function POST(
    request: Request,
) {
    try {
        const body =
            await request.json() as RegisterRequestBody;

        // ------------------------------------------------------
        // VALIDATION MINIMALE
        // ------------------------------------------------------

        if (
            !body.firstName ||
            !body.lastName ||
            !body.email ||
            !body.password
        ) {
            return NextResponse.json(
                {
                    message:
                        'First name, last name, email and password are required.',
                },
                {
                    status: 400,
                },
            );
        }

        // Le backend exige actuellement
        // un mot de passe d'au moins 12 caractères.
        if (
            body.password.length < 12
        ) {
            return NextResponse.json(
                {
                    message:
                        'Password must contain at least 12 characters.',
                },
                {
                    status: 400,
                },
            );
        }

        // ------------------------------------------------------
        // CONSTRUIRE LE BODY DU BACKEND
        // ------------------------------------------------------

        const registrationData: {
            firstName: string;
            lastName: string;
            email: string;
            password: string;
            phone?: string;
        } = {
            firstName:
                body.firstName.trim(),

            lastName:
                body.lastName.trim(),

            email:
                body.email.trim(),

            password:
                body.password,
        };

        // Ajouter le téléphone uniquement
        // s'il a réellement été renseigné.
        if (
            body.phone?.trim()
        ) {
            registrationData.phone =
                body.phone.trim();
        }

        // ------------------------------------------------------
        // APPEL DU BACKEND
        // ------------------------------------------------------

        const backendResponse =
            await fetch(
                buildApiUrl(
                    '/auth/register',
                ),
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',
                    },

                    body:
                        JSON.stringify(
                            registrationData,
                        ),

                    cache:
                        'no-store',
                },
            );

        const data =
            await backendResponse.json();

        // ------------------------------------------------------
        // CONSERVER LE CODE HTTP DU BACKEND
        // ------------------------------------------------------
        //
        // Exemples :
        //
        // 201 : compte créé
        // 400 : données invalides
        // 409 : email déjà utilisé
        // ------------------------------------------------------

        return NextResponse.json(
            data,
            {
                status:
                    backendResponse.status,
            },
        );
    } catch {
        return NextResponse.json(
            {
                message:
                    'Unable to connect to the registration service.',
            },
            {
                status: 500,
            },
        );
    }
}
