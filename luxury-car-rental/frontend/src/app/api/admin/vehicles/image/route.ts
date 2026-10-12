import { NextResponse } from 'next/server';

import {
    handleVehicleMediaDelete,
    handleVehicleMediaUpload,
} from '../media-handler';

// ==========================================================
// /api/admin/vehicles/image
// ==========================================================
//
// POST   : envoie une photo de véhicule au backend.
// DELETE : supprime la photo d'un véhicule.
//
// La logique complète vit dans `../media-handler.ts`.

export async function POST(
    request: Request,
): Promise<NextResponse> {
    return handleVehicleMediaUpload(request, 'image');
}

export async function DELETE(
    request: Request,
): Promise<NextResponse> {
    return handleVehicleMediaDelete(request, 'image');
}
