import type { PremiumService } from '../premium/premium.service.js';
import type { AvailabilityService } from '../availability/availability.service.js';

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

    // Acces direct au faux service de disponibilite pour les tests.
    let availabilityCheck: ReturnType<typeof vi.fn> = vi.fn();

    beforeEach(() => {
        // ========================================
        // 1. PRÉPARER LA DEMANDE DU CLIENT
        // ========================================

        dto = {
            vehicleId: '550e8400-e29b-41d4-a716-446655440000',
            // Contrat autoritaire : instants precis + lieu de prise en
            // charge obligatoire (plus de dates reduites a minuit UTC).
            pickupAt: '2035-11-25T00:00:00.000Z',
            returnAt: '2035-11-28T00:00:00.000Z',
            pickupLocationId: '11111111-1111-4111-8111-111111111111',
            dropoffLocationId: '11111111-1111-4111-8111-111111111111',
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
                    id: '550e8400-e29b-41d4-a716-446655440000',
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
            { quote: vi.fn().mockResolvedValue({
              totalAmount: '960.00', rentalDays: 3, dailyPrice: '320.00',
              extrasAmount:'0.00', deliveryAmount:'0.00',
              discountAmount:'0.00', promotionCode:null, pickupMethod:'branch', extras:[],
              pickupLocationId:null, dropoffLocationId:null,
              pickupLocationName:null, dropoffLocationName:null,
              locationFees:{pickup:'0.00',dropoff:'0.00',oneWay:'0.00'},
            }) } as unknown as PremiumService,
            { check: (availabilityCheck = vi.fn().mockResolvedValue({ available: true })) } as unknown as AvailabilityService,
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

            // La transaction cherche précisément le véhicule demandé.
            expect(manager.query).toHaveBeenCalledWith(
                expect.stringContaining('v.id = $1::uuid'),
                [
                    dto.vehicleId,
                    '2035-11-25T00:00:00.000Z',
                    '2035-11-28T00:00:00.000Z',
                ],
            );
            expect(result.vehicleId).toBe(dto.vehicleId);

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
            dto.returnAt = '2035-11-20T00:00:00.000Z';

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

    // ==========================================
    // TEST 6 : LIEU DE PRISE EN CHARGE OBLIGATOIRE
    // ==========================================

    it(
        'refuse une réservation sans lieu de prise en charge',
        async () => {
            dto.pickupLocationId = undefined;
            dto.dropoffLocationId = undefined;

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                BadRequestException,
            );

            expect(
                dataSource.transaction,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 7 : INSTANTS PRECIS OBLIGATOIRES
    // ==========================================

    it(
        'refuse une réservation réduite à une date (minuit UTC silencieux)',
        async () => {
            // Client historique : uniquement des dates civiles.
            dto.pickupAt = undefined;
            dto.returnAt = undefined;
            dto.pickupDate = '2035-11-25';
            dto.returnDate = '2035-11-28';

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                BadRequestException,
            );

            expect(
                dataSource.transaction,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 8 : VALIDATION SERVEUR BLOQUANTE
    // ==========================================

    it(
        'refuse une réservation quand la disponibilité est refusée',
        async () => {
            availabilityCheck.mockResolvedValue({
                available: false,
                message:
                    'The selected period is no longer available for this vehicle',
            });

            await expect(
                service.createReservation(
                    'customer-test-id',
                    dto,
                ),
            ).rejects.toThrow(
                ConflictException,
            );

            expect(
                dataSource.transaction,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // F-10 : ANNULATION PAR LE CLIENT
    // ==========================================

    // Prépare une réservation appartenant au client connecté.
    function storedReservationWith(
        overrides: Partial<Reservation>,
    ) {
        const future = new Date('2035-11-25T00:00:00.000Z');
        transactionRepository.findOne.mockResolvedValue({
            id: 'reservation-1',
            reservationNumber: 'RES-2026-000001',
            customerId: 'customer-test-id',
            vehicleId: '550e8400-e29b-41d4-a716-446655440000',
            status: ReservationStatus.CONFIRMED,
            pickupAt: future,
            returnAt: new Date('2035-11-28T00:00:00.000Z'),
            ...overrides,
        } as Reservation);
    }

    it(
        'annule une réservation confirmée avant la prise en charge',
        async () => {
            storedReservationWith({ status: ReservationStatus.CONFIRMED });
            manager.query.mockResolvedValue([]); // aucune location liée

            const result = await service.cancelMyReservation(
                'customer-test-id',
                'res-2026-000001',
            );

            expect(result.status).toBe(ReservationStatus.CANCELLED);
            expect(manager.query).toHaveBeenCalled();
        },
    );

    it(
        'annule une réservation encore en attente',
        async () => {
            storedReservationWith({ status: ReservationStatus.PENDING });
            manager.query.mockResolvedValue([]);

            const result = await service.cancelMyReservation(
                'customer-test-id',
                'RES-2026-000001',
            );

            expect(result.status).toBe(ReservationStatus.CANCELLED);
        },
    );

    it(
        'refuse d annuler une réservation convertie en location',
        async () => {
            storedReservationWith({ status: ReservationStatus.CONVERTED });
            manager.query.mockResolvedValue([]);

            await expect(
                service.cancelMyReservation(
                    'customer-test-id',
                    'RES-2026-000001',
                ),
            ).rejects.toThrow(ConflictException);
        },
    );

    it(
        'refuse d annuler une réservation avec un historique financier',
        async () => {
            storedReservationWith({ status: ReservationStatus.CONFIRMED });
            // Une location existe : les montants doivent être réglés par le staff.
            manager.query.mockResolvedValue([{ id: 'rental-1' }]);

            await expect(
                service.cancelMyReservation(
                    'customer-test-id',
                    'RES-2026-000001',
                ),
            ).rejects.toBeInstanceOf(ConflictException);
        },
    );

    it(
        'refuse d annuler après la date de prise en charge',
        async () => {
            storedReservationWith({
                status: ReservationStatus.CONFIRMED,
                pickupAt: new Date('2000-01-01T00:00:00.000Z'),
            });
            manager.query.mockResolvedValue([]);

            await expect(
                service.cancelMyReservation(
                    'customer-test-id',
                    'RES-2026-000001',
                ),
            ).rejects.toBeInstanceOf(ConflictException);
        },
    );
});
