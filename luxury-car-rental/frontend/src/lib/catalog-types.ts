// ==========================================================
// TYPE PARTAGÉ D'UN VÉHICULE
// ==========================================================
//
// Les propriétés correspondent exactement au JSON retourné
// par GET /vehicles/catalog dans NestJS.
//
// Anciennement déclaré localement dans chaque page
// (catalogue, disponibilité, admin) — centralisé ici.
// ==========================================================

export interface VehicleItem {
  id: string;
  manufactureYear: number;
  color: string;
  transmission: string;
  fuelType: string;
  seats: number;
  powerHp: number;
  dailyPrice: string;
  securityDeposit: string;
  description: string | null;
  modelName: string;
  brandName: string;
  categoryName: string;

  // Caractéristiques éditoriales (facultatives).
  engine?: string | null;
  torqueNm?: number | null;
  acceleration0To100?: string | null;
  topSpeedKmh?: number | null;
  consumptionL100km?: string | null;

  // Éditions.
  isSpecial?: boolean;
  isLimited?: boolean;
  editionSize?: number | null;

  announcedAt?: string;

  // Photo réelle du véhicule (image principale).
  imageUrl?: string | null;

  // Vidéo réelle du véhicule (facultative).
  videoUrl?: string | null;

  // Nombre de réservations honorées (popularité).
  reservationCount?: number;
}

// ==========================================================
// NOTIFICATIONS PUBLIQUES
// ==========================================================

export interface NotificationItem {
  id: string;
  type:
    | 'new_vehicle'
    | 'special_edition'
    | 'limited_edition'
    | 'general';
  title: string;
  message: string | null;
  vehicleId: string | null;
  brandName: string | null;
  modelName: string | null;
  categoryName: string | null;
  isSpecial: boolean;
  isLimited: boolean;
  editionSize: number | null;
  createdAt: string;
}
