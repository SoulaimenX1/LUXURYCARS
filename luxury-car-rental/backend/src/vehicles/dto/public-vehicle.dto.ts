
import {
  FuelType,
  TransmissionType,
} from '../entities/vehicle.entity.js';

// Représente une voiture dans le catalogue public.
//
// Contrairement à l'entité Vehicle, cet objet
// ne contient aucune information administrative
// sensible comme le VIN ou l'immatriculation.
export interface PublicVehicleDto {
  // Identifiant utilisé pour consulter
  // une voiture ou la réserver plus tard.
  id: string;

  // Informations commerciales.
  brandName: string;
  modelName: string;
  categoryName: string;

  // Caractéristiques de la voiture.
  manufactureYear: number;
  color: string | null;
  transmission: TransmissionType;
  fuelType: FuelType;
  seats: number;
  powerHp: number | null;

  // Les prix NUMERIC de PostgreSQL
  // sont retournés sous forme de chaînes.
  dailyPrice: string;
  securityDeposit: string;

  // Description facultative.
  description: string | null;

  // ==========================================================
  // CARACTÉRISTIQUES ÉDITORIALES
  // ==========================================================

  // Motorisation, ex. « 4.0L V8 twin-turbo ».
  engine: string | null;

  // Couple en Nm.
  torqueNm: number | null;

  // 0 à 100 km/h (NUMERIC => chaîne).
  acceleration0To100: string | null;

  // Vitesse maximale en km/h.
  topSpeedKmh: number | null;

  // Consommation L/100 km (NUMERIC => chaîne).
  consumptionL100km: string | null;

  // Indique une édition spéciale.
  isSpecial: boolean;

  // Indique une édition limitée.
  isLimited: boolean;

  // Nombre d'exemplaires produits.
  editionSize: number | null;

  // Date d'arrivée au catalogue.
  announcedAt: Date;

  // ==========================================================
  // PHOTO RÉELLE DU VÉHICULE
  // ==========================================================

  // URL de la photo principale (image réelle du modèle).
  // Peut être nulle si aucune image n'a été enregistrée.
  imageUrl: string | null;

  // URL de la vidéo principale du véhicule (facultative).
  // Peut être nulle si aucune vidéo n'a été enregistrée.
  videoUrl: string | null;

  // ==========================================================
  // POPULARITÉ
  // ==========================================================

  // Nombre de réservations honorées pour ce véhicule.
  // Sert à classer les voitures les plus louées sur l'accueil.
  reservationCount: number;
}
