
import { buildApiUrl } from '@/lib/api';
import { NextResponse } from 'next/server';

// ==========================================================
// VALIDATION D'UNE DATE
// ==========================================================

// Vérifier le format YYYY-MM-DD et la validité du calendrier.
function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

// ==========================================================
// GET /api/vehicles/available
// ==========================================================
//
// Cette route communique avec NestJS :
//
// GET /vehicles/available?from=...&to=...
//
// La base PostgreSQL détermine les véhicules disponibles.
// ==========================================================

export async function GET(request: Request) {
    try {
        // Lire les dates envoyées par le formulaire.
        const url = new URL(request.url);

        const from = url.searchParams.get('from') ?? '';
        const to = url.searchParams.get('to') ?? '';

        // Vérifier que les dates sont valides.
        if (!isValidDate(from) || !isValidDate(to)) {
            return NextResponse.json(
                {
                    message: 'Please provide valid rental dates.',
                },
                { status: 400 },
            );
        }

        // La date de retour doit suivre la date de départ.
        if (to <= from) {
            return NextResponse.json(
                {
                    message: 'Return date must be after pickup date.',
                },
                { status: 400 },
            );
        }

        // Construire les paramètres pour NestJS.
        const params = new URLSearchParams({
            from,
            to,
        });

        const backendResponse = await fetch(
            buildApiUrl(`/vehicles/available?${params.toString()}`),
            {
                method: 'GET',
                cache: 'no-store',
            },
        );

        // Lire les données retournées par NestJS.
        const responseText = await backendResponse.text();

        let data: unknown;

        try {
            data = JSON.parse(responseText);
        } catch {
            return NextResponse.json(
                {
                    message: 'Invalid response from availability service.',
                },
                { status: 502 },
            );
        }

        // Conserver les erreurs éventuelles du backend.
        if (!backendResponse.ok) {
            return NextResponse.json(data, {
                status: backendResponse.status,
            });
        }

        // Une recherche réussie doit retourner un tableau.
        if (!Array.isArray(data)) {
            return NextResponse.json(
                {
                    message: 'Invalid vehicle availability data.',
                },
                { status: 502 },
            );
        }

        // Retourner les données réelles à notre frontend.
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch {
        // NestJS inaccessible ou autre erreur technique.
        return NextResponse.json(
            {
                message: 'Availability service is currently unavailable.',
            },
            { status: 502 },
        );
    }
}
