
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
    QueryFailedError,
    Repository,
} from 'typeorm';

// Importer l'entité du profil client.
import {
    CustomerProfile,
} from './entities/customer-profile.entity.js';

// Importer le DTO de création.
import {
    CreateCustomerProfileDto,
} from './dto/create-customer-profile.dto.js';

@Injectable()
export class CustomerProfilesService {
    constructor(
        // Ce repository permet de travailler
        // avec la table customer_profiles.
        @InjectRepository(CustomerProfile)
        private readonly profilesRepository:
            Repository<CustomerProfile>,
    ) { }

    // ==========================================
    // 1. VÉRIFIER UNE DATE
    // ==========================================

    private parseDate(
        value: string,
        fieldName: string,
    ): Date {
        // Convertir la date reçue en date UTC.
        const date = new Date(
            `${value}T00:00:00.000Z`,
        );

        // Refuser une date invalide,
        // par exemple le 30 février.
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
    // 1.b VALIDER ET PRÉPARER LES DONNÉES
    // ==========================================

    // Les mêmes règles sont appliquées à la
    // création et à la mise à jour du profil.
    private buildValidatedProfile(
        dto: CreateCustomerProfileDto,
    ) {
        const dateOfBirth = this.parseDate(
            dto.dateOfBirth,
            'dateOfBirth',
        );

        const licenseIssuedOn = this.parseDate(
            dto.licenseIssuedOn,
            'licenseIssuedOn',
        );

        const licenseExpiresOn = this.parseDate(
            dto.licenseExpiresOn,
            'licenseExpiresOn',
        );

        // Obtenir la date actuelle à minuit UTC.
        const today = new Date();

        today.setUTCHours(0, 0, 0, 0);

        // La date de naissance doit être
        // antérieure à la date actuelle.
        if (dateOfBirth >= today) {
            throw new BadRequestException(
                'Date of birth must be in the past',
            );
        }

        // La date de délivrance du permis
        // ne peut pas être dans le futur.
        if (licenseIssuedOn > today) {
            throw new BadRequestException(
                'License issue date cannot be in the future',
            );
        }

        // Le permis ne peut pas avoir été délivré
        // avant la naissance du client.
        if (licenseIssuedOn <= dateOfBirth) {
            throw new BadRequestException(
                'License issue date must be after date of birth',
            );
        }

        // La date d'expiration doit être
        // postérieure à la date de délivrance.
        if (licenseExpiresOn <= licenseIssuedOn) {
            throw new BadRequestException(
                'License expiry must be after issue date',
            );
        }

        // Refuser un permis déjà expiré.
        if (licenseExpiresOn < today) {
            throw new BadRequestException(
                'Driving license has expired',
            );
        }

        // Les champs texte sont nettoyés
        // avant l'enregistrement en base.
        return {
            dateOfBirth:
                dto.dateOfBirth,

            addressLine:
                dto.addressLine?.trim() ?? null,

            city:
                dto.city?.trim() ?? null,

            postalCode:
                dto.postalCode?.trim() ?? null,

            country:
                dto.country?.trim().toUpperCase() ?? null,

            licenseNumber:
                dto.licenseNumber.trim(),

            licenseCountry:
                dto.licenseCountry.trim().toUpperCase(),

            licenseIssuedOn:
                dto.licenseIssuedOn,

            licenseExpiresOn:
                dto.licenseExpiresOn,
        };
    }

    // ==========================================
    // 1.c GÉRER UNE CONTRAINTE UNIQUE
    // ==========================================

    private isUniqueViolation(
        error: unknown,
    ): boolean {
        // Le code PostgreSQL 23505 indique
        // une violation de contrainte UNIQUE.
        return (
            error instanceof QueryFailedError &&
            (error.driverError as { code?: string })
                .code === '23505'
        );
    }

    // ==========================================
    // 2. CRÉER LE PROFIL DU CLIENT
    // ==========================================

    async createProfile(
        userId: string,
        dto: CreateCustomerProfileDto,
    ): Promise<CustomerProfile> {

        // ------------------------------------------
        // A. VÉRIFIER SI LE PROFIL EXISTE DÉJÀ
        // ------------------------------------------

        // Chaque utilisateur ne peut posséder
        // qu'un seul profil client.
        const existingProfile =
            await this.profilesRepository.findOne({
                where: {
                    userId,
                },
            });

        if (existingProfile) {
            throw new ConflictException(
                'Customer profile already exists',
            );
        }

        // ------------------------------------------
        // B. VALIDER LES DONNÉES
        // ------------------------------------------

        const data =
            this.buildValidatedProfile(dto);

        // ------------------------------------------
        // C. ENREGISTRER DANS POSTGRESQL
        // ------------------------------------------

        // L'identifiant provient du JWT.
        // Le client ne saisit jamais son UUID.
        const profile =
            this.profilesRepository.create({
                userId,
                ...data,
            });

        try {
            return await this.profilesRepository.save(
                profile,
            );
        } catch (error) {
            if (this.isUniqueViolation(error)) {
                throw new ConflictException(
                    'Customer profile or driving license already exists',
                );
            }

            // Transmettre les autres erreurs à NestJS.
            throw error;
        }
    }

    // ==========================================
    // 2.b METTRE À JOUR LE PROFIL DU CLIENT
    // ==========================================

    async updateProfile(
        userId: string,
        dto: CreateCustomerProfileDto,
    ): Promise<CustomerProfile> {

        // ------------------------------------------
        // A. RETROUVER LE PROFIL EXISTANT
        // ------------------------------------------

        const profile =
            await this.profilesRepository.findOne({
                where: {
                    userId,
                },
            });

        if (!profile) {
            throw new NotFoundException(
                'Customer profile not found',
            );
        }

        // ------------------------------------------
        // B. VALIDER LES DONNÉES
        // ------------------------------------------

        const data =
            this.buildValidatedProfile(dto);

        // ------------------------------------------
        // C. APPLIQUER ET ENREGISTRER
        // ------------------------------------------

        this.profilesRepository.merge(
            profile,
            data,
        );

        try {
            return await this.profilesRepository.save(
                profile,
            );
        } catch (error) {
            if (this.isUniqueViolation(error)) {
                throw new ConflictException(
                    'Driving license already exists',
                );
            }

            // Transmettre les autres erreurs à NestJS.
            throw error;
        }
    }

    // ==========================================
    // 3. CONSULTER SON PROFIL CLIENT
    // ==========================================

    async findMyProfile(
        userId: string,
    ): Promise<CustomerProfile> {

        // Rechercher uniquement le profil
        // de l'utilisateur connecté.
        const profile =
            await this.profilesRepository.findOne({
                where: {
                    userId,
                },
            });

        // Retourner 404 si le client n'a pas
        // encore complété son profil.
        if (!profile) {
            throw new NotFoundException(
                'Customer profile not found',
            );
        }

        return profile;
    }
}
