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
// Le catalogue change rarement : il est mis en cache
// pendant 60 secondes afin d'éviter un appel à NestJS
// à chaque affichage de la page.
// ==========================================================

export const revalidate = 60;

export async function GET() {
    try {
        // Appeler le backend NestJS.
        const response = await fetch(
            buildApiUrl('/vehicles/catalog'),
            {
                method: 'GET',
                next: {
                    revalidate: 60,
                },
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
                    'public, s-maxage=60, stale-while-revalidate=300',
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
