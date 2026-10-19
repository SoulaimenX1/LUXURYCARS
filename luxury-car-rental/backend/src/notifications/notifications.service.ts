import { InboxService } from './inbox.service.js';
import { Logger } from '@nestjs/common';

import {
    Injectable,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
    Repository,
} from 'typeorm';

// Entité locale.
import {
    Notification,
    NotificationType,
} from './entities/notification.entity.js';

// Entités du catalogue (lecture seule, pour enrichir
// les notifications avec la marque et le modèle).
import {
    Brand,
} from '../vehicles/entities/brand.entity.js';

import {
    Category,
} from '../vehicles/entities/category.entity.js';

import {
    VehicleModel,
} from '../vehicles/entities/vehicle-model.entity.js';

import {
    Vehicle,
} from '../vehicles/entities/vehicle.entity.js';

import type {
    PublicNotificationDto,
} from './dto/public-notification.dto.js';

// Arguments nécessaires pour créer une notification
// liée à une voiture.
export interface VehicleNotificationInput {
    vehicleId: string;
    type: NotificationType;
    title: string;
    message: string | null;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    constructor(
        @InjectRepository(Notification)
        private readonly notificationsRepository:
            Repository<Notification>,
        private readonly inbox: InboxService,
    ) {}

    // ==========================================
    // 1. FLUX PUBLIC DES NOTIFICATIONS
    // ==========================================

    async findPublished(): Promise<
        PublicNotificationDto[]
    > {
        // Les notifications sont enrichies avec le
        // nom de la marque, du modèle et de la
        // catégorie de la voiture concernée.
        const rows = await this.notificationsRepository
            .createQueryBuilder('notification')
            .leftJoin(
                Vehicle,
                'vehicle',
                'vehicle.id = notification.vehicle_id',
            )
            .leftJoin(
                VehicleModel,
                'model',
                'model.id = vehicle.model_id',
            )
            .leftJoin(
                Brand,
                'brand',
                'brand.id = model.brand_id',
            )
            .leftJoin(
                Category,
                'category',
                'category.id = model.category_id',
            )
            .select('notification.id', 'id')
            .addSelect('notification.type', 'type')
            .addSelect('notification.title', 'title')
            .addSelect('notification.message', 'message')
            .addSelect(
                'notification.vehicle_id',
                'vehicleId',
            )
            .addSelect(
                'notification.created_at',
                'createdAt',
            )
            .addSelect('brand.name', 'brandName')
            .addSelect('model.name', 'modelName')
            .addSelect('category.name', 'categoryName')
            .addSelect('vehicle.is_special', 'isSpecial')
            .addSelect('vehicle.is_limited', 'isLimited')
            .addSelect('vehicle.edition_size', 'editionSize')
            .where('notification.is_published = true')
            .orderBy(
                'notification.created_at',
                'DESC',
            )
            .limit(60)
            .getRawMany();

        return rows.map((row) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            message: row.message,
            vehicleId: row.vehicleId,
            brandName: row.brandName ?? null,
            modelName: row.modelName ?? null,
            categoryName: row.categoryName ?? null,
            isSpecial: row.isSpecial === true,
            isLimited: row.isLimited === true,
            editionSize:
                row.editionSize === null ||
                row.editionSize === undefined
                    ? null
                    : Number(row.editionSize),
            createdAt: row.createdAt,
        }));
    }

    // ==========================================
    // 2. CRÉER UNE NOTIFICATION
    // ==========================================

    async createVehicleNotification(
        input: VehicleNotificationInput,
    ): Promise<Notification> {
        const notification =
            this.notificationsRepository.create({
                vehicleId: input.vehicleId,
                type: input.type,
                title: input.title,
                message: input.message,
                isPublished: true,
            });

        return this.notificationsRepository.save(
            notification,
        );
    }

    // ==========================================
    // 3. NOTIFIER UNE NOUVELLE VOITURE
    // ==========================================
    //
    // Le type le plus « fort » est retenu :
    // édition limitée > édition spéciale > nouveau.

    async notifyNewVehicle(params: {
        vehicleId: string;
        brandName: string;
        modelName: string;
        isSpecial: boolean;
        isLimited: boolean;
        editionSize: number | null;
    }): Promise<Notification> {
        let type = NotificationType.NEW_VEHICLE;
        let title =
            `New arrival: ${params.brandName} ${params.modelName}`;
        let message =
            'Just added to the Luxury Cars fleet.';

        if (params.isLimited) {
            type = NotificationType.LIMITED_EDITION;
            title =
                `Limited edition: ${params.brandName} ${params.modelName}`;
            message =
                params.editionSize !== null
                    ? `Only ${params.editionSize} produced worldwide. Now available in our collection.`
                    : 'A rare, numbered edition now available in our collection.';
        } else if (params.isSpecial) {
            type = NotificationType.SPECIAL_EDITION;
            title =
                `Special edition: ${params.brandName} ${params.modelName}`;
            message =
                'A special edition now available in our collection.';
        }

        const notice = await this.createVehicleNotification({
            vehicleId: params.vehicleId,
            type,
            title,
            message,
        });
        try {
            await this.inbox.broadcastFleet(params.vehicleId, title, message);
        } catch (error) {
            // Une panne du canal privé n'annule pas l'ajout du véhicule.
            this.logger.warn(`Fleet inbox unavailable: ${String(error)}`);
        }
        return notice;
    }
}
