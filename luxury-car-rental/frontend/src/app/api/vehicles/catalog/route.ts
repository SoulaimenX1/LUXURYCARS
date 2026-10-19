import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// GET /api/vehicles/catalog
// ==========================================================
//
// Récupère le catalogue public depuis NestJS.
//
// Frontend : localhost:3000/api/vehicles/catalog
// Backend  : localhost:3001/vehicles/catalog
//
// Aucun JWT n'est nécessaire pour ce catalogue public.
//
// Pas de cache côté proxy : les photos ajoutées par Admin
// deviennent visibles dès la prochaine consultation.
// ==========================================================

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Appeler le backend NestJS.
        const response = await fetch(
            buildApiUrl('/vehicles/catalog'),
            {
                method: 'GET',
                cache: 'no-store',
            },
        );

        // Lire la réponse du backend.
        const responseText = await response.text();

        let data: unknown;

        try {
            data = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                {
                    message: 'Invalid response from the vehicle service.',
                },
                {
                    status: 502,
                },
            );
        }

        // Transmettre une éventuelle erreur NestJS.
        if (!response.ok) {
            return NextResponse.json(data, {
                status: response.status,
            });
        }

        // Le catalogue doit toujours être un tableau.
        if (!Array.isArray(data)) {
            return NextResponse.json(
                {
                    message: 'Invalid vehicle catalogue format.',
                },
                {
                    status: 502,
                },
            );
        }

        // Retourner les véhicules réellement présents
        // dans la base de données PostgreSQL.
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control':
                    'no-store',
            },
        });
    } catch {
        // Si NestJS est arrêté ou inaccessible.
        return NextResponse.json(
            {
                message: 'Vehicle catalogue service unavailable.',
            },
            {
                status: 502,
            },
        );
    }
}
