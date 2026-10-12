
import {
  NotificationType,
} from '../entities/notification.entity.js';

// Représente une notification dans le flux public.
export interface PublicNotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  vehicleId: string | null;

  // Informations sur la voiture concernée (si disponible).
  brandName: string | null;
  modelName: string | null;
  categoryName: string | null;

  // Marqueurs d'édition, utiles pour l'affichage.
  isSpecial: boolean;
  isLimited: boolean;
  editionSize: number | null;

  createdAt: Date;
}
