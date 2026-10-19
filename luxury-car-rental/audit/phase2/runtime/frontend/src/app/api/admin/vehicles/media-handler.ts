import { buildApiUrl } from '@/lib/api';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ==========================================================
// PROXY NEXT.JS — MÉDIA D'UN VÉHICULE (ADMIN)
// ==========================================================
//
// Logique commune aux routes :
//
//   POST /api/admin/vehicles/image
//   POST /api/admin/vehicles/video
//
// Reçoit un formulaire multipart/form-data contenant :
//
//   - licensePlate : immatriculation de la voiture
//   - image|video  : fichier choisi sur le PC
//
// puis le transmet au backend NestJS :
//
//   POST /vehicles/by-plate/:licensePlate/image
//   POST /vehicles/by-plate/:licensePlate/video
//
// Le JWT reste dans le cookie HttpOnly côté serveur.
// ==========================================================

export type VehicleMediaKind = 'image' | 'video';

// Taille maximale acceptée par type de média.
const MAX_BYTES: Record<VehicleMediaKind, number> = {
    image: 8 * 1024 * 1024,
    video: 300 * 1024 * 1024,
};

const MAX_LABEL: Record<VehicleMediaKind, string> = {
    image: '8 MB',
    video: '300 MB',
};

// ==========================================================
// RÉCUPÉRER LE TOKEN ADMIN
// ==========================================================

async function getToken(): Promise<string | undefined> {
    const cookieStore = await cookies();

    return cookieStore.get('access_token')?.value;
}

// ==========================================================
// VÉRIFIER L'ORIGINE DES REQUÊTES QUI MODIFIENT LES DONNÉES
// ==========================================================

function hasInvalidOrigin(request: Request): boolean {
    const origin = request.headers.get('origin');

    if (!origin) {
        return false;
    }

    try {
        return (
            new URL(origin).origin !==
            new URL(request.url).origin
        );
    } catch {
        return true;
    }
}

// ==========================================================
// TRANSMETTRE UNE RÉPONSE DU BACKEND
// ==========================================================

async function forwardResponse(
    response: Response,
): Promise<NextResponse> {
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
            {
                message:
                    'Invalid response from vehicle service.',
            },
            {
                status: 502,
            },
        );
    }
}

// ==========================================================
// POST — ENVOYER LE MÉDIA AU BACKEND
// ==========================================================

export async function handleVehicleMediaUpload(
    request: Request,
    kind: VehicleMediaKind,
): Promise<NextResponse> {
    // ------------------------------------------------------
    // PROTECTION CROSS-SITE
    // ------------------------------------------------------

    if (hasInvalidOrigin(request)) {
        return NextResponse.json(
            {
                message: 'Invalid request origin.',
            },
            {
                status: 403,
            },
        );
    }

    // ------------------------------------------------------
    // AUTHENTIFICATION
    // ------------------------------------------------------

    const token = await getToken();

    if (!token) {
        return NextResponse.json(
            {
                message: 'Authentication required.',
            },
            {
                status: 401,
            },
        );
    }

    // ------------------------------------------------------
    // LIRE LE FORMULAIRE MULTIPART
    // ------------------------------------------------------

    let form: FormData;

    try {
        form = await request.formData();
    } catch {
        return NextResponse.json(
            {
                message: 'Invalid form data.',
            },
            {
                status: 400,
            },
        );
    }

    const licensePlate = form.get('licensePlate');
    const file = form.get(kind);

    // ------------------------------------------------------
    // VALIDATION
    // ------------------------------------------------------

    if (
        typeof licensePlate !== 'string' ||
        licensePlate.trim() === ''
    ) {
        return NextResponse.json(
            {
                message: 'License plate required.',
            },
            {
                status: 400,
            },
        );
    }

    if (!(file instanceof Blob) || file.size === 0) {
        return NextResponse.json(
            {
                message:
                    kind === 'video'
                        ? 'Video file required.'
                        : 'Image file required.',
            },
            {
                status: 400,
            },
        );
    }

    if (file.size > MAX_BYTES[kind]) {
        return NextResponse.json(
            {
                message:
                    kind === 'video'
                        ? `Video is too large (${MAX_LABEL.video} maximum).`
                        : `Image is too large (${MAX_LABEL.image} maximum).`,
            },
            {
                status: 413,
            },
        );
    }

    // ------------------------------------------------------
    // RECONSTRUIRE LE FORMULAIRE POUR LE BACKEND
    // ------------------------------------------------------
    //
    // On ne fixe pas le Content-Type : fetch ajoute
    // automatiquement la frontière multipart correcte.

    const outgoing = new FormData();

    outgoing.append(
        kind,
        file,
        file.name || `vehicle-${kind}`,
    );

    // ------------------------------------------------------
    // ENVOYER AU BACKEND
    // ------------------------------------------------------

    try {
        const backendResponse = await fetch(
            buildApiUrl(
                `/vehicles/by-plate/${encodeURIComponent(
                    licensePlate.trim(),
                )}/${kind}`,
            ),
            {
                method: 'POST',

                headers: {
                    Authorization: `Bearer ${token}`,
                },

                body: outgoing,

                cache: 'no-store',
            },
        );

        return forwardResponse(backendResponse);
    } catch {
        return NextResponse.json(
            {
                message:
                    kind === 'video'
                        ? 'Unable to upload vehicle video.'
                        : 'Unable to upload vehicle image.',
            },
            {
                status: 502,
            },
        );
    }
}

// ==========================================================
// DELETE — SUPPRIMER LE MÉDIA D'UN VÉHICULE
// ==========================================================
//
// Immatriculation transmise dans la query string :
//
//   DELETE /api/admin/vehicles/image?licensePlate=LC-0001
//   DELETE /api/admin/vehicles/video?licensePlate=LC-0001

export async function handleVehicleMediaDelete(
    request: Request,
    kind: VehicleMediaKind,
): Promise<NextResponse> {
    // ------------------------------------------------------
    // PROTECTION CROSS-SITE
    // ------------------------------------------------------

    if (hasInvalidOrigin(request)) {
        return NextResponse.json(
            {
                message: 'Invalid request origin.',
            },
            {
                status: 403,
            },
        );
    }

    // ------------------------------------------------------
    // AUTHENTIFICATION
    // ------------------------------------------------------

    const token = await getToken();

    if (!token) {
        return NextResponse.json(
            {
                message: 'Authentication required.',
            },
            {
                status: 401,
            },
        );
    }

    // ------------------------------------------------------
    // LIRE L'IMMATRICULATION
    // ------------------------------------------------------

    const licensePlate = new URL(
        request.url,
    ).searchParams
        .get('licensePlate')
        ?.trim();

    if (!licensePlate) {
        return NextResponse.json(
            {
                message: 'License plate required.',
            },
            {
                status: 400,
            },
        );
    }

    // ------------------------------------------------------
    // ENVOYER AU BACKEND
    // ------------------------------------------------------

    try {
        const backendResponse = await fetch(
            buildApiUrl(
                `/vehicles/by-plate/${encodeURIComponent(
                    licensePlate,
                )}/${kind}`,
            ),
            {
                method: 'DELETE',

                headers: {
                    Authorization: `Bearer ${token}`,
                },

                cache: 'no-store',
            },
        );

        return forwardResponse(backendResponse);
    } catch {
        return NextResponse.json(
            {
                message:
                    kind === 'video'
                        ? 'Unable to delete vehicle video.'
                        : 'Unable to delete vehicle image.',
            },
            {
                status: 502,
            },
        );
    }
}
