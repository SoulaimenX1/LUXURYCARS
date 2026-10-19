import { NextResponse } from 'next/server';

import {
    handleVehicleMediaDelete,
    handleVehicleMediaUpload,
} from '../media-handler';

// ==========================================================
// /api/admin/vehicles/video
// ==========================================================
//
// POST   : envoie une vidéo de véhicule au backend.
// DELETE : supprime la vidéo d'un véhicule.
//
// La logique complète vit dans `../media-handler.ts`.

export async function POST(
    request: Request,
): Promise<NextResponse> {
    return handleVehicleMediaUpload(request, 'video');
}

export async function DELETE(
    request: Request,
): Promise<NextResponse> {
    return handleVehicleMediaDelete(request, 'video');
}
