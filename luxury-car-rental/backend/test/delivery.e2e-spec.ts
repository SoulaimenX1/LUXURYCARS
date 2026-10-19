import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import type { DataSource } from 'typeorm';
import { DataSource as TypeOrmDataSource } from 'typeorm';
import dotenv from 'dotenv';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { PremiumService } from '../src/premium/premium.service.js';
import { AvailabilityService } from '../src/availability/availability.service.js';
import { LocationsService } from '../src/locations/locations.service.js';
import { DeliveryService } from '../src/delivery/delivery.service.js';
import { findEligibleZone, quoteDoorService } from '../src/zones/zones.queries.js';
import {
  assertQuoteMatchesFreshTotal,
  buildSideFingerprint,
  markQuoteAccepted,
  validateQuoteForBooking,
} from '../src/delivery/delivery.queries.js';
import {
  currentVehiclePositions,
  listVehicleMovements,
  recordVehicleLocation,
  setVehicleHomeLocation,
} from '../src/vehicle-movements/vehicle-location.js';
import { ReservationsService } from '../src/reservations/reservations.service.js';
import { CreateReservationDto } from '../src/reservations/dto/create-reservation.dto.js';
import { CustomerProfile } from '../src/customer-profiles/entities/customer-profile.entity.js';
import { Reservation } from '../src/reservations/entities/reservation.entity.js';
import { TransportMissionsService } from '../src/transport-missions/transport-missions.service.js';

// ==========================================================
// TESTS D'INTÉGRATION — LIVRAISON / COLLECTE PORTE-À-PORTE
// ==========================================================
//
// Base PostgreSQL jetable (schema.sql + tous les patches, dont la
// migration 022) : les zones et règles de tarification SEMBLÉES par
// le patch (HU-ALL actif, règles en brouillon SANS frais) servent de
// preuve réelle du « launch gate » — aucun frais n'existe avant
// qu'un admin ne l'approbatte explicitement.
//
// Couverture : éligibilité des zones → tarif porte réel → devis
// persisté (cycle de vie complet) → réservation avec devis accepté
// + points de service contractuels → registre de localisation.
//
// Aucun montant n'est inventé par le test : tout vient de la
// configuration semée par les patches.

dotenv.config();

const BACKEND_ROOT = join(__dirname, '..');
const SCHEMA_FILE = join(BACKEND_ROOT, 'database', 'schema.sql');
const PATCH_DIR = join(BACKEND_ROOT, 'database', 'patches');

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DB_PORT ?? 5432);
const DB_USER = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';

const TEST_DB = 'luxury_car_rental_delivery_itest';

// Identifiants stables pour rejouer sur une base neuve.
const ID = {
  customerUser: '00000000-0000-4000-8000-00000000e001',
  adminUser: '00000000-0000-4000-8000-00000000e002',
  brand: 'f0000000-0000-4000-8000-00000000e001',
  category: 'c0000000-0000-4000-8000-00000000e001',
  model: 'd0000000-0000-4000-8000-00000000e001',
  vehicleOne: 'a0000000-0000-4000-8000-00000000e001',
  vehicleTwo: 'a0000000-0000-4000-8000-00000000e002',
  locationA: 'b0000000-0000-4000-8000-00000000e001',
  zoneAtAll: '90000000-0000-4000-8000-00000000a001',
  zoneAtWien: '90000000-0000-4000-8000-00000000a002',
  zoneCzPrg: '90000000-0000-4000-8000-00000000a003',
  zonePlOff: '90000000-0000-4000-8000-00000000a004',
  zoneSkOff: '90000000-0000-4000-8000-00000000a005',
};

// Fenêtre test : 09:00Z en été = 11:00 locale (Europe/Budapest),
// dans la plage 09:00–18:00 des points ET de la zone HU-ALL.
const T = {
  d1: '2035-06-01T09:00:00.000Z',
  d4: '2035-06-04T09:00:00.000Z',
};

const DOOR_HU = {
  address: {
    line1: 'Fő utca 1',
    city: 'Budapest',
    countryCode: 'HU',
    postalCode: '1054',
  },
  meetingInstructions: 'Gardez le badge à la réception',
  entryNotes: 'Code portier 4587',
};

let admin: Client;
let db: Client;
let orm: TypeOrmDataSource;
let premium: PremiumService;
let availability: AvailabilityService;
let delivery: DeliveryService;
let reservations: ReservationsService;

function clientFor(database: string): Client {
  return new Client({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database });
}

// Adaptateur minimal : les services n'utilisent que `query`.
function makeDataSource(client: Client): DataSource {
  return {
    query: (text: string, params: unknown[] = []) =>
      client.query(text, params).then((result) => result.rows),
  } as unknown as DataSource;
}

async function applyBaseline(target: Client) {
  await target.query(readFileSync(SCHEMA_FILE, 'utf8'));
  const patches = readdirSync(PATCH_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const patch of patches) {
    await target.query(readFileSync(join(PATCH_DIR, patch), 'utf8'));
  }
}

async function seed(target: Client) {
  await target.query(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name)
     VALUES
       ($1, 'itest.delivery.customer@example.com', 'x', 'customer', 'Delivery', 'Customer'),
       ($2, 'itest.delivery.admin@example.com', 'x', 'admin', 'Delivery', 'Admin')`,
    [ID.customerUser, ID.adminUser],
  );
  await target.query(
    `INSERT INTO customer_profiles
       (user_id, date_of_birth, license_number, license_country, license_issued_on, license_expires_on)
     VALUES ($1, '1990-01-01', 'DLIV-1', 'HU', '2015-01-01', '2040-01-01')`,
    [ID.customerUser],
  );
  await target.query(`INSERT INTO brands (id, name) VALUES ($1, 'Delivery Motors')`, [ID.brand]);
  await target.query(`INSERT INTO categories (id, name) VALUES ($1, 'Grand Tourer')`, [ID.category]);
  await target.query(
    `INSERT INTO vehicle_models (id, brand_id, category_id, name)
     VALUES ($1, $2, $3, 'Delivery One')`,
    [ID.model, ID.brand, ID.category],
  );
  await target.query(
    `INSERT INTO vehicles
       (id, model_id, manufacture_year, license_plate, vin, transmission, fuel_type,
        daily_price, security_deposit, vehicle_value, status)
     VALUES
       ($1, $3, 2024, 'DLIV-01', 'VINDLV0000000001', 'automatic', 'petrol', 300.00, 2000.00, 250000.00, 'active'),
       ($2, $3, 2024, 'DLIV-02', 'VINDLV0000000002', 'automatic', 'hybrid', 280.00, 2000.00, 180000.00, 'active')`,
    [ID.vehicleOne, ID.vehicleTwo, ID.model],
  );
  // Lieu de service hongrois avec frais de point (config admin).
  await target.query(
    `INSERT INTO rental_locations
       (id, code, name, category, city, country, address, can_pickup, can_dropoff, enabled,
        timezone, opens_at, closes_at, turnaround_minutes, pickup_fee, dropoff_fee, one_way_fee)
     VALUES ($1, 'DLIV-A', 'Delivery Hub', 'showroom', 'Budapest', 'Hongrie', 'A utca 1',
             true, true, true, 'Europe/Budapest', '09:00', '18:00', 0, 15.00, 20.00, 50.00)`,
    [ID.locationA],
  );

  // ---- Zones supplémentaires pour l'éligibilité ----
  // Le patch 022 fournit déjà HU-ALL (tout pays, actif). On ajoute :
  // un pays avec zone large + zone ville (la plus spécifique gagne),
  // un pays à zone ville seule (refus hors ville), un service désactivé,
  // une zone inactive.
  await target.query(
    `INSERT INTO service_zones (id, code, name, country_code, active, address_service_enabled, cities, timezone)
     VALUES
       ($1, 'AT-ALL', 'Autriche — Tout le pays', 'AT', true, true, '[]'::jsonb, 'Europe/Vienna'),
       ($2, 'AT-WIEN', 'Vienne', 'AT', true, true, '["Wien","Vienna"]'::jsonb, 'Europe/Vienna')`,
    [ID.zoneAtAll, ID.zoneAtWien],
  );
  await target.query(
    `INSERT INTO service_zones (id, code, name, country_code, active, address_service_enabled, cities, timezone)
     VALUES ($1, 'CZ-PRG', 'Prague', 'CZ', true, true, '["Praha"]'::jsonb, 'Europe/Prague')`,
    [ID.zoneCzPrg],
  );
  await target.query(
    `INSERT INTO service_zones (id, code, name, country_code, active, address_service_enabled, cities)
     VALUES
       ($1, 'PL-OFF', 'Pologne (service désactivé)', 'PL', true, false, '[]'::jsonb),
       ($2, 'SK-IN', 'Slovaquie (inactive)', 'SK', false, true, '[]'::jsonb)`,
    [ID.zonePlOff, ID.zoneSkOff],
  );
}

const DOOR_QUOTE_DTO = {
  vehicleId: ID.vehicleOne,
  pickupAt: T.d1,
  returnAt: T.d4,
  pickupServiceMode: 'DOOR_TO_DOOR' as const,
  dropoffServiceMode: 'APPROVED_POINT' as const,
  pickupDoor: DOOR_HU,
  dropoffLocationId: ID.locationA,
};

describe('Livraison porte-à-porte (PostgreSQL réel)', () => {
  beforeAll(async () => {
    admin = clientFor('postgres');
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);

    db = clientFor(TEST_DB);
    await db.connect();
    await applyBaseline(db);
    await seed(db);

    const adapter = makeDataSource(db);
    premium = new PremiumService(adapter);
    availability = new AvailabilityService(adapter, new LocationsService(adapter));
    delivery = new DeliveryService(adapter, premium);

    orm = new TypeOrmDataSource({
      type: 'postgres',
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USER,
      password: DB_PASSWORD,
      database: TEST_DB,
      entities: [CustomerProfile, Reservation],
    });
    await orm.initialize();
    reservations = new ReservationsService(
      orm.getRepository(CustomerProfile),
      orm.getRepository(Reservation),
      orm,
      premium,
      availability,
    );
  }, 180_000);

  afterAll(async () => {
    await orm?.destroy();
    await db?.end();
    await admin?.end();
  });

  // ========================================================
  // 1. ÉLIGIBILITÉ GÉOGRAPHIQUE (zones semées par les patches)
  // ========================================================
  describe("1. Éligibilité géographique", () => {
    it('couvre tout le pays via la zone semée HU-ALL (ville listée ou non)', async () => {
      const budapest = await findEligibleZone(makeDataSource(db), {
        countryCode: 'HU', city: 'Budapest',
      });
      expect(budapest.zone?.code).toBe('HU-ALL');
      expect(budapest.reason).toBeUndefined();

      const pecs = await findEligibleZone(makeDataSource(db), {
        countryCode: 'HU', city: 'Pécs',
      });
      expect(pecs.zone?.code).toBe('HU-ALL');
    });

    it("refuse un pays jamais couvert ('address-not-in-zone')", async () => {
      const verdict = await findEligibleZone(makeDataSource(db), {
        countryCode: 'FR', city: 'Paris',
      });
      expect(verdict.zone).toBeNull();
      expect(verdict.reason).toBe('address-not-in-zone');
    });

    it('préfère la zone la plus spécifique (ville) à la zone large', async () => {
      const wien = await findEligibleZone(makeDataSource(db), {
        countryCode: 'AT', city: 'Wien',
      });
      expect(wien.zone?.code).toBe('AT-WIEN');

      const linz = await findEligibleZone(makeDataSource(db), {
        countryCode: 'AT', city: 'Linz',
      });
      expect(linz.zone?.code).toBe('AT-ALL');
    });

    it("refuse une ville hors liste quand la seule zone est limitée ('city-not-in-zone')", async () => {
      const verdict = await findEligibleZone(makeDataSource(db), {
        countryCode: 'CZ', city: 'Brno',
      });
      expect(verdict.zone).toBeNull();
      expect(verdict.reason).toBe('city-not-in-zone');
    });

    it("refuse le service adresse désactivé ('address-service-disabled')", async () => {
      const verdict = await findEligibleZone(makeDataSource(db), {
        countryCode: 'PL', city: 'Varsovie',
      });
      expect(verdict.reason).toBe('address-service-disabled');
    });

    it("refuse une zone inactive ('no-active-zone')", async () => {
      const verdict = await findEligibleZone(makeDataSource(db), {
        countryCode: 'SK', city: 'Bratislava',
      });
      expect(verdict.reason).toBe('no-active-zone');
    });
  });

  // ========================================================
  // 2. LANCEMENT GATE : RÈGLES EN BROUILLON = REFUS EXPLICITE
  // ========================================================
  describe('2. Frais de livraison non approuvés (launch gate)', () => {
    it("les règles semées en brouillon sans frais refusent la porte ('pricing-not-configured')", async () => {
      // Preuve réelle : HU-ALL existe, est active, mais AUCUN frais
      // n'a été approuvé → jamais un « 0.00 » silencieux.
      const pickup = await quoteDoorService(makeDataSource(db), {
        countryCode: 'HU', city: 'Budapest',
        serviceType: 'door_pickup',
        vehicleId: ID.vehicleOne,
        scheduledAt: new Date(T.d1),
      });
      expect(pickup).toEqual({ ok: false, reason: 'pricing-not-configured' });

      const dropoff = await quoteDoorService(makeDataSource(db), {
        countryCode: 'HU', city: 'Budapest',
        serviceType: 'door_dropoff',
        vehicleId: ID.vehicleOne,
        scheduledAt: new Date(T.d1),
      });
      expect(dropoff).toEqual({ ok: false, reason: 'pricing-not-configured' });

      // Le devis serveur refuse aussi (aucune fuite d'un 0.00).
      await expect(
        premium.quote(DOOR_QUOTE_DTO),
      ).rejects.toThrow('pricing-not-configured');
    });
  });

  // ========================================================
  // 3. ACTIVATION ADMIN PUIS TARIF RÉEL
  // ========================================================
  describe('3. Activation des frais puis calcul réel', () => {
    it("l'activation explicite rend les frais réels facturables", async () => {
      // Exactement ce qu'un admin fera avant le lancement :
      // approuver un montant sur les règles de la zone.
      await db.query(
        `UPDATE delivery_pricing_rules SET status='active', fixed_fee='45.00'
          WHERE service_type='door_pickup'`,
      );
      await db.query(
        `UPDATE delivery_pricing_rules SET status='active', fixed_fee='30.00'
          WHERE service_type='door_dropoff'`,
      );

      const pickup = await quoteDoorService(makeDataSource(db), {
        countryCode: 'HU', city: 'Budapest',
        serviceType: 'door_pickup',
        vehicleId: ID.vehicleOne,
        scheduledAt: new Date(T.d1),
      });
      expect(pickup).toEqual({ ok: true, feeCents: 4500, zoneCode: 'HU-ALL' });

      const dropoff = await quoteDoorService(makeDataSource(db), {
        countryCode: 'HU', city: 'Budapest',
        serviceType: 'door_dropoff',
        vehicleId: ID.vehicleOne,
        scheduledAt: new Date(T.d1),
      });
      expect(dropoff).toEqual({ ok: true, feeCents: 3000, zoneCode: 'HU-ALL' });
    });

    it('collecte porte → restitution point : frais de zone + frais du point', async () => {
      const quote = await premium.quote(DOOR_QUOTE_DTO);
      // 3 jours × 300 € = 900 € ; livraison = point restitution 20 € + porte 45 €.
      expect(quote.baseAmount).toBe('900.00');
      expect(quote.deliveryAmount).toBe('65.00');
      expect(quote.totalAmount).toBe('965.00');
      expect(quote.locationFees).toEqual({
        pickup: '0.00',
        dropoff: '20.00',
        oneWay: '0.00',
        doorPickup: '45.00',
        doorDropoff: '0.00',
      });
      expect(quote.pickupMethod).toBe('branch');
      expect(quote.pickupLocationId).toBeNull();
      expect(quote.pickupLocationName).toContain('Fő utca 1');
      expect(quote.dropoffLocationId).toBe(ID.locationA);
      expect(quote.dropoffLocationName).toContain('Delivery Hub');
    });

    it('point → restitution porte : trajet simple du point d’origine', async () => {
      const quote = await premium.quote({
        vehicleId: ID.vehicleOne,
        pickupAt: T.d1,
        returnAt: T.d4,
        pickupServiceMode: 'APPROVED_POINT',
        dropoffServiceMode: 'DOOR_TO_DOOR',
        pickupLocationId: ID.locationA,
        dropoffDoor: DOOR_HU,
      });
      // Point 15 € + porte retour 30 € + trajet simple 50 € = 95 €.
      expect(quote.deliveryAmount).toBe('95.00');
      expect(quote.locationFees).toEqual({
        pickup: '15.00',
        dropoff: '0.00',
        oneWay: '50.00',
        doorPickup: '0.00',
        doorDropoff: '30.00',
      });
      expect(quote.totalAmount).toBe('995.00');
    });

    it('impose le même pays sur tous les côtés (point Hongrie ↔ porte France refusé)', async () => {
      await expect(
        premium.quote({
          vehicleId: ID.vehicleOne,
          pickupAt: T.d1,
          returnAt: T.d4,
          pickupServiceMode: 'APPROVED_POINT',
          dropoffServiceMode: 'DOOR_TO_DOOR',
          pickupLocationId: ID.locationA,
          dropoffDoor: {
            address: { line1: '1 Rue de la Paix', city: 'Paris', countryCode: 'FR' },
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================================
  // 4. CYCLE DE VIE DU DEVIS PERSISTÉ
  // ========================================================
  describe('4. Devis persisté (validité, propriété, empreinte, total)', () => {
    let quote1: { id: string; expiresAt: Date; totalAmount: string };
    let quote2: { id: string };

    const expectedFingerprints = {
      vehicleId: ID.vehicleOne,
      pickupAt: new Date(T.d1),
      returnAt: new Date(T.d4),
      pickupPoint: buildSideFingerprint({
        mode: 'DOOR_TO_DOOR',
        address: DOOR_HU.address,
      }),
      dropoffPoint: buildSideFingerprint({
        mode: 'APPROVED_POINT',
        locationId: ID.locationA,
      }),
    };

    it('persiste un devis avec expiration future et ventilation complète', async () => {
      quote1 = await delivery.createQuote(DOOR_QUOTE_DTO, ID.customerUser);
      expect(quote1.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(quote1.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(quote1.totalAmount).toBe('965.00');

      const rows = await db.query<{ status: string; pickup_method: string; policy_version: number }>(
        `SELECT status, pickup_method, policy_version FROM delivery_quotes WHERE id=$1`,
        [quote1.id],
      );
      expect(rows.rows[0].status).toBe('issued');
      expect(rows.rows[0].pickup_method).toBe('DOOR_TO_DOOR');
      expect(rows.rows[0].policy_version).toBe(1);
    });

    it("accepte la révalidation du propriétaire (empreintes identiques)", async () => {
      const result = await validateQuoteForBooking(makeDataSource(db), {
        quoteId: quote1.id,
        userId: ID.customerUser,
        expected: expectedFingerprints,
      });
      expect(result.breakdown.totalAmount).toBe('965.00');
    });

    it("un devis d'un autre client n'existe pas (404, sans fuite)", async () => {
      await expect(
        validateQuoteForBooking(makeDataSource(db), {
          quoteId: quote1.id,
          userId: ID.adminUser,
          expected: expectedFingerprints,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("empreinte différente (ville porte) → 409", async () => {
      await expect(
        validateQuoteForBooking(makeDataSource(db), {
          quoteId: quote1.id,
          userId: ID.customerUser,
          expected: {
            ...expectedFingerprints,
            pickupPoint: buildSideFingerprint({
              mode: 'DOOR_TO_DOOR',
              address: { ...DOOR_HU.address, city: 'Wien' },
            }),
          },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('expiré → 409 (jamais accepté à l’aveugle)', async () => {
      // Le CHECK de la base interdit expires_at <= calculated_at :
      // on recule les deux (expiration dans le passé, cohérence conservée).
      await db.query(
        `UPDATE delivery_quotes
            SET calculated_at = NOW() - interval '2 hours',
                expires_at = NOW() - interval '1 minute'
          WHERE id=$1`,
        [quote1.id],
      );
      await expect(
        validateQuoteForBooking(makeDataSource(db), {
          quoteId: quote1.id,
          userId: ID.customerUser,
          expected: expectedFingerprints,
        }),
      ).rejects.toThrow('expired');
    });

    it('réclamé une fois puis refusé à la seconde (course impossibie)', async () => {
      quote2 = await delivery.createQuote(DOOR_QUOTE_DTO, ID.customerUser);
      // La base impose une vraie réservation (FK) : on en crée une
      // jetable sur une fenêtre hors parcours, puis on la nettoie.
      const raw = await db.query<{ id: string }>(
        `INSERT INTO reservations
           (customer_id, vehicle_id, pickup_at, return_at, rental_days,
            daily_price, deposit_amount, total_amount)
         VALUES ($1, $2, '2036-01-01T09:00:00Z', '2036-01-04T09:00:00Z', 3,
                 300.00, 2000.00, 900.00)
         RETURNING id`,
        [ID.customerUser, ID.vehicleOne],
      );
      const rawReservationId = raw.rows[0].id;

      await markQuoteAccepted(makeDataSource(db), quote2.id, rawReservationId);
      await expect(
        markQuoteAccepted(makeDataSource(db), quote2.id, rawReservationId),
      ).rejects.toThrow(ConflictException);
      await expect(
        validateQuoteForBooking(makeDataSource(db), {
          quoteId: quote2.id,
          userId: ID.customerUser,
          expected: expectedFingerprints,
        }),
      ).rejects.toThrow('already been used');

      // Nettoyage : aucune donnée jetable ne survit au test.
      await db.query(`DELETE FROM delivery_quotes WHERE id=$1`, [quote2.id]);
      await db.query(`DELETE FROM reservations WHERE id=$1`, [rawReservationId]);
    });

    it('divergence de total → 409 (nouveau devis obligatoire)', async () => {
      const fresh = await premium.quote(DOOR_QUOTE_DTO);
      expect(() => assertQuoteMatchesFreshTotal(fresh, fresh.totalAmount)).not.toThrow();
      expect(() => assertQuoteMatchesFreshTotal(fresh, '900.00')).toThrow(ConflictException);
    });
  });

  // ========================================================
  // 5. RÉSERVATION AVEC DEVIS + POINTS DE SERVICE CONTRACTUELS
  // ========================================================
  describe('5. Réservation (4 combos, devis accepté, points gravés)', () => {
    const reservationDto = (overrides: Partial<CreateReservationDto> = {}): CreateReservationDto =>
      ({ ...DOOR_QUOTE_DTO, ...overrides }) as CreateReservationDto;

    it('refuse un legacy sans lieu de prise en charge (contrat historique)', async () => {
      await expect(
        reservations.createReservation(ID.customerUser, reservationDto({
          pickupServiceMode: undefined,
          pickupDoor: undefined,
          pickupLocationId: undefined,
        })),
      ).rejects.toThrow('A pickup location is required');
      const rows = await db.query(`SELECT count(*)::int AS n FROM reservations`);
      expect(rows.rows[0].n).toBe(0);
    });

    it('refuse un mode porte-à-porte sans adresse', async () => {
      await expect(
        reservations.createReservation(ID.customerUser, reservationDto({
          pickupDoor: undefined,
        })),
      ).rejects.toThrow('pickup address is required');
      const rows = await db.query(`SELECT count(*)::int AS n FROM reservations`);
      expect(rows.rows[0].n).toBe(0);
    });

    let reservationId: string;
    let quote3Id: string;

    it('crée la réservation porte → point avec devis accepté et points gravés', async () => {
      quote3Id = (await delivery.createQuote(DOOR_QUOTE_DTO, ID.customerUser)).id;

      const saved = await reservations.createReservation(
        ID.customerUser,
        reservationDto({ quoteId: quote3Id }),
      );
      reservationId = saved.id;

      // Le devis est marqué accepté ET lié à la réservation.
      const quoteRows = await db.query<{ status: string; accepted_reservation_id: string }>(
        `SELECT status, accepted_reservation_id FROM delivery_quotes WHERE id=$1`,
        [quote3Id],
      );
      expect(quoteRows.rows[0].status).toBe('accepted');
      expect(quoteRows.rows[0].accepted_reservation_id).toBe(reservationId);

      // Les deux extrémités sont gravées (jamais une place fantôme).
      const points = await db.query<{
        direction: string; method: string; location_id: string | null;
        local_date: string; local_time: string; timezone: string;
        canonical: string; frozen: boolean;
        address: { line1?: string; countryCode?: string } | null;
      }>(
        `SELECT direction, method, location_id,
                to_char(local_date, 'YYYY-MM-DD') AS local_date,
                local_time, timezone, canonical, frozen, address
           FROM reservation_service_points WHERE reservation_id=$1
          ORDER BY direction DESC`,
        [reservationId],
      );
      expect(points.rows).toHaveLength(2);

      const pickup = points.rows.find((p) => p.direction === 'pickup')!;
      expect(pickup.method).toBe('DOOR_TO_DOOR');
      expect(pickup.location_id).toBeNull();
      expect(pickup.address?.line1).toBe('Fő utca 1');
      expect(pickup.canonical).toContain('Fő utca 1');
      // Date/heure contractuelles DANS le fuseau réel (UTC+2 en juin).
      expect(pickup.local_date).toBe('2035-06-01');
      expect(pickup.local_time).toBe('11:00:00');
      expect(pickup.timezone).toBe('Europe/Budapest');
      expect(pickup.frozen).toBe(false);

      const dropoff = points.rows.find((p) => p.direction === 'dropoff')!;
      expect(dropoff.method).toBe('APPROVED_POINT');
      expect(dropoff.location_id).toBe(ID.locationA);
      expect(dropoff.address).toBeNull();
      expect(dropoff.canonical).toContain('Delivery Hub');
      expect(dropoff.local_date).toBe('2035-06-04');
      expect(dropoff.local_time).toBe('11:00:00');
      expect(dropoff.timezone).toBe('Europe/Budapest');
    });

    it("le même devis ne peut pas être réutilisé (409, aucune écriture)", async () => {
      await expect(
        reservations.createReservation(ID.customerUser, reservationDto({ quoteId: quote3Id })),
      ).rejects.toThrow(ConflictException);
      const rows = await db.query(`SELECT count(*)::int AS n FROM reservations`);
      expect(rows.rows[0].n).toBe(1);
    });

    it('le contrat historique point → point reste intact (réservation + 2 points)', async () => {
      const saved = await reservations.createReservation(ID.customerUser, reservationDto({
        vehicleId: ID.vehicleTwo,
        pickupServiceMode: undefined,
        dropoffServiceMode: undefined,
        pickupDoor: undefined,
        dropoffDoor: undefined,
        pickupLocationId: ID.locationA,
        dropoffLocationId: ID.locationA,
        quoteId: undefined,
      }));
      const points = await db.query<{ method: string; location_id: string; canonical: string }>(
        `SELECT method, location_id, canonical FROM reservation_service_points
          WHERE reservation_id=$1 ORDER BY direction DESC`,
        [saved.id],
      );
      expect(points.rows).toHaveLength(2);
      expect(points.rows.every((p) => p.method === 'APPROVED_POINT')).toBe(true);
      expect(points.rows.every((p) => p.location_id === ID.locationA)).toBe(true);

      const rows = await db.query(`SELECT count(*)::int AS n FROM reservations`);
      expect(rows.rows[0].n).toBe(2);
    });
  });

  // ========================================================
  // 6. REGISTRE DE LOCALISATION PHYSIQUE (append-only)
  // ========================================================
  describe('Transport mission concurrency', () => {
    it('completes a mission exactly once when two driver requests arrive together', async () => {
      const driverId = '00000000-0000-4000-8000-00000000e003';
      await db.query(`INSERT INTO users (id,email,password_hash,role,first_name,last_name)
        VALUES ($1,'itest.driver@example.com','x','staff','Test','Driver')`, [driverId]);
      await db.query(`INSERT INTO driver_profiles (user_id,active) VALUES ($1,true)`, [driverId]);
      const missions = new TransportMissionsService(orm);
      const mission = await missions.create(ID.adminUser, {
        type: 'REPOSITIONING', vehicleId: ID.vehicleTwo,
        originKind: 'LOCATION', originLocationId: ID.locationA,
        destinationKind: 'LOCATION', destinationLocationId: ID.locationA,
        plannedStart: '2036-06-01T09:00:00Z', plannedEnd: '2036-06-01T10:00:00Z',
        driverUserId: driverId,
      });
      const missionId = mission.id as string;
      await missions.transition(driverId, missionId, 'accept', {});
      await missions.transition(driverId, missionId, 'start', {});
      const results = await Promise.allSettled([
        missions.transition(driverId, missionId, 'complete', { distanceKm: 10 }),
        missions.transition(driverId, missionId, 'complete', { distanceKm: 10 }),
      ]);
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(result => result.status === 'rejected');
      expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(ConflictException);
      const events = await db.query(`SELECT event_type FROM mission_events
        WHERE mission_id=$1 AND event_type='complete'`, [missionId]);
      expect(events.rows).toHaveLength(1);
      const movements = await db.query(`SELECT id FROM vehicle_location_events WHERE mission_id=$1`, [missionId]);
      expect(movements.rows).toHaveLength(1);
    });
  });

  describe('6. Registre de localisation des véhicules', () => {
    it("un événement gravé projette l'atome position (CTE atomique)", async () => {
      await recordVehicleLocation(makeDataSource(db), {
        vehicleId: ID.vehicleOne,
        eventKind: 'reservation_pickup',
        toLocationId: ID.locationA,
        source: 'system',
      });

      const positions = await currentVehiclePositions(makeDataSource(db), { vehicleId: ID.vehicleOne });
      expect(positions).toHaveLength(1);
      expect(positions[0].current_location_id).toBe(ID.locationA);
      expect(positions[0].current_location_name).toBe('Delivery Hub');
      expect(positions[0].last_event_kind).toBe('reservation_pickup');
      expect(positions[0].home_location_id).toBeNull();
    });

    it("un retour à adresse (porte) retire la position enregistrée — jamais de position fausse", async () => {
      await recordVehicleLocation(makeDataSource(db), {
        vehicleId: ID.vehicleOne,
        eventKind: 'reservation_return',
        fromLocationId: ID.locationA,
        toAddress: { line1: 'Fő utca 1', city: 'Budapest', countryCode: 'HU' },
        source: 'system',
      });

      const positions = await currentVehiclePositions(makeDataSource(db), { vehicleId: ID.vehicleOne });
      expect(positions[0].current_location_id).toBeNull();
      expect(positions[0].last_event_address).toMatchObject({ line1: 'Fő utca 1' });
    });

    it("affecter un domicile ne change PAS la position physique", async () => {
      await setVehicleHomeLocation(makeDataSource(db), ID.vehicleOne, ID.locationA);
      const positions = await currentVehiclePositions(makeDataSource(db), { vehicleId: ID.vehicleOne });
      expect(positions[0].home_location_id).toBe(ID.locationA);
      expect(positions[0].current_location_id).toBeNull(); // inchangé : l'affectation n'est pas un déplacement
    });

    it('le journal est append-only et lisible (événements les plus récents d’abord)', async () => {
      const events = await listVehicleMovements(makeDataSource(db), {
        vehicleId: ID.vehicleOne, limit: 10,
      });
      expect(events.length).toBe(2);
      expect(events[0].event_kind).toBe('reservation_return');
      expect(events[1].event_kind).toBe('reservation_pickup');
      expect(events[0].from_location_name).toBe('Delivery Hub');
      expect(events[1].to_location_name).toBe('Delivery Hub');

      const stored = await db.query<{ source: string }>(
        `SELECT source FROM vehicle_location_events WHERE vehicle_id=$1`,
        [ID.vehicleOne],
      );
      expect(stored.rows.every((r) => r.source === 'system')).toBe(true);
    });
  });
});
