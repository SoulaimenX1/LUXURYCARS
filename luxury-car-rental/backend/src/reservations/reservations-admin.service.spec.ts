
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    ConflictException,
} from '@nestjs/common';

import type {
    DataSource,
    Repository,
} from 'typeorm';

// Service que nous allons tester.
import {
    ReservationsAdminService,
} from './reservations-admin.service.js';

// Entités utilisées par le service.
import {
    Reservation,
    ReservationStatus,
} from './entities/reservation.entity.js';

import {
    CustomerProfile,
} from '../customer-profiles/entities/customer-profile.entity.js';

import {
    Vehicle,
    VehicleStatus,
} from '../vehicles/entities/vehicle.entity.js';

describe('ReservationsAdminService', () => {
    // Faux repositories utilisés pendant les tests.
    let reservationsRepository: {
        find: ReturnType<typeof vi.fn>;
        findOne: ReturnType<typeof vi.fn>;
        save: ReturnType<typeof vi.fn>;
    };

    let profilesRepository: {
        findOne: ReturnType<typeof vi.fn>;
    };

    let vehiclesRepository: {
        findOne: ReturnType<typeof vi.fn>;
    };

    // Service qui sera testé.
    let service: ReservationsAdminService;

    // Réservation fictive utilisée dans les tests.
    let reservation: Reservation;

    beforeEach(() => {
        // Créer une réservation fictive.
        // Elle n'est pas enregistrée dans PostgreSQL.
        reservation = {
            id: 'reservation-test-id',
            reservationNumber: 'RES-TEST-001',
            customerId: 'customer-test-id',
            vehicleId: 'vehicle-test-id',

            pickupAt: new Date(
                '2030-11-25T00:00:00.000Z',
            ),

            returnAt: new Date(
                '2030-11-28T00:00:00.000Z',
            ),

            status: ReservationStatus.PENDING,
            decidedBy: null,
            decidedAt: null,
            decisionReason: null,
        } as Reservation;

        // Simuler la table reservations.
        reservationsRepository = {
            find: vi.fn().mockResolvedValue([
                reservation,
            ]),

            findOne: vi.fn().mockResolvedValue(
                reservation,
            ),

            save: vi.fn(
                async (value: Reservation) => value,
            ),
        };

        // Simuler la table customer_profiles.
        profilesRepository = {
            findOne: vi.fn().mockResolvedValue(
                null,
            ),
        };

        // Simuler la table vehicles.
        vehiclesRepository = {
            findOne: vi.fn().mockResolvedValue(
                null,
            ),
        };

        // Simuler le gestionnaire de transaction.
        // Chaque entité utilise son repository.
        const manager = {
            getRepository: vi.fn((entity: unknown) => {
                if (entity === Reservation) {
                    return reservationsRepository;
                }

                if (entity === CustomerProfile) {
                    return profilesRepository;
                }

                if (entity === Vehicle) {
                    return vehiclesRepository;
                }

                throw new Error(
                    'Unexpected entity in test',
                );
            }),
        };

        // Simuler une transaction PostgreSQL.
        // Le test exécute directement sa fonction.
        const dataSource = {
            transaction: vi.fn(
                async (
                    callback: (
                        entityManager: typeof manager,
                    ) => Promise<Reservation>,
                ) => callback(manager),
            ),
        } as unknown as DataSource;

        // Créer le service avec les dépendances simulées.
        service = new ReservationsAdminService(
            reservationsRepository as unknown as
            Repository<Reservation>,

            dataSource,
        );
    });

    // ==========================================
    // TEST 1 : CONSULTER LES RÉSERVATIONS
    // ==========================================

    it(
        'retourne les réservations en attente',
        async () => {
            const result =
                await service.findPendingReservations();

            // Vérifier que la réservation est retournée.
            expect(result).toEqual([
                reservation,
            ]);

            // Vérifier que le service demande
            // uniquement les réservations pending.
            expect(
                reservationsRepository.find,
            ).toHaveBeenCalledWith({
                where: {
                    status: ReservationStatus.PENDING,
                },

                order: {
                    createdAt: 'ASC',
                },
            });
        },
    );

    // ==========================================
    // TEST 2 : REFUSER UNE RÉSERVATION
    // ==========================================

    it(
        'refuse une réservation en attente',
        async () => {
            const result =
                await service.rejectReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                    'Refus administratif',
                );

            // Le statut doit devenir rejected.
            expect(result.status).toBe(
                ReservationStatus.REJECTED,
            );

            // L'administrateur doit être enregistré.
            expect(result.decidedBy).toBe(
                'admin-test-id',
            );

            // Le motif doit être conservé.
            expect(result.decisionReason).toBe(
                'Refus administratif',
            );

            // La réservation doit être sauvegardée.
            expect(
                reservationsRepository.save,
            ).toHaveBeenCalledOnce();
        },
    );

    // ==========================================
    // TEST 3 : EMPÊCHER UN DEUXIÈME REFUS
    // ==========================================

    it(
        'refuse de rejeter une réservation déjà rejetée',
        async () => {
            // Simuler une réservation déjà refusée.
            reservation.status =
                ReservationStatus.REJECTED;

            // Un deuxième refus doit provoquer
            // une erreur de conflit.
            await expect(
                service.rejectReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                    'Nouveau refus',
                ),
            ).rejects.toThrow(
                ConflictException,
            );

            // Aucune modification ne doit être enregistrée.
            expect(
                reservationsRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 4 : PERMIS EXPIRANT AVANT LE RETOUR
    // ==========================================

    it(
        'empêche la confirmation si le permis expire avant le retour',
        async () => {
            profilesRepository.findOne.mockResolvedValue({
                userId: 'customer-test-id',
                licenseNumber: 'TEST-12345',
                licenseCountry: 'TN',
                licenseIssuedOn: '2020-01-01',
                licenseExpiresOn: '2030-11-27',
            } as CustomerProfile);

            await expect(
                service.confirmReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                ),
            ).rejects.toThrow(
                ConflictException,
            );

            expect(
                reservationsRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 5 : CONFIRMATION AVEC PERMIS VALIDE
    // ==========================================

    it(
        'confirme une réservation si le permis est complet et valide',
        async () => {
            profilesRepository.findOne.mockResolvedValue({
                userId: 'customer-test-id',
                licenseNumber: 'TEST-12345',
                licenseCountry: 'TN',
                licenseIssuedOn: '2020-01-01',
                licenseExpiresOn: '2040-11-28',
            } as CustomerProfile);

            vehiclesRepository.findOne.mockResolvedValue({
                id: 'vehicle-test-id',
                status: VehicleStatus.ACTIVE,
            } as Vehicle);

            const result =
                await service.confirmReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                );

            expect(result.status).toBe(
                ReservationStatus.CONFIRMED,
            );

            expect(result.decidedBy).toBe(
                'admin-test-id',
            );

            expect(
                reservationsRepository.save,
            ).toHaveBeenCalledOnce();
        },
    );
});

