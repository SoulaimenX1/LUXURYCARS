
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
    NotFoundException,
} from '@nestjs/common';

import {
    QueryFailedError,
} from 'typeorm';

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

    // Requêtes SQL brutes (calendrier, blocs de maintenance).
    // Query SQL hors transaction (calendrier, historique d'audit).
    let dataSourceQuery: ReturnType<typeof vi.fn>;

    // Gestionnaire de transaction simulé (blocs de maintenance, F-08).
    let manager: {
        getRepository: ReturnType<typeof vi.fn>;
        query: ReturnType<typeof vi.fn>;
    };

    // Devis canonique et évaluation de disponibilité (F-08).
    let premium: { quote: ReturnType<typeof vi.fn> };
    let availability: { check: ReturnType<typeof vi.fn> };

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

        // Devis canonique et disponibilité (F-08). Valeurs par défaut
        // surchargées au besoin dans chaque test.
        premium = {
            quote: vi.fn().mockResolvedValue({
                currency: 'EUR',
                vehicleId: 'vehicle-1',
                rentalDays: 3,
                dailyPrice: '100.00',
                baseAmount: '300.00',
                extrasAmount: '0.00',
                deliveryAmount: '0.00',
                discountAmount: '0.00',
                totalAmount: '300.00',
                depositAmount: '500.00',
                pickupLocationId: 'loc-1',
                dropoffLocationId: 'loc-1',
                pickupLocationName: 'Showroom',
                dropoffLocationName: 'Showroom',
                extras: [],
                promotionCode: null,
            }),
        };

        availability = {
            check: vi.fn().mockResolvedValue({
                available: true,
                message: null,
            }),
        };

        // Simuler le gestionnaire de transaction.
        // Chaque entité utilise son repository.
        manager = {
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

            // Requêtes brutes exécutées dans la transaction
            // (véhicule, logistique, options).
            query: vi.fn().mockResolvedValue([
                { daily_price: '100.00', security_deposit: '500.00' },
            ]),
        };

        // Simuler une transaction PostgreSQL.
        // Le test exécute directement sa fonction.
        dataSourceQuery = vi.fn().mockResolvedValue([]);
        const dataSource = {
            // Requêtes SQL d'enrichissement (préférences de
            // réservation) : aucune ligne en environnement de test.
            query: dataSourceQuery,

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

            premium as never,

            availability as never,
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
            // uniquement les réservations pending,
            // en excluant les réservations archivées.
            expect(
                reservationsRepository.find,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status:
                            ReservationStatus.PENDING,
                    }),

                    order: {
                        createdAt: 'ASC',
                    },
                }),
            );
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

    // ==========================================
    // TEST 6 : ARCHIVER UNE RÉSERVATION
    // ==========================================

    it(
        'archive une réservation confirmée terminée sans changer son statut',
        async () => {
            reservation.status =
                ReservationStatus.CONFIRMED;

            // La période de location est déjà terminée : l'archivage
            // d'une réservation confirmée n'est autorisé qu'après le
            // retour planifié (règle métier).
            reservation.pickupAt = new Date(
                '2020-01-01T00:00:00.000Z',
            );
            reservation.returnAt = new Date(
                '2020-01-04T00:00:00.000Z',
            );

            // Aucune location active n'est rattachée (vérification SQL).
            manager.query.mockResolvedValueOnce([]);

            const result =
                await service.archiveReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                );

            // La date d'archivage est renseignée.
            expect(result.archivedAt).toBeInstanceOf(
                Date,
            );

            // L'administrateur est enregistré.
            expect(result.archivedBy).toBe(
                'admin-test-id',
            );

            // Le statut reste inchangé.
            expect(result.status).toBe(
                ReservationStatus.CONFIRMED,
            );

            expect(
                reservationsRepository.save,
            ).toHaveBeenCalledOnce();
        },
    );

    it(
        'refuse d\'archiver une réservation confirmée avant son retour',
        async () => {
            reservation.status =
                ReservationStatus.CONFIRMED;
            // Le retour est encore dans le futur.
            reservation.returnAt = new Date(
                '2030-11-28T00:00:00.000Z',
            );

            await expect(
                service.archiveReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                ),
            ).rejects.toBeInstanceOf(
                ConflictException,
            );

            expect(
                reservationsRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    it(
        'refuse d\'archiver une réservation confirmée liée à une location active',
        async () => {
            reservation.status =
                ReservationStatus.CONFIRMED;
            reservation.returnAt = new Date(
                '2020-01-04T00:00:00.000Z',
            );
            // Une location est encore active pour cette réservation.
            manager.query.mockResolvedValueOnce([
                { id: 'rental-active-id' },
            ]);

            await expect(
                service.archiveReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                ),
            ).rejects.toBeInstanceOf(
                ConflictException,
            );

            expect(
                reservationsRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 7 : RESTAURER UNE RÉSERVATION
    // ==========================================

    it(
        'restaure une réservation archivée',
        async () => {
            reservation.archivedAt = new Date();
            reservation.archivedBy = 'admin-test-id';

            const result =
                await service.restoreReservation(
                    'RES-TEST-001',
                );

            expect(result.archivedAt).toBeNull();
            expect(result.archivedBy).toBeNull();

            expect(
                reservationsRepository.save,
            ).toHaveBeenCalledOnce();
        },
    );

    // ==========================================
    // TEST 8 : ARCHIVAGE IDEMPOTENT
    // ==========================================

    it(
        'ne réenregistre pas une réservation déjà archivée',
        async () => {
            reservation.status =
                ReservationStatus.CONFIRMED;
            reservation.archivedAt = new Date();

            const result =
                await service.archiveReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                );

            expect(result.archivedAt).toBeInstanceOf(
                Date,
            );

            expect(
                reservationsRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    // ==========================================
    // TEST 9 : ARCHIVAGE RÉSERVÉ AUX STATUTS
    //          CONFIRMÉ / REJETÉ
    // ==========================================

    it(
        'refuse d\'archiver une réservation non confirmée ou non rejetée',
        async () => {
            // Le statut par défaut du jeu de test est PENDING.
            await expect(
                service.archiveReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                ),
            ).rejects.toBeInstanceOf(
                BadRequestException,
            );

            expect(
                reservationsRepository.save,
            ).not.toHaveBeenCalled();
        },
    );

    it(
        'autorise l\'archivage d\'une réservation rejetée',
        async () => {
            reservation.status =
                ReservationStatus.REJECTED;

            const result =
                await service.archiveReservation(
                    'RES-TEST-001',
                    'admin-test-id',
                );

            expect(result.archivedAt).toBeInstanceOf(
                Date,
            );

            expect(result.status).toBe(
                ReservationStatus.REJECTED,
            );
        },
    );

    // ==========================================
    // F-05 : BLOCS DE MAINTENANCE
    // ==========================================

    it(
        'refuse un mois invalide pour le calendrier',
        async () => {
            await expect(
                service.getUnavailability('2026/01'),
            ).rejects.toBeInstanceOf(
                BadRequestException,
            );

            expect(dataSourceQuery).not.toHaveBeenCalled();
        },
    );

    it(
        'crée un bloc de maintenance et renvoie la ligne',
        async () => {
            // 1re requête : le véhicule existe.
            // 2e requête : l'insertion renvoie le bloc.
            dataSourceQuery
                .mockResolvedValueOnce([
                    { id: 'vehicle-test-id' },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        vehicleId: 'vehicle-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                        reason: 'maintenance',
                        notes: null,
                    },
                ]);

            const result = await service.createUnavailability(
                'admin-test-id',
                {
                    vehicleId: 'vehicle-test-id',
                    startsAt: '2030-11-01T08:00:00.000Z',
                    endsAt: '2030-11-02T08:00:00.000Z',
                    reason: 'maintenance',
                },
            );

            expect(result).toMatchObject({
                id: 'block-test-id',
                reason: 'maintenance',
            });

            // L'insertion doit référencer l'administrateur.
            expect(dataSourceQuery).toHaveBeenLastCalledWith(
                expect.stringContaining(
                    'INSERT INTO vehicle_unavailability',
                ),
                expect.arrayContaining(['admin-test-id']),
            );
        },
    );

    it(
        'refuse un bloc dont la fin précède le début',
        async () => {
            await expect(
                service.createUnavailability(
                    'admin-test-id',
                    {
                        vehicleId: 'vehicle-test-id',
                        startsAt: '2030-11-02T08:00:00.000Z',
                        endsAt: '2030-11-01T08:00:00.000Z',
                        reason: 'maintenance',
                    },
                ),
            ).rejects.toBeInstanceOf(
                BadRequestException,
            );

            expect(dataSourceQuery).not.toHaveBeenCalled();
        },
    );

    it(
        'refuse un bloc pour un véhicule inexistant',
        async () => {
            dataSourceQuery.mockResolvedValueOnce([]);

            await expect(
                service.createUnavailability(
                    'admin-test-id',
                    {
                        vehicleId: 'missing-vehicle',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                        reason: 'repair',
                    },
                ),
            ).rejects.toBeInstanceOf(
                NotFoundException,
            );
        },
    );

    it(
        'traduit un conflit de réservation en ConflictException',
        async () => {
            const driverError = Object.assign(new Error('double booking'), { code: '23P01' });
            dataSourceQuery
                .mockResolvedValueOnce([
                    { id: 'vehicle-test-id' },
                ])
                .mockRejectedValueOnce(
                    new QueryFailedError(
                        'insert',
                        [],
                        driverError,
                    ),
                );

            await expect(
                service.createUnavailability(
                    'admin-test-id',
                    {
                        vehicleId: 'vehicle-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                        reason: 'inspection',
                    },
                ),
            ).rejects.toBeInstanceOf(
                ConflictException,
            );
        },
    );

    it(
        'modifie un bloc de maintenance existant',
        async () => {
            dataSourceQuery
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        reason: 'repair',
                    },
                ]);

            const result = await service.updateUnavailability(
                'block-test-id',
                {
                    reason: 'repair',
                    notes: 'Engine service',
                },
            );

            expect(result).toMatchObject({
                id: 'block-test-id',
                reason: 'repair',
            });
        },
    );

    it(
        'renvoie NotFoundException si le bloc à modifier est absent',
        async () => {
            dataSourceQuery.mockResolvedValueOnce([]);

            await expect(
                service.updateUnavailability(
                    'missing-block',
                    { reason: 'repair' },
                ),
            ).rejects.toBeInstanceOf(
                NotFoundException,
            );
        },
    );

    // ISSUE 07 : PATCH partiel — un champ absent est conservé, un champ
    // fourni (même vide) est appliqué. Les notes ne doivent JAMAIS être
    // effacées lorsque le client ne les transmet pas.
    it(
        'ISSUE 07 : ne transmettent pas les notes -> drapeau à false, notes conservées',
        async () => {
            dataSourceQuery
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        notes: 'Existing note',
                    },
                ]);

            await service.updateUnavailability(
                'block-test-id',
                { endsAt: '2030-11-03T08:00:00.000Z' },
            );

            const [sql, params] = dataSourceQuery.mock.calls[1] as [
                string,
                unknown[],
            ];
            expect(sql).toContain('CASE WHEN');
            // $6 = notesProvided = false -> la colonne existante est gardée.
            expect(params[5]).toBe(false);
        },
    );

    it(
        'ISSUE 07 : une note fournie est appliquée (drapeau true)',
        async () => {
            dataSourceQuery
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        notes: 'New note',
                    },
                ]);

            await service.updateUnavailability(
                'block-test-id',
                { notes: '  New note  ' },
            );

            const params = dataSourceQuery.mock.calls[1][1] as unknown[];
            expect(params[5]).toBe(true);
            // Valeur nettoyée des espaces superflus.
            expect(params[4]).toBe('New note');
        },
    );

    it(
        'ISSUE 07 : une note explicitement vidée est effacée (drapeau true, valeur null)',
        async () => {
            dataSourceQuery
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        notes: null,
                    },
                ]);

            await service.updateUnavailability(
                'block-test-id',
                { notes: '' },
            );

            const params = dataSourceQuery.mock.calls[1][1] as unknown[];
            expect(params[5]).toBe(true);
            expect(params[4]).toBeNull();
        },
    );

    it(
        'ISSUE 07 : une note null ne provoque plus d’erreur et efface la valeur',
        async () => {
            dataSourceQuery
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        startsAt: '2030-11-01T08:00:00.000Z',
                        endsAt: '2030-11-02T08:00:00.000Z',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        notes: null,
                    },
                ]);

            await expect(
                service.updateUnavailability(
                    'block-test-id',
                    { notes: null } as unknown as { notes?: string },
                ),
            ).resolves.toBeTruthy();

            const params = dataSourceQuery.mock.calls[1][1] as unknown[];
            expect(params[5]).toBe(true);
            expect(params[4]).toBeNull();
        },
    );

    it(
        'ISSUE 07 : refuse une plage de dates invalide sans toucher aux notes',
        async () => {
            dataSourceQuery.mockResolvedValueOnce([
                {
                    id: 'block-test-id',
                    startsAt: '2030-11-02T08:00:00.000Z',
                    endsAt: '2030-11-02T08:00:00.000Z',
                },
            ]);

            await expect(
                service.updateUnavailability(
                    'block-test-id',
                    { endsAt: '2030-11-01T08:00:00.000Z', notes: 'x' },
                ),
            ).rejects.toBeInstanceOf(
                BadRequestException,
            );
            // Aucune requête UPDATE n'est émise.
            expect(dataSourceQuery).toHaveBeenCalledTimes(1);
        },
    );

    it(
        'libère un bloc en conservant une trace d’audit',
        async () => {
            manager.query
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        vehicleId: 'vehicle-test-id',
                        startsAt: new Date('2030-11-01T08:00:00.000Z'),
                        endsAt: new Date('2030-11-02T08:00:00.000Z'),
                        reason: 'maintenance',
                        notes: 'Oil change',
                        createdBy: 'creator-admin-id',
                        createdAt: new Date('2030-10-20T08:00:00.000Z'),
                    },
                ])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'block-test-id' }]);

            const result = await service.releaseUnavailability(
                'block-test-id',
                'admin-test-id',
                'Work completed',
            );

            expect(result).toEqual({ released: 1 });

            const sqls = manager.query.mock.calls.map((call) =>
                String(call[0]),
            );

            // 1) Lecture verrouillée de la ligne.
            expect(sqls[0]).toContain('FROM vehicle_unavailability');
            expect(sqls[0]).toContain('FOR UPDATE');

            // 2) Copie d'audit AVANT la suppression, avec toutes les
            //    colonnes d'origine + l'administrateur libérateur.
            expect(sqls[1]).toContain('INSERT INTO vehicle_unavailability_audit');
            const auditParams = manager.query.mock.calls[1][1] as unknown[];
            expect(auditParams).toEqual(
                expect.arrayContaining([
                    'block-test-id',
                    'vehicle-test-id',
                    'creator-admin-id',
                    'admin-test-id',
                    'Work completed',
                ]),
            );

            // 3) Suppression du bloc actif en dernier.
            expect(sqls[2]).toContain('DELETE FROM vehicle_unavailability');
        },
    );

    it(
        'renvoie NotFoundException si le bloc à libérer est absent',
        async () => {
            manager.query.mockResolvedValueOnce([]);

            await expect(
                service.releaseUnavailability(
                    'missing-block',
                    'admin-test-id',
                ),
            ).rejects.toBeInstanceOf(
                NotFoundException,
            );

            // Aucune insertion d'audit ni suppression.
            expect(manager.query).toHaveBeenCalledTimes(1);
        },
    );

    it(
        'conserve le bloc actif si l’insertion d’audit échoue',
        async () => {
            manager.query
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        vehicleId: 'vehicle-test-id',
                        startsAt: new Date('2030-11-01T08:00:00.000Z'),
                        endsAt: new Date('2030-11-02T08:00:00.000Z'),
                        reason: 'repair',
                        notes: null,
                        createdBy: 'creator-admin-id',
                        createdAt: new Date('2030-10-20T08:00:00.000Z'),
                    },
                ])
                .mockRejectedValueOnce(
                    new Error('audit insert failed'),
                );

            await expect(
                service.releaseUnavailability(
                    'block-test-id',
                    'admin-test-id',
                ),
            ).rejects.toThrow('audit insert failed');

            // Le DELETE ne doit jamais être atteint : le bloc reste actif.
            const sqls = manager.query.mock.calls.map((call) =>
                String(call[0]),
            );
            expect(
                sqls.some((sql) =>
                    sql.includes('DELETE FROM vehicle_unavailability'),
                ),
            ).toBe(false);
        },
    );

    it(
        'ne crée aucun doublon d’historique lors d’une libération répétée',
        async () => {
            manager.query
                .mockResolvedValueOnce([
                    {
                        id: 'block-test-id',
                        vehicleId: 'vehicle-test-id',
                        startsAt: new Date('2030-11-01T08:00:00.000Z'),
                        endsAt: new Date('2030-11-02T08:00:00.000Z'),
                        reason: 'maintenance',
                        notes: null,
                        createdBy: 'creator-admin-id',
                        createdAt: new Date('2030-10-20T08:00:00.000Z'),
                    },
                ])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'block-test-id' }]);

            await expect(
                service.releaseUnavailability(
                    'block-test-id',
                    'admin-test-id',
                ),
            ).resolves.toEqual({ released: 1 });

            // Deuxième tentative : le bloc n'existe plus.
            manager.query.mockReset();
            manager.query.mockResolvedValueOnce([]);

            await expect(
                service.releaseUnavailability(
                    'block-test-id',
                    'admin-test-id',
                ),
            ).rejects.toBeInstanceOf(
                NotFoundException,
            );

            const sqls = manager.query.mock.calls.map((call) =>
                String(call[0]),
            );
            expect(
                sqls.some((sql) =>
                    sql.includes('INSERT INTO vehicle_unavailability_audit'),
                ),
            ).toBe(false);
        },
    );

    it(
        'refuse un mois invalide pour l’historique de maintenance',
        async () => {
            await expect(
                service.getUnavailabilityHistory('2026/01'),
            ).rejects.toBeInstanceOf(
                BadRequestException,
            );

            expect(dataSourceQuery).not.toHaveBeenCalled();
        },
    );

    it(
        'renvoie l’historique des blocs libérés',
        async () => {
            dataSourceQuery.mockResolvedValueOnce([
                { id: 'audit-1', reason: 'maintenance' },
            ]);

            const result =
                await service.getUnavailabilityHistory('2030-11');

            expect(result).toHaveLength(1);
            expect(dataSourceQuery).toHaveBeenCalledWith(
                expect.stringContaining(
                    'FROM vehicle_unavailability_audit',
                ),
                expect.arrayContaining([expect.any(String)]),
            );
        },
    );

    // ==========================================
    // F-08 : MODIFICATION ADMINISTRATIVE
    // ==========================================

    // Prépare une réservation modifiable et les réponses SQL brutes.
    function buildEditableReservation() {
        const editable = Object.assign(new Reservation(), reservation, {
            id: 'reservation-editable',
            reservationNumber: 'RES-2026-000123',
            customerId: 'customer-1',
            vehicleId: 'vehicle-1',
            status: ReservationStatus.CONFIRMED,
            pickupAt: new Date('2030-11-25T09:00:00.000Z'),
            returnAt: new Date('2030-11-28T09:00:00.000Z'),
            totalAmount: '300.00',
            promotionCode: null,
        });

        reservationsRepository.findOne.mockResolvedValue(editable);

        dataSourceQuery.mockImplementation(async (sql: string) => {
            if (typeof sql === 'string' && sql.includes('FROM rentals')) {
                return [];
            }
            if (typeof sql === 'string' && sql.includes('reservation_preferences')) {
                return [{
                    pickupLocationId: 'loc-1',
                    dropoffLocationId: 'loc-1',
                    pickupMethod: 'branch',
                    deliveryAddress: null,
                    pickupAddress: null,
                    dropoffAddress: null,
                }];
            }
            if (typeof sql === 'string' && sql.includes('reservation_extras')) {
                return [];
            }
            return [];
        });

        return editable;
    }

    it(
        'modifie une réservation en recalculant les prix (F-08)',
        async () => {
            buildEditableReservation();

            premium.quote.mockResolvedValueOnce({
                currency: 'EUR',
                vehicleId: 'vehicle-1',
                rentalDays: 4,
                dailyPrice: '100.00',
                baseAmount: '400.00',
                extrasAmount: '0.00',
                deliveryAmount: '0.00',
                discountAmount: '0.00',
                totalAmount: '400.00',
                depositAmount: '500.00',
                pickupLocationId: 'loc-1',
                dropoffLocationId: 'loc-1',
                pickupLocationName: 'Showroom',
                dropoffLocationName: 'Showroom',
                extras: [],
                promotionCode: null,
            });

            const result = await service.updateReservation(
                'RES-2026-000123',
                { returnAt: '2030-11-29T09:00:00.000Z' },
            );

            // Écart de prix calculé et devis appelé.
            expect(result.priceDifference).toBe('100.00');
            expect(premium.quote).toHaveBeenCalledTimes(1);

            // La disponibilité est réévaluée en excluant la réservation.
            expect(availability.check).toHaveBeenCalledWith(
                expect.objectContaining({
                    excludeReservationId: 'reservation-editable',
                }),
            );
        },
    );

    it(
        'refuse une modification si la nouvelle période est indisponible',
        async () => {
            buildEditableReservation();
            availability.check.mockResolvedValueOnce({
                available: false,
                message: 'Vehicle is booked for this period',
            });

            await expect(
                service.updateReservation('RES-2026-000123', {
                    returnAt: '2030-11-29T09:00:00.000Z',
                }),
            ).rejects.toBeInstanceOf(ConflictException);

            expect(premium.quote).not.toHaveBeenCalled();
        },
    );

    it(
        'refuse de modifier une réservation non planifiable',
        async () => {
            const editable = buildEditableReservation();
            reservationsRepository.findOne.mockResolvedValue(Object.assign(editable, {
                status: ReservationStatus.CONVERTED,
            }));

            await expect(
                service.updateReservation('RES-2026-000123', {
                    returnAt: '2030-11-29T09:00:00.000Z',
                }),
            ).rejects.toBeInstanceOf(ConflictException);
        },
    );

    it(
        'refuse de modifier une réservation déjà liée à une location',
        async () => {
            buildEditableReservation();
            dataSourceQuery.mockImplementation(async (sql: string) => {
                if (typeof sql === 'string' && sql.includes('FROM rentals')) {
                    return [{ id: 'rental-1' }];
                }
                return [];
            });

            await expect(
                service.updateReservation('RES-2026-000123', {
                    returnAt: '2030-11-29T09:00:00.000Z',
                }),
            ).rejects.toBeInstanceOf(ConflictException);
        },
    );

    it(
        'renvoie NotFoundException pour une réservation absente (F-08)',
        async () => {
            reservationsRepository.findOne.mockResolvedValueOnce(null);

            await expect(
                service.updateReservation('RES-2026-999999', {
                    returnAt: '2030-11-29T09:00:00.000Z',
                }),
            ).rejects.toBeInstanceOf(NotFoundException);
        },
    );

    it(
        'prévisualise une modification disponible (F-08)',
        async () => {
            buildEditableReservation();
            premium.quote.mockResolvedValueOnce({
                currency: 'EUR',
                vehicleId: 'vehicle-1',
                rentalDays: 4,
                dailyPrice: '100.00',
                baseAmount: '400.00',
                extrasAmount: '0.00',
                deliveryAmount: '0.00',
                discountAmount: '0.00',
                totalAmount: '400.00',
                depositAmount: '500.00',
                pickupLocationId: 'loc-1',
                dropoffLocationId: 'loc-1',
                pickupLocationName: 'Showroom',
                dropoffLocationName: 'Showroom',
                extras: [],
                promotionCode: null,
            });

            const result = await service.previewReservationEdit(
                'RES-2026-000123',
                { returnAt: '2030-11-29T09:00:00.000Z' },
            );

            expect(result.available).toBe(true);
            expect(result.currentTotal).toBe('300.00');
            expect(result.newTotal).toBe('400.00');
            expect(result.priceDifference).toBe('100.00');
            // Aucune écriture pendant la prévisualisation.
            expect(reservationsRepository.save).not.toHaveBeenCalled();
        },
    );
});

