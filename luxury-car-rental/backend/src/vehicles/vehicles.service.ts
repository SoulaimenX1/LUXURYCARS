
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,unlink,readdir,access} from 'node:fs/promises';
import {join,basename} from 'node:path';
import { InjectRepository } from '@nestjs/typeorm';

import {
    ILike,
    In,
    QueryFailedError,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';

import type {
    EntityManager,
} from 'typeorm';

// ==========================================
// ENTITÉS POSTGRESQL
// ==========================================

import {
    Brand,
} from './entities/brand.entity.js';

import {
    Category,
} from './entities/category.entity.js';

import {
    VehicleModel,
} from './entities/vehicle-model.entity.js';

import {
    Vehicle,
    VehicleStatus,
} from './entities/vehicle.entity.js';

import {
    VehicleImage,
    MediaType,
} from './entities/vehicle-image.entity.js';

// ==========================================
// STOCKAGE DISQUE DES MÉDIAS (PHOTOS / VIDÉOS)
// ==========================================

import type {
    UploadedImageFile,
} from './vehicle-images.storage.js';

import {
    isAllowedImageMime,
    isAllowedVideoMime,
    removeStoredVehicleMedia,
    storeVehicleMedia,
    vehicleImagesDir,
} from './vehicle-images.storage.js';

// ==========================================
// DTO DE CRÉATION
// ==========================================

import {
    CreateBrandDto,
} from './dto/create-brand.dto.js';

import {
    CreateCategoryDto,
} from './dto/create-category.dto.js';

import {
    CreateVehicleModelDto,
} from './dto/create-vehicle-model.dto.js';

import {
    CreateVehicleDto,
} from './dto/create-vehicle.dto.js';

// ==========================================
// DTO DE MODIFICATION ET DE CONSULTATION
// ==========================================

import {
    UpdateVehicleDto,
} from './dto/update-vehicle.dto.js';

import type {
    PublicVehicleDto,
} from './dto/public-vehicle.dto.js';

import {
    CheckAvailabilityDto,
} from './dto/check-availability.dto.js';

// Service de notifications : une nouvelle voiture
// alimente automatiquement le flux du site.
import {
    NotificationsService,
} from '../notifications/notifications.service.js';

@Injectable()
export class VehiclesService {
    constructor(
        // Accès à la table brands.
        @InjectRepository(Brand)
        private readonly brandsRepository:
            Repository<Brand>,

        // Accès à la table categories.
        @InjectRepository(Category)
        private readonly categoriesRepository:
            Repository<Category>,

        // Accès à la table vehicle_models.
        @InjectRepository(VehicleModel)
        private readonly modelsRepository:
            Repository<VehicleModel>,

        // Accès à la table vehicles.
        @InjectRepository(Vehicle)
        private readonly vehiclesRepository:
            Repository<Vehicle>,

        // Accès à la table vehicle_images (photos).
        @InjectRepository(VehicleImage)
        private readonly vehicleImagesRepository:
            Repository<VehicleImage>,

        // Créer les notifications du site.
        private readonly notificationsService:
            NotificationsService,
    ) { }

    // ==========================================
    // 1. CONSULTER LES MARQUES
    // ==========================================

    async findAllBrands(): Promise<Brand[]> {
        // Classer les marques par ordre alphabétique.
        return this.brandsRepository.find({
            order: {
                name: 'ASC',
            },
        });
    }

    // ==========================================
    // 2. CONSULTER LES CATÉGORIES
    // ==========================================

    async findAllCategories(): Promise<Category[]> {
        // Classer les catégories par ordre alphabétique.
        return this.categoriesRepository.find({
            order: {
                name: 'ASC',
            },
        });
    }

    // ==========================================
    // 3. CONSULTER LES MODÈLES
    // ==========================================

    async findAllModels(): Promise<VehicleModel[]> {
        // Classer les modèles par ordre alphabétique.
        return this.modelsRepository.find({
            order: {
                name: 'ASC',
            },
        });
    }

    // ==========================================
    // 4. CRÉER UNE MARQUE
    // ==========================================

    async createBrand(
        dto: CreateBrandDto,
    ): Promise<Brand> {
        // Supprimer les espaces inutiles.
        const name = dto.name.trim();

        // Vérifier si cette marque existe déjà.
        const existingBrand =
            await this.brandsRepository.findOne({
                where: {
                    name: ILike(name),
                },
            });

        if (existingBrand) {
            throw new ConflictException(
                'This brand already exists',
            );
        }

        // Préparer la nouvelle marque.
        const brand = this.brandsRepository.create({
            name,
        });

        try {
            // Enregistrer dans PostgreSQL.
            return await this.brandsRepository.save(
                brand,
            );
        } catch (error) {
            // Le code 23505 indique un doublon.
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string })
                    .code === '23505'
            ) {
                throw new ConflictException(
                    'This brand already exists',
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 5. CRÉER UNE CATÉGORIE
    // ==========================================

    async createCategory(
        dto: CreateCategoryDto,
    ): Promise<Category> {
        // Nettoyer le nom.
        const name = dto.name.trim();

        // Vérifier si cette catégorie existe déjà.
        const existingCategory =
            await this.categoriesRepository.findOne({
                where: {
                    name: ILike(name),
                },
            });

        if (existingCategory) {
            throw new ConflictException(
                'This category already exists',
            );
        }

        // Préparer la catégorie.
        const category =
            this.categoriesRepository.create({
                name,
                description:
                    dto.description?.trim() ?? null,
            });

        try {
            // Enregistrer dans PostgreSQL.
            return await this.categoriesRepository.save(
                category,
            );
        } catch (error) {
            // Gérer une éventuelle erreur de doublon.
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string })
                    .code === '23505'
            ) {
                throw new ConflictException(
                    'This category already exists',
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 6. CRÉER UN MODÈLE AUTOMOBILE
    // ==========================================

    async createModel(
        dto: CreateVehicleModelDto,
    ): Promise<VehicleModel> {
        // Nettoyer les noms reçus.
        const brandName = dto.brandName.trim();
        const categoryName = dto.categoryName.trim();
        const name = dto.name.trim();

        // Rechercher la marque.
        const brand =
            await this.brandsRepository.findOne({
                where: {
                    name: ILike(brandName),
                },
            });

        if (!brand) {
            throw new NotFoundException(
                'Brand not found',
            );
        }

        // Rechercher la catégorie.
        const category =
            await this.categoriesRepository.findOne({
                where: {
                    name: ILike(categoryName),
                },
            });

        if (!category) {
            throw new NotFoundException(
                'Category not found',
            );
        }

        // Empêcher un modèle en double
        // pour la même marque.
        const existingModel =
            await this.modelsRepository.findOne({
                where: {
                    brandId: brand.id,
                    name: ILike(name),
                },
            });

        if (existingModel) {
            throw new ConflictException(
                'This vehicle model already exists',
            );
        }

        // Préparer le modèle avec les UUID
        // retrouvés automatiquement.
        const model =
            this.modelsRepository.create({
                brandId: brand.id,
                categoryId: category.id,
                name,
            });

        try {
            // Enregistrer le modèle.
            return await this.modelsRepository.save(
                model,
            );
        } catch (error) {
            // Gérer une éventuelle erreur d'unicité.
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string })
                    .code === '23505'
            ) {
                throw new ConflictException(
                    'This vehicle model already exists',
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 6bis. OUTILS DE SUPPRESSION
    // ==========================================
    //
    // Une marque, une catégorie ou un modèle est protégé
    // par des contraintes PostgreSQL RESTRICT.
    //
    // - Sans « force », on refuse avec un message clair.
    // - Avec « force », on supprime aussi les modèles et
    //   les véhicules liés (cascade), MAIS tout véhicule
    //   porteur de réservations ou d'avis reste protégé
    //   afin de préserver l'historique de location.

    // Détecte une violation de clé étrangère PostgreSQL
    // (code 23503) renvoyée par le moteur.
    private isForeignKeyViolation(error: unknown): boolean {
        return (
            error instanceof QueryFailedError &&
            (error.driverError as { code?: string }).code ===
                '23503'
        );
    }

    // Refuse la suppression d'une entrée encore utilisée
    // lorsque l'administrateur n'a pas demandé « force ».
    private assertNotInUse(
        label: string,
        dependents: number,
        dependentLabel: string,
    ): void {
        if (dependents > 0) {
            throw new ConflictException(
                `This ${label} is used by ${dependents} ${dependentLabel}. Use a forced delete to remove it together with them.`,
            );
        }
    }

    // Supprime, dans une seule transaction, les modèles
    // fournis puis les véhicules qui les utilisent.
    // « finish » supprime ensuite l'entrée d'origine
    // (marque ou catégorie) dans la même transaction.
    private async deleteModelsCascade(
        models: VehicleModel[],
        entityLabel: string,
        finish: (manager: EntityManager) => Promise<unknown>,
    ): Promise<void> {
        const modelIds = models.map((model) => model.id);

        try {
            await this.modelsRepository.manager.transaction(
                async (manager) => {
                    if (modelIds.length > 0) {
                        // Les véhicules liés partent d'abord ;
                        // s'ils portent des réservations ou des
                        // avis, PostgreSQL lève 23503 et toute
                        // la transaction est annulée.
                        await manager.delete(Vehicle, {
                            modelId: In(modelIds),
                        });

                        await manager.delete(VehicleModel, {
                            id: In(modelIds),
                        });
                    }

                    await finish(manager);
                },
            );
        } catch (error) {
            if (this.isForeignKeyViolation(error)) {
                throw new ConflictException(
                    `This ${entityLabel} contains vehicles with reservations or reviews. Delete those vehicles first to preserve rental history.`,
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 6ter. SUPPRIMER UNE MARQUE
    // ==========================================

    async deleteBrand(
        id: string,
        force = false,
    ): Promise<{ deleted: true }> {
        // Vérifier que la marque existe.
        const brand = await this.brandsRepository.findOne({
            where: { id },
        });

        if (!brand) {
            throw new NotFoundException(
                'Brand not found',
            );
        }

        // Modèles rattachés à la marque.
        const linkedModels =
            await this.modelsRepository.find({
                where: { brandId: id },
            });

        // Sans « force » : refus explicite si utilisée.
        if (!force) {
            this.assertNotInUse(
                'brand',
                linkedModels.length,
                'vehicle model(s)',
            );
        }

        // Avec « force » : suppression en cascade des
        // modèles et véhicules liés, puis de la marque.
        await this.deleteModelsCascade(
            linkedModels,
            'brand',
            (manager) =>
                manager.delete(Brand, { id: brand.id }),
        );

        return { deleted: true };
    }

    // ==========================================
    // 6quater. SUPPRIMER UNE CATÉGORIE
    // ==========================================

    async deleteCategory(
        id: string,
        force = false,
    ): Promise<{ deleted: true }> {
        // Vérifier que la catégorie existe.
        const category =
            await this.categoriesRepository.findOne({
                where: { id },
            });

        if (!category) {
            throw new NotFoundException(
                'Category not found',
            );
        }

        // Modèles rattachés à la catégorie.
        const linkedModels =
            await this.modelsRepository.find({
                where: { categoryId: id },
            });

        // Même logique que pour les marques.
        if (!force) {
            this.assertNotInUse(
                'category',
                linkedModels.length,
                'vehicle model(s)',
            );
        }

        await this.deleteModelsCascade(
            linkedModels,
            'category',
            (manager) =>
                manager.delete(Category, { id: category.id }),
        );

        return { deleted: true };
    }

    // ==========================================
    // 6quinquies. SUPPRIMER UN MODÈLE
    // ==========================================

    async deleteModel(
        id: string,
        force = false,
    ): Promise<{ deleted: true }> {
        // Vérifier que le modèle existe.
        const model = await this.modelsRepository.findOne({
            where: { id },
        });

        if (!model) {
            throw new NotFoundException(
                'Vehicle model not found',
            );
        }

        // Véhicules rattachés au modèle.
        const linkedVehicles =
            await this.vehiclesRepository.count({
                where: { modelId: id },
            });

        // Sans « force » : refus si le modèle est utilisé.
        if (!force) {
            this.assertNotInUse(
                'model',
                linkedVehicles,
                'vehicle(s)',
            );
        }

        // Avec « force » : suppression des véhicules liés
        // puis du modèle. « finish » n'a rien à faire, le
        // modèle est déjà retiré par la cascade.
        await this.deleteModelsCascade(
            [model],
            'model',
            async () => undefined,
        );

        return { deleted: true };
    }

    // ==========================================
    // 6sexies. SUPPRIMER UN VÉHICULE
    // ==========================================

    async deleteVehicle(
        licensePlate: string,
    ): Promise<{ deleted: true }> {
        // Normaliser l'immatriculation.
        const plate = licensePlate.trim().toUpperCase();

        const vehicle =
            await this.vehiclesRepository.findOne({
                where: { licensePlate: plate },
            });

        if (!vehicle) {
            throw new NotFoundException(
                'Vehicle not found',
            );
        }

        try {
            // Les médias, favoris, notifications et
            // indisponibilités liés sont supprimés en
            // cascade par PostgreSQL.
            await this.vehiclesRepository.remove(vehicle);
        } catch (error) {
            // Le code 23503 signale une contrainte de clé
            // étrangère (réservations, avis clients...).
            if (this.isForeignKeyViolation(error)) {
                throw new ConflictException(
                    'This vehicle has reservations or reviews and cannot be deleted.',
                );
            }

            throw error;
        }

        return { deleted: true };
    }

    // ==========================================
    // 7. CONSULTER LES VOITURES (ADMIN)
    // ==========================================

    async findAllVehicles(): Promise<Vehicle[]> {
        // Cette méthode retourne les données internes.
        // Elle est réservée aux administrateurs.
        const vehicles =
            await this.vehiclesRepository.find({
                relations: {
                    model: true,
                },

                order: {
                    createdAt: 'DESC',
                },
            });

        // ------------------------------------------
        // ASSOCIER LES PHOTOS
        // ------------------------------------------
        //
        // Les photos sont chargées séparément puis
        // rattachées à chaque voiture. Cela évite une
        // relation TypeORM circulaire entre les entités
        // Vehicle et VehicleImage.

        if (vehicles.length > 0) {
            const images =
                await this.vehicleImagesRepository.find({
                    where: {
                        vehicleId: In(
                            vehicles.map(
                                (vehicle) => vehicle.id,
                            ),
                        ),
                    },

                    order: {
                        isPrimary: 'DESC',
                        createdAt: 'DESC',
                    },
                });

            const imagesByVehicle =
                new Map<string, VehicleImage[]>();

            for (const image of images) {
                const list = imagesByVehicle.get(
                    image.vehicleId,
                );

                if (list) {
                    list.push(image);
                } else {
                    imagesByVehicle.set(
                        image.vehicleId,
                        [image],
                    );
                }
            }

            for (const vehicle of vehicles) {
                vehicle.images =
                    imagesByVehicle.get(vehicle.id) ?? [];
            }
        }

        return vehicles;
    }

    // ==========================================
    // 8. ENREGISTRER UNE VOITURE
    // ==========================================

    async createVehicle(
        dto: CreateVehicleDto,
    ): Promise<Vehicle> {
        // Nettoyer les informations reçues.
        const brandName = dto.brandName.trim();
        const modelName = dto.modelName.trim();

        const licensePlate =
            dto.licensePlate.trim().toUpperCase();

        const vin =
            dto.vin.trim().toUpperCase();

        // ------------------------------------------
        // A. RECHERCHER LA MARQUE
        // ------------------------------------------

        const brand =
            await this.brandsRepository.findOne({
                where: {
                    name: ILike(brandName),
                },
            });

        if (!brand) {
            throw new NotFoundException(
                'Brand not found',
            );
        }

        // ------------------------------------------
        // B. RECHERCHER LE MODÈLE
        // ------------------------------------------

        const model =
            await this.modelsRepository.findOne({
                where: {
                    brandId: brand.id,
                    name: ILike(modelName),
                },
            });

        if (!model) {
            throw new NotFoundException(
                'Vehicle model not found for this brand',
            );
        }

        // ------------------------------------------
        // C. VÉRIFIER L'IMMATRICULATION
        // ------------------------------------------

        const existingPlate =
            await this.vehiclesRepository.findOne({
                where: {
                    licensePlate,
                },
            });

        if (existingPlate) {
            throw new ConflictException(
                'This license plate already exists',
            );
        }

        // ------------------------------------------
        // D. VÉRIFIER LE NUMÉRO VIN
        // ------------------------------------------

        const existingVin =
            await this.vehiclesRepository.findOne({
                where: {
                    vin,
                },
            });

        if (existingVin) {
            throw new ConflictException(
                'This VIN already exists',
            );
        }

        // ------------------------------------------
        // E. PRÉPARER LA VOITURE
        // ------------------------------------------

        const vehicle =
            this.vehiclesRepository.create({
                // Associer automatiquement le modèle.
                modelId: model.id,

                manufactureYear:
                    dto.manufactureYear,

                licensePlate,
                vin,

                color:
                    dto.color?.trim() ?? null,

                transmission:
                    dto.transmission,

                fuelType:
                    dto.fuelType,

                seats:
                    dto.seats ?? 2,

                powerHp:
                    dto.powerHp ?? null,

                // PostgreSQL utilise le type NUMERIC.
                dailyPrice:
                    dto.dailyPrice.toFixed(2),

                securityDeposit:
                    dto.securityDeposit.toFixed(2),

                // Valeur du véhicule (toujours un nombre réel > 0).
                vehicleValue:
                    dto.vehicleValue.toFixed(2),

                mileageKm:
                    dto.mileageKm ?? 0,

                description:
                    dto.description?.trim() ?? null,

                // Caractéristiques éditoriales.
                engine:
                    dto.engine?.trim() ?? null,

                torqueNm:
                    dto.torqueNm ?? null,

                acceleration0To100:
                    dto.acceleration0To100 !== undefined
                        ? dto.acceleration0To100.toFixed(1)
                        : null,

                topSpeedKmh:
                    dto.topSpeedKmh ?? null,

                consumptionL100km:
                    dto.consumptionL100km !== undefined
                        ? dto.consumptionL100km.toFixed(1)
                        : null,

                isSpecial:
                    dto.isSpecial ?? false,

                isLimited:
                    dto.isLimited ?? false,

                editionSize:
                    dto.editionSize ?? null,

                // Une nouvelle voiture est active.
                status:
                    VehicleStatus.ACTIVE,
            });

        // ------------------------------------------
        // F. ENREGISTRER LA VOITURE
        // ------------------------------------------

        try {
            // Enregistrer la voiture.
            const savedVehicle =
                await this.vehiclesRepository.save(
                    vehicle,
                );

            // Publier automatiquement une notification :
            // édition limitée > édition spéciale > nouveau.
            await this.notificationsService
                .notifyNewVehicle({
                    vehicleId: savedVehicle.id,
                    brandName: brand.name,
                    modelName: model.name,
                    isSpecial:
                        savedVehicle.isSpecial === true,
                    isLimited:
                        savedVehicle.isLimited === true,
                    editionSize:
                        savedVehicle.editionSize ?? null,
                });

            return savedVehicle;
        } catch (error) {
            // Gérer les contraintes UNIQUE
            // sur l'immatriculation et le VIN.
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string })
                    .code === '23505'
            ) {
                throw new ConflictException(
                    'License plate or VIN already exists',
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 9. MODIFIER UNE VOITURE
    // ==========================================

    async updateVehicle(
        licensePlate: string,
        dto: UpdateVehicleDto,
    ): Promise<Vehicle> {
        // Nettoyer l'immatriculation.
        const plate =
            licensePlate.trim().toUpperCase();

        // Retrouver la voiture.
        const vehicle =
            await this.vehiclesRepository.findOne({
                where: {
                    licensePlate: plate,
                },
            });

        if (!vehicle) {
            throw new NotFoundException(
                'Vehicle not found',
            );
        }

        // Vérifier qu'au moins un champ
        // a été envoyé pour modification.
        const hasChanges = [
            dto.dailyPrice,
            dto.securityDeposit,
            dto.vehicleValue,
            dto.mileageKm,
            dto.status,
            dto.color,
            dto.description,
            dto.engine,
            dto.torqueNm,
            dto.acceleration0To100,
            dto.topSpeedKmh,
            dto.consumptionL100km,
            dto.isSpecial,
            dto.isLimited,
            dto.editionSize,
        ].some(
            (value) => value !== undefined,
        );

        if (!hasChanges) {
            throw new BadRequestException(
                'No vehicle information provided',
            );
        }

        // Le kilométrage ne peut pas diminuer.
        if (
            dto.mileageKm !== undefined &&
            dto.mileageKm < vehicle.mileageKm
        ) {
            throw new BadRequestException(
                'Mileage cannot be lower than current mileage',
            );
        }

        // Modifier le prix si nécessaire.
        if (dto.dailyPrice !== undefined) {
            vehicle.dailyPrice =
                dto.dailyPrice.toFixed(2);
        }

        // Modifier la caution si nécessaire.
        if (
            dto.securityDeposit !== undefined
        ) {
            vehicle.securityDeposit =
                dto.securityDeposit.toFixed(2);
        }

        // Modifier la valeur du véhicule si nécessaire.
        if (dto.vehicleValue !== undefined) {
            vehicle.vehicleValue =
                dto.vehicleValue.toFixed(2);
        }

        // Modifier le kilométrage si nécessaire.
        if (dto.mileageKm !== undefined) {
            vehicle.mileageKm =
                dto.mileageKm;
        }

        // Modifier le statut si nécessaire.
        if (dto.status !== undefined) {
            vehicle.status =
                dto.status;
        }

        // Modifier ou supprimer la couleur.
        if (dto.color !== undefined) {
            vehicle.color =
                dto.color === null
                    ? null
                    : dto.color.trim() || null;
        }

        // Modifier ou supprimer la description.
        if (dto.description !== undefined) {
            vehicle.description =
                dto.description === null
                    ? null
                    : dto.description.trim() || null;
        }

        // Modifier ou supprimer la motorisation.
        if (dto.engine !== undefined) {
            vehicle.engine =
                dto.engine === null
                    ? null
                    : dto.engine.trim() || null;
        }

        // Modifier le couple.
        if (dto.torqueNm !== undefined) {
            vehicle.torqueNm = dto.torqueNm;
        }

        // Modifier le 0 à 100 km/h.
        if (dto.acceleration0To100 !== undefined) {
            vehicle.acceleration0To100 =
                dto.acceleration0To100 !== null
                    ? dto.acceleration0To100.toFixed(1)
                    : null;
        }

        // Modifier la vitesse maximale.
        if (dto.topSpeedKmh !== undefined) {
            vehicle.topSpeedKmh = dto.topSpeedKmh;
        }

        // Modifier la consommation.
        if (dto.consumptionL100km !== undefined) {
            vehicle.consumptionL100km =
                dto.consumptionL100km !== null
                    ? dto.consumptionL100km.toFixed(1)
                    : null;
        }

        // Modifier les marqueurs d'édition.
        if (dto.isSpecial !== undefined) {
            vehicle.isSpecial = dto.isSpecial;
        }

        if (dto.isLimited !== undefined) {
            vehicle.isLimited = dto.isLimited;
        }

        if (dto.editionSize !== undefined) {
            vehicle.editionSize = dto.editionSize;
        }

        // Enregistrer les modifications.
        return await this.vehiclesRepository.save(
            vehicle,
        );
    }

    // Médias publics d'une voiture : la galerie utilise les fichiers réels.
    async getPublicMedia(vehicleId:string) {
        const vehicle=await this.vehiclesRepository.findOne({where:{id:vehicleId,status:VehicleStatus.ACTIVE}});
        if(!vehicle) throw new NotFoundException('Vehicle not found');
        const media=await this.vehicleImagesRepository.find({where:{vehicleId},order:{isPrimary:'DESC',sortOrder:'ASC',createdAt:'DESC'}});
        const model=await this.model3dState(vehicleId);
        return {
          photos:media.filter(m=>m.mediaType===MediaType.IMAGE).map(m=>({id:m.id,url:m.storagePath,alt:m.altText??'Vehicle photo'})),
          videos:media.filter(m=>m.mediaType===MediaType.VIDEO).map(m=>({id:m.id,url:m.storagePath,poster:m.posterPath})),
          ...model,
        };
    }

    // Référence 3D courante du véhicule (GLB local), sans restriction de statut.
    private async model3dState(vehicleId:string): Promise<{modelUrl:string|null}> {
        const models:{model_path:string}[]=await this.vehiclesRepository.manager.query(
          `SELECT model_path FROM vehicle_3d_models WHERE vehicle_id=$1::uuid`,[vehicleId]);
        return {modelUrl:models[0]?.model_path??null};
    }

    // Showroom 3D courant (admin), lu par immatriculation.
    async getModel3dState(licensePlate:string) {
        const vehicle=await this.vehiclesRepository.findOne({where:{licensePlate:licensePlate.trim().toUpperCase()}});
        if(!vehicle) throw new NotFoundException('Vehicle not found');
        return {vehicleId:vehicle.id,...await this.model3dState(vehicle.id)};
    }

    // Galerie supplémentaire : ne remplace pas la photo/vidéo principale.
    async addGalleryMedia(licensePlate:string, kind:'image'|'video', file:UploadedImageFile|undefined) {
        if(!file?.buffer?.length) throw new BadRequestException('A media file is required');
        if(kind==='image' && !isAllowedImageMime(file.mimetype)) throw new BadRequestException('Invalid image MIME type');
        if(kind==='video' && !isAllowedVideoMime(file.mimetype)) throw new BadRequestException('Invalid video MIME type');
        const vehicle=await this.vehiclesRepository.findOne({where:{licensePlate:licensePlate.trim().toUpperCase()}});
        if(!vehicle) throw new NotFoundException('Vehicle not found');
        const storagePath=await storeVehicleMedia(file,vehicle.licensePlate,kind);
        try {
          const count=await this.vehicleImagesRepository.count({where:{vehicleId:vehicle.id,mediaType:kind=== 'image'?MediaType.IMAGE:MediaType.VIDEO}});
          const row=this.vehicleImagesRepository.create({vehicleId:vehicle.id,storagePath,
            mediaType:kind==='image'?MediaType.IMAGE:MediaType.VIDEO,
            altText:`${vehicle.licensePlate} — ${kind} ${count+1}`,isPrimary:count===0,sortOrder:count});
          return await this.vehicleImagesRepository.save(row);
        } catch(error){await removeStoredVehicleMedia(storagePath);throw error;}
    }

    // Stockage GLB sécurisé, vérifié par signature glTF et servi depuis Next.js.
    async saveVehicle3d(licensePlate:string,file:UploadedImageFile|undefined) {
        if(!file?.buffer || file.buffer.length<20 || file.buffer.length>40*1024*1024 ||
            file.buffer.toString('ascii',0,4)!=='glTF' || file.buffer.readUInt32LE(4)!==2 ||
            file.buffer.readUInt32LE(8)!==file.buffer.length) {
          throw new BadRequestException('A valid GLB v2 file (max 40 MB) is required');
        }
        const vehicle=await this.vehiclesRepository.findOne({where:{licensePlate:licensePlate.trim().toUpperCase()}});
        if(!vehicle) throw new NotFoundException('Vehicle not found');
        const dir=join(vehicleImagesDir(),'models');await mkdir(dir,{recursive:true});
        const filename=`${randomUUID()}.glb`;
        const absolute=join(dir,filename);
        await writeFile(absolute,file.buffer,{flag:'wx'});
        const url=`/vehicles/models/${filename}`;
        try {
          const old=await this.vehiclesRepository.manager.transaction(async (manager) => {
            const previous:{model_path:string}[]=await manager.query(
              `SELECT model_path FROM vehicle_3d_models WHERE vehicle_id=$1::uuid`,[vehicle.id]);
            await manager.query(
              `INSERT INTO vehicle_3d_models(vehicle_id,model_path) VALUES($1,$2)
               ON CONFLICT(vehicle_id) DO UPDATE SET model_path=excluded.model_path,uploaded_at=now()`,[vehicle.id,url]);
            return previous[0]?.model_path ?? null;
          });
          if(old && /^\/vehicles\/models\/[0-9a-f-]{36}\.glb$/.test(old))
            await unlink(join(dir,old.split('/').pop()!)).catch(()=>{});
        } catch(error){await unlink(absolute).catch(()=>{});throw error;}
        return {vehicleId:vehicle.id,modelUrl:url};
    }

    // ==========================================
    // 9 bis. ENREGISTRER LA PHOTO D'UN VÉHICULE
    // ==========================================
    //
    // Reçoit un fichier image (multer, en mémoire) et
    // l'associe à la voiture identifiée par son
    // immatriculation.
    //
    // La photo devient la photo principale de la voiture :
    // l'ancienne est remplacée (fichier + ligne).

    async saveVehicleImage(
        licensePlate: string,
        file: UploadedImageFile | undefined,
    ): Promise<VehicleImage> {
        return this.saveVehicleMedia(
            licensePlate,
            file,
            MediaType.IMAGE,
        );
    }

    // ==========================================
    // 9 ter. ENREGISTRER LA VIDÉO D'UN VÉHICULE
    // ==========================================
    //
    // Même principe que la photo : la vidéo devient le
    // média principal de type « video » et remplace
    // l'ancienne.

    async saveVehicleVideo(
        licensePlate: string,
        file: UploadedImageFile | undefined,
    ): Promise<VehicleImage> {
        return this.saveVehicleMedia(
            licensePlate,
            file,
            MediaType.VIDEO,
        );
    }

    // ==========================================
    // 9 quater. ENREGISTRER UN MÉDIA D'UN VÉHICULE
    // ==========================================
    //
    // Méthode commune aux photos et aux vidéos :
    // validation du fichier, écriture sur le disque,
    // puis remplacement de l'ancien média principal du
    // même type.

    private async saveVehicleMedia(
        licensePlate: string,
        file: UploadedImageFile | undefined,
        kind: MediaType,
    ): Promise<VehicleImage> {
        const isVideo = kind === MediaType.VIDEO;

        // ------------------------------------------
        // A. VÉRIFIER LE FICHIER
        // ------------------------------------------

        if (
            !file ||
            !file.buffer ||
            file.buffer.length === 0
        ) {
            throw new BadRequestException(
                isVideo
                    ? 'No video file was uploaded'
                    : 'No image file was uploaded',
            );
        }

        const allowed = isVideo
            ? isAllowedVideoMime(file.mimetype)
            : isAllowedImageMime(file.mimetype);

        if (!allowed) {
            throw new BadRequestException(
                isVideo
                    ? 'Only MP4, WEBM, OGG or MOV videos are allowed'
                    : 'Only JPEG, PNG, WEBP, AVIF or GIF images are allowed',
            );
        }

        // ------------------------------------------
        // B. RETROUVER LA VOITURE
        // ------------------------------------------

        const plate = licensePlate
            .trim()
            .toUpperCase();

        const vehicle =
            await this.vehiclesRepository.findOne({
                where: {
                    licensePlate: plate,
                },
            });

        if (!vehicle) {
            throw new NotFoundException(
                'Vehicle not found',
            );
        }

        // ------------------------------------------
        // C. ENREGISTRER LE FICHIER SUR LE DISQUE
        // ------------------------------------------

        const storagePath =
            await storeVehicleMedia(
                file,
                plate,
                isVideo ? 'video' : 'image',
            );

        // ------------------------------------------
        // D. REMPLACER LE MÉDIA PRINCIPAL DU MÊME TYPE
        // ------------------------------------------

        const previous =
            await this.vehicleImagesRepository.findOne({
                where: {
                    vehicleId: vehicle.id,
                    mediaType: kind,
                    isPrimary: true,
                },
            });

        let image: VehicleImage;

        if (previous) {
            // Supprimer l'ancien fichier (meilleur effort).
            await removeStoredVehicleMedia(
                previous.storagePath,
            );

            previous.storagePath = storagePath;
            previous.altText = `${
                isVideo ? 'Video' : 'Photo'
            } ${plate}`;
            previous.createdAt = new Date();

            image = previous;
        } else {
            image = this.vehicleImagesRepository.create({
                vehicleId: vehicle.id,
                storagePath,
                mediaType: kind,
                altText: `${isVideo ? 'Video' : 'Photo'} ${plate}`,
                isPrimary: true,
                sortOrder: 0,
            });
        }

        return await this.vehicleImagesRepository.save(
            image,
        );
    }

    // ==========================================
    // 9 quinquies. SUPPRIMER LA PHOTO D'UN VÉHICULE
    // ==========================================

    async deleteVehicleImage(
        licensePlate: string,
    ): Promise<{
        deleted: number;
        storagePaths: string[];
    }> {
        return this.deleteVehicleMedia(
            licensePlate,
            MediaType.IMAGE,
        );
    }

    // ==========================================
    // 9 sexies. SUPPRIMER LA VIDÉO D'UN VÉHICULE
    // ==========================================

    async deleteVehicleVideo(
        licensePlate: string,
    ): Promise<{
        deleted: number;
        storagePaths: string[];
    }> {
        return this.deleteVehicleMedia(
            licensePlate,
            MediaType.VIDEO,
        );
    }

    // ==========================================
    // 9 sexies bis. SUPPRIMER UN MÉDIA PAR SON ID
    // ==========================================
    //
    // Supprime UNE SEULE photo (ou vidéo) de la galerie
    // d'un véhicule : le fichier sur le disque et la ligne
    // correspondante en base.
    //
    // Si le média supprimé était le média principal, le média
    // restant du même type le plus ancien est promu principal
    // afin que le catalogue conserve un visuel.

    async deleteVehicleMediaById(
        mediaId: string,
    ): Promise<{
        deleted: number;
        id: string;
        vehicleId: string;
        mediaType: MediaType;
    }> {
        // ------------------------------------------
        // A. RETROUVER LE MÉDIA
        // ------------------------------------------

        const media =
            await this.vehicleImagesRepository.findOne({
                where: {
                    id: mediaId,
                },
            });

        if (!media) {
            throw new NotFoundException(
                'Media not found',
            );
        }

        const { id: mediaRowId, vehicleId, mediaType, isPrimary } =
            media;

        // ------------------------------------------
        // B. EFFACER LE FICHIER SUR LE DISQUE
        // ------------------------------------------

        await removeStoredVehicleMedia(
            media.storagePath,
        );

        // ------------------------------------------
        // C. EFFACER LA LIGNE EN BASE
        // ------------------------------------------

        await this.vehicleImagesRepository.remove(
            media,
        );

        // ------------------------------------------
        // D. PROMOUVOIR UNE NOUVELLE PHOTO PRINCIPALE
        // ------------------------------------------

        if (isPrimary) {
            const remaining =
                await this.vehicleImagesRepository.find({
                    where: {
                        vehicleId,
                        mediaType,
                    },

                    order: {
                        sortOrder: 'ASC',
                        createdAt: 'ASC',
                    },
                });

            if (remaining.length > 0) {
                remaining[0].isPrimary = true;

                await this.vehicleImagesRepository.save(
                    remaining[0],
                );
            }
        }

        return {
            deleted: 1,
            id: mediaRowId,
            vehicleId,
            mediaType,
        };
    }

    // ==========================================
    // 9 septies. SUPPRIMER UN MÉDIA D'UN VÉHICULE
    // ==========================================
    //
    // Supprime la photo OU la vidéo d'une voiture : les
    // fichiers sur le disque et les lignes correspondantes
    // en base de données.

    private async deleteVehicleMedia(
        licensePlate: string,
        kind: MediaType,
    ): Promise<{
        deleted: number;
        storagePaths: string[];
    }> {
        const isVideo = kind === MediaType.VIDEO;

        // ------------------------------------------
        // A. RETROUVER LA VOITURE
        // ------------------------------------------

        const plate = licensePlate
            .trim()
            .toUpperCase();

        const vehicle =
            await this.vehiclesRepository.findOne({
                where: {
                    licensePlate: plate,
                },
            });

        if (!vehicle) {
            throw new NotFoundException(
                'Vehicle not found',
            );
        }

        // ------------------------------------------
        // B. RETROUVER LES MÉDIAS À SUPPRIMER
        // ------------------------------------------

        const medias =
            await this.vehicleImagesRepository.find({
                where: {
                    vehicleId: vehicle.id,
                    mediaType: kind,
                },
            });

        if (medias.length === 0) {
            throw new NotFoundException(
                isVideo
                    ? 'No video to delete for this vehicle'
                    : 'No photo to delete for this vehicle',
            );
        }

        // ------------------------------------------
        // C. EFFACER LES FICHIERS SUR LE DISQUE
        // ------------------------------------------

        for (const media of medias) {
            await removeStoredVehicleMedia(
                media.storagePath,
            );
        }

        // ------------------------------------------
        // D. EFFACER LES LIGNES EN BASE
        // ------------------------------------------

        await this.vehicleImagesRepository.remove(
            medias,
        );

        return {
            deleted: medias.length,
            storagePaths: medias.map(
                (media) => media.storagePath,
            ),
        };
    }

    // ==========================================
    // MÉTHODE PRIVÉE : DONNÉES PUBLIQUES
    // ==========================================

    private publicVehicleQuery():
        SelectQueryBuilder<Vehicle> {

        // Construire la requête commune au catalogue
        // et à la recherche de disponibilité.
        //
        // Nous sélectionnons seulement les données
        // que les visiteurs peuvent consulter.

        return this.vehiclesRepository
            .createQueryBuilder('vehicle')

            // Associer la voiture à son modèle.
            .innerJoin(
                'vehicle.model',
                'model',
            )

            // Associer le modèle à sa marque.
            .innerJoin(
                Brand,
                'brand',
                'brand.id = model.brandId',
            )

            // Associer le modèle à sa catégorie.
            .innerJoin(
                Category,
                'category',
                'category.id = model.categoryId',
            )

            // Identifiant public de la voiture.
            .select(
                'vehicle.id',
                'id',
            )

            // Marque, modèle et catégorie.
            .addSelect(
                'brand.name',
                'brandName',
            )

            .addSelect(
                'model.name',
                'modelName',
            )

            .addSelect(
                'category.name',
                'categoryName',
            )

            // Caractéristiques publiques.
            .addSelect(
                'vehicle.manufactureYear',
                'manufactureYear',
            )

            .addSelect(
                'vehicle.color',
                'color',
            )

            .addSelect(
                'vehicle.transmission',
                'transmission',
            )

            .addSelect(
                'vehicle.fuelType',
                'fuelType',
            )

            .addSelect(
                'vehicle.seats',
                'seats',
            )

            .addSelect(
                'vehicle.powerHp',
                'powerHp',
            )

            // Prix et description.
            .addSelect(
                'vehicle.dailyPrice',
                'dailyPrice',
            )

            .addSelect(
                'vehicle.securityDeposit',
                'securityDeposit',
            )

            .addSelect(
                'vehicle.vehicleValue',
                'vehicleValue',
            )

            .addSelect(
                'vehicle.description',
                'description',
            )

            // Caractéristiques éditoriales.
            .addSelect(
                'vehicle.engine',
                'engine',
            )

            .addSelect(
                'vehicle.torqueNm',
                'torqueNm',
            )

            .addSelect(
                'vehicle.acceleration0To100',
                'acceleration0To100',
            )

            .addSelect(
                'vehicle.topSpeedKmh',
                'topSpeedKmh',
            )

            .addSelect(
                'vehicle.consumptionL100km',
                'consumptionL100km',
            )

            .addSelect(
                'vehicle.isSpecial',
                'isSpecial',
            )

            .addSelect(
                'vehicle.isLimited',
                'isLimited',
            )

            .addSelect(
                'vehicle.editionSize',
                'editionSize',
            )

            .addSelect(
                'vehicle.announcedAt',
                'announcedAt',
            )

            // Photo principale du véhicule (image réelle).
            .addSelect(
                `(
                    SELECT image.storage_path
                    FROM vehicle_images image
                    WHERE image.vehicle_id = vehicle.id
                      AND image.media_type = 'image'
                      AND image.is_primary = true
                    LIMIT 1
                )`,
                'imageUrl',
            )

            // Vidéo principale du véhicule (facultative).
            .addSelect(
                `(
                    SELECT media.storage_path
                    FROM vehicle_images media
                    WHERE media.vehicle_id = vehicle.id
                      AND media.media_type = 'video'
                      AND media.is_primary = true
                    LIMIT 1
                )`,
                'videoUrl',
            )

            // Nombre de réservations honorées : classement
            // des voitures les plus louées.
            .addSelect(
                `(
                    SELECT COUNT(*)::int
                    FROM reservations reservation
                    WHERE reservation.vehicle_id = vehicle.id
                      AND reservation.status IN (
                          'confirmed',
                          'converted'
                      )
                )`,
                'reservationCount',
            );
    }

    // ============================================================
    // RÉCUPÉRATION NON DESTRUCTIVE DES PHOTOS EXISTANTES
    // ============================================================
    // Certaines anciennes installations possèdent les photos
    // frontend/public/vehicles/lc-0001-....png sans ligne correspondante
    // dans vehicle_images. Nous ne modifions JAMAIS la base ici :
    // une photo locale est utilisée uniquement en secours.
    // L'immatriculation temporaire utilisée pour la recherche
    // n'est jamais envoyée au navigateur.
    private async restoreLocalCatalogPhotos(
        rows: Array<PublicVehicleDto & { _localPhotoPlate: string }>,
    ): Promise<PublicVehicleDto[]> {
        const photoDir = vehicleImagesDir();
        let filenames: string[];
        try {
            filenames = (await readdir(photoDir))
                .filter(name => /\.(png|jpe?g|webp|avif|gif)$/i.test(name))
                .sort((a, b) => b.localeCompare(a));
        } catch {
            // Le catalogue doit rester consultable sans le dossier public.
            filenames = [];
        }

        const matches = new Map<string, string>();
        for (const filename of filenames) {
            const match = /^(lc-\d{4})-(?:image-)?\d+\.(?:png|jpe?g|webp|avif|gif)$/i.exec(filename);
            if (match && !matches.has(match[1].toLowerCase())) {
                matches.set(match[1].toLowerCase(), filename);
            }
        }

        return Promise.all(rows.map(async ({ _localPhotoPlate, ...vehicle }) => {
            const plate = (_localPhotoPlate ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const filename = matches.get(plate);
            if (!filename) return vehicle;

            // Une URL distante ou une photo locale existante a priorité.
            if (vehicle.imageUrl && !vehicle.imageUrl.startsWith('/vehicles/')) {
                return vehicle;
            }
            if (vehicle.imageUrl?.startsWith('/vehicles/')) {
                const imageFilename = basename(vehicle.imageUrl);
                try {
                    await access(join(photoDir, imageFilename));
                    return vehicle;
                } catch {
                    // Photo référencée absente : secours par immatriculation.
                }
            }
            return { ...vehicle, imageUrl: `/vehicles/${filename}` };
        }));
    }

    // ==========================================
    // 10. CONSULTER LE CATALOGUE PUBLIC
    // ==========================================

    async findPublicCatalog():
        Promise<PublicVehicleDto[]> {

        // Le catalogue présente uniquement
        // les voitures administrativement actives.
        //
        // Il ne vérifie pas encore si elles sont
        // libres pendant une période précise.

        const rows = await this.publicVehicleQuery()
            .addSelect('vehicle.licensePlate', '_localPhotoPlate')

            .where(
                'vehicle.status = :status',
                {
                    status: VehicleStatus.ACTIVE,
                },
            )

            .orderBy(
                'brand.name',
                'ASC',
            )

            .addOrderBy(
                'model.name',
                'ASC',
            )

            .getRawMany<PublicVehicleDto & { _localPhotoPlate: string }>();

        return this.restoreLocalCatalogPhotos(rows);
    }

    // ==========================================
    // MÉTHODE PRIVÉE : CONVERTIR UNE DATE
    // ==========================================

    private parseDate(
        value: string,
        fieldName: string,
    ): Date {
        // Construire une date UTC à minuit.
        //
        // Exemple :
        // 2026-10-15 devient
        // 2026-10-15T00:00:00.000Z.

        const date = new Date(
            `${value}T00:00:00.000Z`,
        );

        // Vérifier que la date existe réellement.
        // Cela permet de refuser des dates
        // incorrectes, comme le 30 février.
        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== value
        ) {
            throw new BadRequestException(
                `${fieldName} must be a valid date`,
            );
        }

        return date;
    }

    // ==========================================
    // 11. RECHERCHER LES VOITURES DISPONIBLES
    // ==========================================

    async findAvailableVehicles(
        dto: CheckAvailabilityDto,
    ): Promise<PublicVehicleDto[]> {

        // ------------------------------------------
        // A. CONVERTIR LES DATES
        // ------------------------------------------

        const startAt = this.parseDate(
            dto.from,
            'from',
        );

        const endAt = this.parseDate(
            dto.to,
            'to',
        );

        // ------------------------------------------
        // B. VÉRIFIER L'ORDRE DES DATES
        // ------------------------------------------

        // La date de retour doit être
        // postérieure à la date de départ.
        if (endAt <= startAt) {
            throw new BadRequestException(
                'Return date must be after pickup date',
            );
        }

        // ------------------------------------------
        // C. RECHERCHER LES VOITURES DISPONIBLES
        // ------------------------------------------

        // La fonction PostgreSQL
        // find_available_vehicles()
        // vérifie automatiquement :
        //
        // 1. Le statut active de la voiture.
        // 2. L'absence de réservation incompatible.
        // 3. L'absence de maintenance programmée.
        //
        // Les paramètres sont transmis séparément
        // afin de ne jamais construire une requête SQL
        // avec des dates concaténées manuellement.

        const rows = await this.publicVehicleQuery()
            .addSelect('vehicle.licensePlate', '_localPhotoPlate')

            .where(
                'vehicle.status = :status',
                {
                    status: VehicleStatus.ACTIVE,
                },
            )

            .andWhere(
                `vehicle.id IN (
          SELECT available.id
          FROM find_available_vehicles(
            CAST(:startAt AS timestamptz),
            CAST(:endAt AS timestamptz)
          ) AS available
        )`,
                {
                    startAt: startAt.toISOString(),
                    endAt: endAt.toISOString(),
                },
            )

            // Afficher les résultats par marque
            // puis par nom de modèle.
            .orderBy(
                'brand.name',
                'ASC',
            )

            .addOrderBy(
                'model.name',
                'ASC',
            )

            // Retourner uniquement les
            // informations du catalogue public.
            .getRawMany<PublicVehicleDto & { _localPhotoPlate: string }>();

        return this.restoreLocalCatalogPhotos(rows);
    }
}
