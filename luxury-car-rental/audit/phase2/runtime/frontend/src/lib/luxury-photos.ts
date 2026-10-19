// ==========================================================
// VISUELS CINÉMATIQUES PARTAGÉS — ÉDITION PHOTO
// ==========================================================
//
// La présentation des véhicules repose UNIQUEMENT sur des
// photographies : aucune vidéo n'est chargée. Chaque visuel
// est une image servie LOCALEMENT depuis /public/media, donc
// disponible immédiatement et sans dépendance réseau.
// ==========================================================

// Poster local : toujours disponible, servi par Next.js.
const local = (file: string): string => `/media/${file}`;

// Photos d'ambiance des fiches véhicules (cartes de catalogue).
export const LUXURY_VEHICLE_PHOTOS: string[] = [
  local('vehicle-1.jpg'),
  local('vehicle-2.jpg'),
  local('vehicle-3.jpg'),
  local('vehicle-4.jpg'),
  local('vehicle-5.jpg'),
  local('vehicle-6.jpg'),
];

// Photo de repli stable pour une carte : jamais de changement
// entre deux rendus (contrairement à un index aléatoire figé à
// chaque rendu, qui ferait « clignoter » les cartes au montage).
export function vehiclePhotoAt(index: number): string {
  const photos = LUXURY_VEHICLE_PHOTOS;
  return photos[((index % photos.length) + photos.length) % photos.length];
}

// Photos d'ambiance des pages de marque (accueil).
export const HERO_PHOTO = local('hero.jpg');
export const EXPERIENCE_PHOTO = local('experience.jpg');
export const EDITORIAL_PHOTO = local('editorial.jpg');
