
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    BadRequestException,
    ConflictException,
} from '@nestjs/common';

import type {
    DataSource,
    Repository,
} from 'typeorm';

// Service que nous voulons tester.
import {
    ReservationsService,
} from './reservations.service.js';

// Entités utilisées par le service.
import {
    CustomerProfile,
} from '../customer-profiles/entities/customer-profile.entity.js';

import {
    Reservation,
    ReservationStatus,
} from './entities/reservation.entity.js';

// DTO utilisé pour créer une réservation.
import {
    CreateReservationDto,
} from './dto/create-reservation.dto.js';

describe('ReservationsService', () => {
    // Faux repository du profil client.
    let profilesRepository: {
        findOne: ReturnType<typeof vi.fn>;
    };

    // Faux repository utilisé dans la transaction.
    let transactionRepository: {
        create: ReturnType<typeof vi.fn>;
        save: ReturnType<typeof vi.fn>;
        findOne: ReturnType<typeof vi.fn>;
    };

    // Faux gestionnaire PostgreSQL.
    let manager: {
        query: ReturnType<typeof vi.fn>;
        getRepository: ReturnType<typeof vi.fn>;
    };

    // Fausse connexion PostgreSQL.
    let dataSource: {
        transaction: ReturnType<typeof vi.fn>;
    };

    // Service que nous allons tester.
    let service: ReservationsService;

    // Informations fictives d'une réservation.
    let dto: CreateReservationDto;

    beforeEach(() => {
        // ========================================
        // 1. PRÉPARER LA DEMANDE DU CLIENT
        // ========================================

        dto = {
            brandName: 'Porsche',
            modelName: 'Cayenne',
            pickupDate: '2035-11-25',
            returnDate: '2035-11-28',
            customerNotes: 'Réservation de test',
        };

        // ========================================
        // 2. SIMULER UN PROFIL CLIENT COMPLET
        // ========================================

        profilesRepository = {
            findOne: vi.fn().mockResolvedValue({
                userId: 'customer-test-id',

                // Le permis est valide pendant
                // toute la période de location.
                licenseExpiresOn: '2040-12-31',
            } as CustomerProfile),
        };

        // ========================================
        // 3. SIMULER LA TABLE RESERVATIONS
        // ========================================

        // Cette variable représente une réservation
        // enregistrée par le faux repository.
        let storedReservation:
            Reservation | null = null;

        transactionRepository = {
            // Préparer une réservation fictive.
            create: vi.fn(
                (values: Partial<Reservation>) => ({
                    id: 'reservation-test-id',
                    ...values,
                } as Reservation),
            ),

            // Simuler son enregistrement.
            save: vi.fn(
                async (reservation: Reservation) => {
                    storedReservation = reservation;

                    return reservation;
                },
            ),

            // Simuler sa relecture après création.
            findOne: vi.fn(
                async () => storedReservation,
            ),
        };

        // ========================================
        // 4. SIMULER UNE VOITURE DISPONIBLE
        // ========================================

        manager = {
            // Simuler le résultat de la recherche SQL.
            query: vi.fn().mockResolvedValue([
                {
                    id: 'vehicle-test-id',
                    daily_price: '320.00',
                    security_deposit: '2800.00',
                },
            ]),

            // Fournir le faux repository
            // pendant la transaction.
            getRepository: vi.fn(
                () => transactionRepository,
            ),
        };

        // ========================================
        // 5. SIMULER UNE TRANSACTION
        // ========================================

        // Exécuter la fonction de la transaction
        // sans ouvrir une véritable connexion SQL.
        dataSource = {
            transaction: vi.fn(
                async (
                    callback: (
                        entityManager: typeof manager,
                    ) => Promise<Reservation>,
                ) => callback(manager),
            ),
        };

        // ========================================
        // 6. CRÉER LE SERVICE À TESTER
        // ========================================

        service = new ReservationsService(
            profilesRepository as unknown as
            Repository<CustomerProfile>,

            transactionRepository as unknown as
            Repository<Reservation>,

            dataSource as unknown as DataSource,
        );
    });

    // ==========================================
    // TEST 1 : CRÉER UNE RÉSERVATION
    // ==========================================

    it(
        'crée une réservation et calcule le prix',
        async () => {
            const result =
                await service.createReservation(
                    'customer-test-id',
                    dto,
                );

            // Trois jours à 320 € = 960 €.
            expect(result.rentalDays).toBe(3);

            expect(result.dailyPrice).toBe(
                '320.00',
            );

            expect(result.totalAmount).toBe(
                '960.00',
            );

            // La caution est enregistrée
            // séparément du prix de location.
            expect(result.depositAmount).toBe(
                '2800.00',
            );

            // Une réservation commence
            // toujours avec le statut pending.
            expect(result.status).toBe(
                ReservationStatus.PENDING,
            );

            // Vérifier que la réservation
            // a bien été enregistrée.
            expect(
                transactionRepository.save,
            ).toHaveBeenCalledOnce();
        },
    );

    // ==========================================
    // TEST 2 : PROFIL CLIENT ABSENT
    // ==========================================

    it(
        'refuse une réservation sans profil client',
        async () => {
            // Simuler un client qui n'a pas
            // encore complété son profil.
            profilesRepository.findOne
                .mockResolvedValue(null);

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                BadRequestException,
            );

            // Aucune transaction ne doit commencer.
            expect(
                dataSource.transaction,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 3 : DATES INCORRECTES
    // ==========================================

    it(
        'refuse une date de retour avant le départ',
        async () => {
            // Placer le retour avant le départ.
            dto.returnDate = '2035-11-20';

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                BadRequestException,
            );

            // Aucune réservation ne doit être créée.
            expect(
                transactionRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 4 : PERMIS EXPIRÉ
    // ==========================================

    it(
        'refuse un permis expirant avant le retour',
        async () => {
            // Simuler un permis qui expire
            // pendant la période de location.
            profilesRepository.findOne
                .mockResolvedValue({
                    userId: 'customer-test-id',
                    licenseExpiresOn: '2035-11-26',
                } as CustomerProfile);

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                BadRequestException,
            );

            // La réservation ne doit pas être créée.
            expect(
                transactionRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 5 : AUCUNE VOITURE DISPONIBLE
    // ==========================================

    it(
        'refuse une réservation sans voiture disponible',
        async () => {
            // Simuler une recherche SQL
            // qui ne trouve aucune voiture.
            manager.query.mockResolvedValue([]);

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                ConflictException,
            );

            // Aucune réservation ne doit être enregistrée.
            expect(
                transactionRepository.save,
            ).not.toHaveBeenCalled();
        },
    );
});
