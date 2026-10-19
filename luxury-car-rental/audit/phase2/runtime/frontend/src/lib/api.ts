// ==========================================================
// CONFIGURATION CENTRALE DE L'API
// ==========================================================
//
// Ce fichier contient les fonctions communes utilisées
// pour communiquer avec notre backend NestJS.
//
// Backend en développement :
// http://localhost:3001
//
// Frontend Next.js :
// http://localhost:3000
//
// L'adresse du backend provient du fichier :
//
// frontend/.env.local
//
// avec :
//
// NEXT_PUBLIC_API_URL=http://localhost:3001
//
// ==========================================================


// ==========================================================
// URL PRINCIPALE DU BACKEND
// ==========================================================

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3001';


// ==========================================================
// CONSTRUIRE UNE URL COMPLÈTE
// ==========================================================
//
// Exemple :
//
// buildApiUrl('/auth/login')
//
// retourne :
//
// http://localhost:3001/auth/login
//
// Cette fonction est utilisée notamment par :
//
// src/app/api/auth/login/route.ts
// src/app/api/auth/register/route.ts
//
// ==========================================================

export function buildApiUrl(
    path: string,
): string {
    // Ajouter "/" automatiquement
    // si le chemin ne commence pas déjà par "/".
    const normalizedPath =
        path.startsWith('/')
            ? path
            : `/${path}`;

    return `${API_BASE_URL}${normalizedPath}`;
}
