// ==========================================================
// VISUELS CINÉMATIQUES PARTAGÉS
// ==========================================================
//
// Chaque visuel associe :
//   - une vidéo MP4 distante (Pexels) ;
//   - une image poster servie LOCALEMENT depuis /public/media.
//
// Le poster local est essentiel : il s'affiche immédiatement,
// sans dépendre du réseau. Si la vidéo distante est lente,
// bloquée ou indisponible, la zone garde donc toujours une
// image de voiture — elle n'est jamais vide.
// ==========================================================

export interface LuxeVideo {
  src: string;
  poster: string;
}

// URL directe d'une vidéo Pexels (lisible dans un <video>).
const mp4 = (id: string, file: string): string =>
  `https://videos.pexels.com/video-files/${id}/${file}`;

// Poster local : toujours disponible, servi par Next.js.
const local = (file: string): string => `/media/${file}`;

// ==========================================================
// VIDÉOS DES FICHES VÉHICULES
// ==========================================================

export const LUXURY_VEHICLE_VIDEOS: LuxeVideo[] = [
  {
    src: mp4('5309381', '5309381-hd_1280_720_25fps.mp4'),
    poster: local('vehicle-1.jpg'),
  },
  {
    src: mp4('5309435', '5309435-hd_1280_720_25fps.mp4'),
    poster: local('vehicle-2.jpg'),
  },
  {
    src: mp4('5309351', '5309351-hd_1280_720_25fps.mp4'),
    poster: local('vehicle-3.jpg'),
  },
  {
    src: mp4('6157907', '6157907-hd_1280_720_30fps.mp4'),
    poster: local('vehicle-4.jpg'),
  },
  {
    src: mp4('6872084', '6872084-hd_1280_720_25fps.mp4'),
    poster: local('vehicle-5.jpg'),
  },
  {
    src: mp4('20153915', '20153915-hd_1280_720_24fps.mp4'),
    poster: local('vehicle-6.jpg'),
  },
];

// Sélectionne la vidéo affichée pour une fiche donnée.
export function vehicleVideoAt(index: number): LuxeVideo {
  return LUXURY_VEHICLE_VIDEOS[
    ((index % LUXURY_VEHICLE_VIDEOS.length) +
      LUXURY_VEHICLE_VIDEOS.length) %
      LUXURY_VEHICLE_VIDEOS.length
  ];
}

// ==========================================================
// VIDÉOS DE L'ACCUEIL
// ==========================================================

// Héro — passage de voitures de sport en mouvement.
export const HERO_VIDEO: LuxeVideo = {
  src: mp4('5309381', '5309381-hd_1920_1080_25fps.mp4'),
  poster: local('hero.jpg'),
};

// Section expérience — supercar de nuit en ville.
export const EXPERIENCE_VIDEO: LuxeVideo = {
  src: mp4('30843738', '13190445_2560_1440_24fps.mp4'),
  poster: local('experience.jpg'),
};

// Bandeau éditorial — vitrine de supercars.
export const EDITORIAL_VIDEO: LuxeVideo = {
  src: mp4('30678863', '13127658_1920_1080_24fps.mp4'),
  poster: local('editorial.jpg'),
};

// ==========================================================
// EFFET DE PERSPECTIVE 3D PARTAGÉ
// ==========================================================
//
// Incline le visuel en suivant le curseur et déplace le reflet
// doré (--mx / --my) pour un rendu "galerie 3D".
// ==========================================================

export function applyLuxeTilt(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): void {
  const rect = element.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;

  element.style.setProperty('--rx', `${((y - 0.5) * -12).toFixed(2)}deg`);
  element.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
  element.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
  element.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  element.style.setProperty('--lift', `${(-4 - Math.abs(x - 0.5) * 10).toFixed(1)}px`);
}

export function resetLuxeTilt(element: HTMLElement): void {
  element.style.setProperty('--rx', '0deg');
  element.style.setProperty('--ry', '0deg');
  element.style.setProperty('--lift', '0px');
}
