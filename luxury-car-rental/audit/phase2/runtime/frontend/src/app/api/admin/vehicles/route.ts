import { buildApiUrl } from '@/lib/api';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ==========================================================
// API NEXT.JS - ADMIN VEHICLE MANAGEMENT
// ==========================================================
//
// GET   /api/admin/vehicles
// POST  /api/admin/vehicles
// PATCH /api/admin/vehicles
//
// Cette route sert de passerelle entre Next.js et NestJS.
// Le JWT reste dans le cookie HttpOnly côté serveur.
// ==========================================================

// ==========================================================
// RÉCUPÉRER LE TOKEN ADMIN
// ==========================================================

async function getToken(): Promise<string | undefined> {
    const cookieStore = await cookies();

    return cookieStore.get('access_token')?.value;
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
                message: 'Invalid response from vehicle service.',
            },
            {
                status: 502,
            },
        );
    }
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
// GET /api/admin/vehicles
// ==========================================================
//
// Récupère :
// - véhicules internes admin
// - marques
// - catégories
// - modèles
//
// Cela évite 4 requêtes différentes depuis la page React.
// ==========================================================

export async function GET(): Promise<NextResponse> {
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

    try {
        // ------------------------------------------------------
        // Charger les quatre ressources en parallèle.
        // ------------------------------------------------------

        const [
            vehiclesResponse,
            brandsResponse,
            categoriesResponse,
            modelsResponse,
        ] = await Promise.all([
            fetch(buildApiUrl('/vehicles'), {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: 'no-store',
            }),

            fetch(buildApiUrl('/vehicles/brands'), {
                method: 'GET',
                cache: 'no-store',
            }),

            fetch(buildApiUrl('/vehicles/categories'), {
                method: 'GET',
                cache: 'no-store',
            }),

            fetch(buildApiUrl('/vehicles/models'), {
                method: 'GET',
                cache: 'no-store',
            }),
        ]);

        // ------------------------------------------------------
        // Le endpoint /vehicles est protégé par ADMIN.
        // ------------------------------------------------------

        if (vehiclesResponse.status === 401) {
            return NextResponse.json(
                {
                    message: 'Authentication required.',
                },
                {
                    status: 401,
                },
            );
        }

        if (vehiclesResponse.status === 403) {
            return NextResponse.json(
                {
                    message: 'Administrator access required.',
                },
                {
                    status: 403,
                },
            );
        }

        // ------------------------------------------------------
        // Si une ressource échoue, transmettre une erreur claire.
        // ------------------------------------------------------

        if (
            !vehiclesResponse.ok ||
            !brandsResponse.ok ||
            !categoriesResponse.ok ||
            !modelsResponse.ok
        ) {
            return NextResponse.json(
                {
                    message:
                        'Unable to load complete vehicle management data.',
                },
                {
                    status: 502,
                },
            );
        }

        // ------------------------------------------------------
        // Lire les données JSON.
        // ------------------------------------------------------

        const vehicles: unknown =
            await vehiclesResponse.json();

        const brands: unknown =
            await brandsResponse.json();

        const categories: unknown =
            await categoriesResponse.json();

        const models: unknown =
            await modelsResponse.json();

        // ------------------------------------------------------
        // Retourner un seul objet au frontend.
        // ------------------------------------------------------

        return NextResponse.json(
            {
                vehicles,
                brands,
                categories,
                models,
            },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store',
                },
            },
        );
    } catch {
        return NextResponse.json(
            {
                message: 'Unable to load vehicle management data.',
            },
            {
                status: 502,
            },
        );
    }
}

// ==========================================================
// POST /api/admin/vehicles
// ==========================================================
//
// Le frontend envoie:
//
// {
//   "resource": "brand" | "category" | "model" | "vehicle",
//   "data": { ... }
// }
//
// Ensuite Next.js appelle le bon endpoint NestJS.
// ==========================================================

export async function POST(
    request: Request,
): Promise<NextResponse> {
    // ========================================================
    // PROTECTION CROSS-SITE
    // ========================================================

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

    // ========================================================
    // AUTHENTIFICATION
    // ========================================================

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

    // ========================================================
    // VÉRIFIER LE FORMAT JSON
    // ========================================================

    if (
        !request.headers
            .get('content-type')
            ?.includes('application/json')
    ) {
        return NextResponse.json(
            {
                message: 'JSON body required.',
            },
            {
                status: 415,
            },
        );
    }

    let input: unknown;

    try {
        input = await request.json();
    } catch {
        return NextResponse.json(
            {
                message: 'Invalid JSON.',
            },
            {
                status: 400,
            },
        );
    }

    if (
        typeof input !== 'object' ||
        input === null ||
        Array.isArray(input)
    ) {
        return NextResponse.json(
            {
                message: 'Invalid request.',
            },
            {
                status: 400,
            },
        );
    }

    const body = input as Record<string, unknown>;

    const resource = body.resource;
    const data = body.data;

    if (
        typeof resource !== 'string' ||
        typeof data !== 'object' ||
        data === null ||
        Array.isArray(data)
    ) {
        return NextResponse.json(
            {
                message: 'Invalid vehicle management request.',
            },
            {
                status: 400,
            },
        );
    }

    // ========================================================
    // DÉTERMINER L'ENDPOINT NESTJS
    // ========================================================

    let endpoint: string;

    switch (resource) {
        case 'brand':
            endpoint = '/vehicles/brands';
            break;

        case 'category':
            endpoint = '/vehicles/categories';
            break;

        case 'model':
            endpoint = '/vehicles/models';
            break;

        case 'vehicle':
            endpoint = '/vehicles';
            break;

        default:
            return NextResponse.json(
                {
                    message: 'Unknown resource type.',
                },
                {
                    status: 400,
                },
            );
    }

    // ========================================================
    // ENVOYER AU BACKEND
    // ========================================================

    try {
        const backendResponse = await fetch(
            buildApiUrl(endpoint),
            {
                method: 'POST',

                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify(data),

                cache: 'no-store',
            },
        );

        return forwardResponse(backendResponse);
    } catch {
        return NextResponse.json(
            {
                message: 'Unable to create vehicle resource.',
            },
            {
                status: 502,
            },
        );
    }
}

// ==========================================================
// PATCH /api/admin/vehicles
// ==========================================================
//
// Body attendu :
//
// {
//   "licensePlate": "TUN-488-FR",
//   "data": {
//     "dailyPrice": 1600,
//     "securityDeposit": 6000,
//     "mileageKm": 18500,
//     "color": "Rouge",
//     "description": "488 Spider"
//   }
// }
// ==========================================================

export async function PATCH(
    request: Request,
): Promise<NextResponse> {
    // ========================================================
    // PROTECTION CROSS-SITE
    // ========================================================

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

    // ========================================================
    // AUTHENTIFICATION
    // ========================================================

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

    // ========================================================
    // LIRE LE JSON
    // ========================================================

    let input: unknown;

    try {
        input = await request.json();
    } catch {
        return NextResponse.json(
            {
                message: 'Invalid JSON.',
            },
            {
                status: 400,
            },
        );
    }

    if (
        typeof input !== 'object' ||
        input === null ||
        Array.isArray(input)
    ) {
        return NextResponse.json(
            {
                message: 'Invalid vehicle update.',
            },
            {
                status: 400,
            },
        );
    }

    const body = input as Record<string, unknown>;

    const licensePlate = body.licensePlate;
    const data = body.data;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (
        typeof licensePlate !== 'string' ||
        !licensePlate.trim()
    ) {
        return NextResponse.json(
            {
                message: 'License plate is required.',
            },
            {
                status: 400,
            },
        );
    }

    if (
        typeof data !== 'object' ||
        data === null ||
        Array.isArray(data) ||
        Object.keys(data).length === 0
    ) {
        return NextResponse.json(
            {
                message: 'At least one field must be updated.',
            },
            {
                status: 400,
            },
        );
    }

    // ========================================================
    // APPELER LE PATCH NESTJS
    // ========================================================

    try {
        const backendResponse = await fetch(
            buildApiUrl(
                `/vehicles/by-plate/${encodeURIComponent(
                    licensePlate.trim(),
                )}`,
            ),
            {
                method: 'PATCH',

                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify(data),

                cache: 'no-store',
            },
        );

        return forwardResponse(backendResponse);
    } catch {
        return NextResponse.json(
            {
                message: 'Unable to update vehicle.',
            },
            {
                status: 502,
            },
        );
    }
}

// ==========================================================
// DELETE /api/admin/vehicles
// ==========================================================
//
// Supprime une ressource du catalogue ou un véhicule.
//
// Le frontend envoie :
//
//   DELETE /api/admin/vehicles?resource=brand&id=<uuid>
//   DELETE /api/admin/vehicles?resource=category&id=<uuid>
//   DELETE /api/admin/vehicles?resource=model&id=<uuid>
//   DELETE /api/admin/vehicles?resource=vehicle&licensePlate=<plate>
// ==========================================================

export async function DELETE(
    request: Request,
): Promise<NextResponse> {
    // ========================================================
    // PROTECTION CROSS-SITE
    // ========================================================

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

    // ========================================================
    // AUTHENTIFICATION
    // ========================================================

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

    // ========================================================
    // LIRE LES PARAMA"TRES DE REQUA�TE
    // ========================================================

    const url = new URL(request.url);
    const resource = url.searchParams.get('resource');
    const id = url.searchParams.get('id');
    const licensePlate =
        url.searchParams.get('licensePlate');

    // « force » : suppression en cascade des éléments
    // liés (modèles et véhicules) demandée par l'admin.
    const force = url.searchParams.get('force') === 'true';

    // ========================================================
    // DA%TERMINER L'ENDPOINT NESTJS
    // ========================================================

    let endpoint: string;

    switch (resource) {
        case 'brand':
        case 'category':
        case 'model':
            if (!id || !id.trim()) {
                return NextResponse.json(
                    {
                        message: 'Resource identifier is required.',
                    },
                    {
                        status: 400,
                    },
                );
            }

            endpoint = `/vehicles/${resource === 'brand'
                ? 'brands'
                : resource === 'category'
                    ? 'categories'
                    : 'models'}/${encodeURIComponent(
                        id.trim(),
                    )}`;
            break;

        case 'vehicle':
            if (!licensePlate || !licensePlate.trim()) {
                return NextResponse.json(
                    {
                        message: 'License plate is required.',
                    },
                    {
                        status: 400,
                    },
                );
            }

            endpoint = `/vehicles/by-plate/${encodeURIComponent(
                licensePlate.trim(),
            )}`;
            break;

        default:
            return NextResponse.json(
                {
                    message: 'Unknown resource type.',
                },
                {
                    status: 400,
                },
            );
    }

    // ========================================================
    // MODE « FORCE » (CATALOGUE)
    // ========================================================
    //
    // Transmis uniquement pour les marques, catégories
    // et modèles : autorise la suppression en cascade
    // des modèles et véhicules liés.

    if (
        force &&
        (resource === 'brand' ||
            resource === 'category' ||
            resource === 'model')
    ) {
        endpoint += '?force=true';
    }

    // ========================================================
    // ENVOYER AU BACKEND
    // ========================================================

    try {
        const backendResponse = await fetch(
            buildApiUrl(endpoint),
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
                message: 'Unable to delete vehicle resource.',
            },
            {
                status: 502,
            },
        );
    }
}
