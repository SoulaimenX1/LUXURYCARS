import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import type { DataSource } from 'typeorm';
import dotenv from 'dotenv';

import { AvailabilityService } from '../src/availability/availability.service.js';
import { LocationsService } from '../src/locations/locations.service.js';

// ==========================================================
// TESTS D'INTÉGRATION — DISPONIBILITÉ PAR VÉHICULE PHYSIQUE
// ==========================================================
//
// Ces tests s'exécutent contre une vraie base PostgreSQL
// jetable : le schéma réel (schema.sql + patches) est appliqué,
// puis AvailabilityService/LocationsService interrogent la base
// avec EXACTEMENT les mêmes requêtes qu'en production.
//
// Ils vérifient les règles réelles (contrainte EXCLUDE, triggers
// réservation <-> indisponibilité, statuts bloquants, frontière
// de retour, tampon de préparation, lieux, concurrence) et non
// des simulations.
//
// RÈGLE MÉTIER : une entreprise peut posséder PLUSIEURS véhicules
// physiques du même modèle (même marque, même nom, années
// éventuellement identiques). La disponibilité se calcule donc
// PAR vehicle_id et jamais par marque ni par modèle.

dotenv.config();

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DB_PORT ?? 5432);
const DB_USER = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const TEST_DB = 'luxury_car_rental_availability_itest';

const BACKEND_ROOT = join(__dirname, '..');
const SCHEMA_FILE = join(BACKEND_ROOT, 'database', 'schema.sql');
const PATCH_DIR = join(BACKEND_ROOT, 'database', 'patches');

// Identifiants stables pour rejouer les tests sur une base neuve.
const ID = {
  customerUser: '00000000-0000-4000-8000-000000000001',
  staffUser: '00000000-0000-4000-8000-000000000002',
  brand: 'f0000000-0000-4000-8000-000000000001',
  category: 'c0000000-0000-4000-8000-000000000001',
  modelOne: 'd0000000-0000-4000-8000-000000000001',
  modelTwo: 'd0000000-0000-4000-8000-000000000002',
  vehicleOne: 'a0000000-0000-4000-8000-000000000001',
  vehicleTwo: 'a0000000-0000-4000-8000-000000000002',
  vehicleThree: 'a0000000-0000-4000-8000-000000000003',
  locationA: 'b0000000-0000-4000-8000-000000000001',
  locationB: 'b0000000-0000-4000-8000-000000000002',
  locationForeign: 'b0000000-0000-4000-8000-000000000003',
  locationPickupOnly: 'b0000000-0000-4000-8000-000000000004',
  locationDropoffOnly: 'b0000000-0000-4000-8000-000000000005',
};

// Instants futurs : la disponibilité exige un départ dans le futur.
// Les heures restent dans la plage 09:00–18:00 du point de service
// (Europe/Budapest = UTC+2 en été) : 09:00Z = 11:00 locale, etc.
const T = {
  d1: '2035-06-01T09:00:00.000Z',
  d1b: '2035-06-01T10:00:00.000Z',
  d2: '2035-06-02T09:00:00.000Z',
  d2b: '2035-06-02T10:00:00.000Z',
  d2Early: '2035-06-02T07:30:00.000Z',
  d2Evening: '2035-06-02T17:00:00.000Z',
  d3: '2035-06-03T09:00:00.000Z',
  d4: '2035-06-04T09:00:00.000Z',
  d5: '2035-06-05T09:00:00.000Z',
};

let admin: Client;
let db: Client;
let service: AvailabilityService;
let locations: LocationsService;

function clientFor(database: string): Client {
  return new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
  });
}

// Adaptateur minimal : AvailabilityService et LocationsService
// n'utilisent que `dataSource.query`. On branche donc le client
// PostgreSQL réel directement dessus.
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
       ($1, 'itest.customer@example.com', 'x', 'customer', 'Test', 'Customer'),
       ($2, 'itest.staff@example.com', 'x', 'staff', 'Test', 'Staff')`,
    [ID.customerUser, ID.staffUser],
  );
  await target.query(
    `INSERT INTO customer_profiles
       (user_id, date_of_birth, license_number, license_country, license_issued_on, license_expires_on)
     VALUES ($1, '1990-01-01', 'ITEST-1', 'HU', '2015-01-01', '2040-01-01')`,
    [ID.customerUser],
  );
  await target.query(
    `INSERT INTO brands (id, name) VALUES ($1, 'Integration Motors')`,
    [ID.brand],
  );
  await target.query(
    `INSERT INTO categories (id, name) VALUES ($1, 'Grand Tourer')`,
    [ID.category],
  );
  await target.query(
    `INSERT INTO vehicle_models (id, brand_id, category_id, name)
     VALUES ($1, $3, $4, 'One'), ($2, $3, $4, 'Two')`,
    [ID.modelOne, ID.modelTwo, ID.brand, ID.category],
  );

  // Plusieurs véhicules physiques peuvent partager un même modèle :
  // vehicleTwo et vehicleThree référencent le même modèle (modelTwo)
  // mais restent des véhicules distincts (id, année, plaque, VIN propres).
  await target.query(
    `INSERT INTO vehicles
       (id, model_id, manufacture_year, license_plate, vin, transmission, fuel_type,
        daily_price, security_deposit, vehicle_value, status)
     VALUES
       ($1, $4, 2024, 'ITEST-01', 'VIN00000000000001', 'automatic', 'petrol', 320.00, 2800.00, 250000.00, 'active'),
       ($2, $5, 2024, 'ITEST-02', 'VIN00000000000002', 'automatic', 'hybrid', 240.00, 2000.00, 140000.00, 'active'),
       ($3, $5, 2023, 'ITEST-03', 'VIN00000000000003', 'automatic', 'petrol', 180.00, 1500.00, 90000.00, 'active')`,
    [ID.vehicleOne, ID.vehicleTwo, ID.vehicleThree, ID.modelOne, ID.modelTwo],
  );

  await target.query(
    `INSERT INTO rental_locations
       (id, code, name, category, city, country, address, can_pickup, can_dropoff, enabled,
        timezone, opens_at, closes_at, turnaround_minutes)
     VALUES
       ($1, 'ITEST-A', 'Integration Hub', 'showroom', 'Budapest', 'Hongrie', 'A utca 1', true, true, true, 'Europe/Budapest', '09:00', '18:00', 0),
       ($2, 'ITEST-B', 'Integration Airport', 'airport', 'Budapest', 'Hongrie', 'B utca 2', true, true, true, 'Europe/Budapest', '09:00', '18:00', 0),
       ($3, 'ITEST-C', 'Foreign Hub', 'showroom', 'Paris', 'France', 'C rue 3', true, true, true, 'Europe/Paris', '09:00', '18:00', 0),
       ($4, 'ITEST-P', 'Pickup Only Hub', 'showroom', 'Budapest', 'Hongrie', 'P utca 4', true, false, true, 'Europe/Budapest', '09:00', '18:00', 0),
       ($5, 'ITEST-D', 'Dropoff Only Hub', 'showroom', 'Budapest', 'Hongrie', 'D utca 5', false, true, true, 'Europe/Budapest', '10:00', '20:00', 0)`,
    [ID.locationA, ID.locationB, ID.locationForeign, ID.locationPickupOnly, ID.locationDropoffOnly],
  );
}

async function insertReservation(
  target: Client,
  options: {
    vehicleId?: string;
    from: string;
    to: string;
    status?: string;
  },
): Promise<{ id: string }> {
  const row = await target.query<{ id: string }>(
    `INSERT INTO reservations
       (customer_id, vehicle_id, pickup_at, return_at, rental_days, daily_price, deposit_amount, total_amount, status)
     VALUES ($1, $2, $3, $4, 2, 100.00, 1000.00, 200.00, $5)
     RETURNING id`,
    [
      ID.customerUser,
      options.vehicleId ?? ID.vehicleOne,
      options.from,
      options.to,
      options.status ?? 'confirmed',
    ],
  );
  return row.rows[0];
}

const check = (from: string, to: string, extra: Partial<Parameters<AvailabilityService['check']>[0]> = {}) =>
  service.check({
    vehicleId: ID.vehicleOne,
    pickupLocationId: ID.locationA,
    dropoffLocationId: ID.locationA,
    pickupAt: from,
    returnAt: to,
    ...extra,
  });

describe('AvailabilityService (PostgreSQL réel)', () => {
  beforeAll(async () => {
    admin = clientFor('postgres');
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);

    db = clientFor(TEST_DB);
    await db.connect();
    await applyBaseline(db);
    await seed(db);

    service = new AvailabilityService(makeDataSource(db), new LocationsService(makeDataSource(db)));
    locations = new LocationsService(makeDataSource(db));
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await admin?.end();
  });

  beforeEach(async () => {
    // Repartir d'un planning vide entre chaque scénario (base jetable).
    await db.query(
      'TRUNCATE rentals, vehicle_unavailability, reservations RESTART IDENTITY CASCADE',
    );
    await db.query('UPDATE rental_locations SET turnaround_minutes = 0');
    await db.query("UPDATE vehicles SET status = 'active'");
    // Les affectations véhicule <-> lieu font partie du scénario de
    // disponibilité : repartir d'un état vierge (politique « aucun lien
    // = tous les lieux »).
    await db.query('DELETE FROM vehicle_rental_locations');
  });

  it('autorise plusieurs véhicules physiques pour le même modèle', async () => {
    // Deux véhicules physiques distincts (années, plaques et VIN
    // différents) référencent le MÊME modèle : c'est autorisé. Le
    // catalogue de modèles est partagé, jamais la flotte.
    const rows = await db.query<{ id: string; year: number; plate: string }>(
      `SELECT id, manufacture_year AS year, license_plate AS plate
         FROM vehicles WHERE model_id = $1 ORDER BY license_plate`,
      [ID.modelTwo],
    );
    expect(rows.rows.length).toBe(2);
    const ids = rows.rows.map(
      (row: { id: string; year: number; plate: string }) => row.id,
    );
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(ID.vehicleTwo);
    expect(ids).toContain(ID.vehicleThree);
  });

  it('ne crée aucune contrainte UNIQUE sur le modèle ou l’année', async () => {
    // Aucune contrainte d'unicité ne doit porter sur model_id,
    // manufacture_year, ni sur un couple marque/modèle/année :
    // seuls id, immatriculation et VIN sont uniques par véhicule.
    const rows = await db.query<{ conname: string; def: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'vehicles'::regclass
          AND contype IN ('u', 'x')`,
    );
    const defs = rows.rows.map(
      (row: { conname: string; def: string }) => row.def,
    );
    expect(defs.some((def: string) => def.includes('UNIQUE (license_plate)'))).toBe(
      true,
    );
    expect(defs.some((def: string) => def.includes('UNIQUE (vin)'))).toBe(true);
    for (const def of defs) {
      expect(def).not.toMatch(/model_id|manufacture_year/i);
    }
  });

  it('autorise deux véhicules du même modèle et de la même année', async () => {
    // Reproduit l'exemple métier : deux G63 2024 cohabitent comme
    // véhicules physiques distincts (seuls id, plaque et VIN diffèrent).
    const duplicateId = 'a0000000-0000-4000-8000-000000000099';
    try {
      await db.query(
        `INSERT INTO vehicles
           (id, model_id, manufacture_year, license_plate, vin, transmission, fuel_type,
            daily_price, security_deposit, vehicle_value, status)
         VALUES ($1, $2, 2024, 'ITEST-99', 'VIN00000000000099',
                 'automatic', 'petrol', 210.00, 1800.00, 120000.00, 'active')`,
        [duplicateId, ID.modelTwo],
      );
      const rows = await db.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM vehicles WHERE model_id = $1 AND manufacture_year = 2024',
        [ID.modelTwo],
      );
      expect(Number(rows.rows[0].total)).toBeGreaterThanOrEqual(2);
    } finally {
      await db.query('DELETE FROM vehicles WHERE id = $1', [duplicateId]);
    }
  });

  it('une réservation ne bloque que le véhicule physique concerné', async () => {
    // vehicleTwo et vehicleThree partagent le même modèle mais sont
    // des véhicules physiques distincts : bloquer l'un ne doit jamais
    // bloquer l'autre.
    await insertReservation(db, { vehicleId: ID.vehicleTwo, from: T.d1, to: T.d3 });

    const blocked = await service.check({
      vehicleId: ID.vehicleTwo,
      pickupLocationId: ID.locationA,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(blocked.available).toBe(false);

    const stillFree = await service.check({
      vehicleId: ID.vehicleThree,
      pickupLocationId: ID.locationA,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(stillFree.available).toBe(true);
  });

  it('accepte un intervalle réellement libre', async () => {
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('refuse une réservation entièrement chevauchante', async () => {
    await insertReservation(db, { from: T.d1, to: T.d3 });
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('conflict');
  });

  it('refuse un chevauchement partiel (début et fin)', async () => {
    await insertReservation(db, { from: T.d2, to: T.d4 });

    const before = await check(T.d1, T.d3); // fin à l'intérieur
    expect(before.available).toBe(false);

    const after = await check(T.d3, T.d5); // début à l'intérieur
    expect(after.available).toBe(false);
  });

  it('refuse une demande identique (mêmes instants)', async () => {
    await insertReservation(db, { from: T.d1, to: T.d3 });
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(false);
  });

  it('autorise une prise en charge exactement à la fin du retour précédent', async () => {
    // Contrainte EXCLUDE en intervalle semi-ouvert [) : la frontière
    // exacte (return === pickup suivant) n'est PAS un chevauchement.
    await insertReservation(db, { from: T.d1, to: T.d3 });
    const result = await check(T.d3, T.d5);
    expect(result.available).toBe(true);
  });

  it('applique le tampon de préparation configurable', async () => {
    await insertReservation(db, { from: T.d1, to: T.d2 });

    const withoutBuffer = await check(T.d2b, T.d4);
    expect(withoutBuffer.available).toBe(true);

    await db.query(
      "UPDATE rental_locations SET turnaround_minutes = 180 WHERE id = $1",
      [ID.locationA],
    );
    const withBuffer = await check(T.d2b, T.d4);
    expect(withBuffer.available).toBe(false);
    expect(withBuffer.reason).toBe('conflict');
  });

  it('ignore une réservation annulée', async () => {
    await insertReservation(db, { from: T.d1, to: T.d3, status: 'cancelled' });
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(true);
  });

  it('ignore une réservation rejetée ou expirée', async () => {
    await insertReservation(db, { from: T.d1, to: T.d3, status: 'rejected' });
    await insertReservation(db, { from: T.d1, to: T.d3, status: 'expired' });
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(true);
  });

  it('bloque pendant une location active (même sans réservation bloquante)', async () => {
    // Réservation annulée : elle ne bloque pas par elle-même, mais la
    // location active qui y est rattachée rend bien le véhicule indisponible.
    const reservation = await insertReservation(db, {
      vehicleId: ID.vehicleThree,
      from: T.d1,
      to: T.d3,
      status: 'cancelled',
    });
    await db.query(
      `INSERT INTO rentals (reservation_id, status, started_at, expected_return_at, opened_by)
       VALUES ($1, 'active', $2, $3, $4)`,
      [reservation.id, T.d1, T.d3, ID.staffUser],
    );
    const result = await service.check({
      vehicleId: ID.vehicleThree,
      pickupLocationId: ID.locationA,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('conflict');
  });

  it('bloque pendant une immobilisation technique', async () => {
    await db.query(
      `INSERT INTO vehicle_unavailability (vehicle_id, starts_at, ends_at, reason, created_by)
       VALUES ($1, $2, $3, 'maintenance', $4)`,
      [ID.vehicleOne, T.d1, T.d3, ID.staffUser],
    );
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('conflict');
  });

  it('refuse un véhicule inactif', async () => {
    await db.query("UPDATE vehicles SET status = 'retired' WHERE id = $1", [ID.vehicleOne]);
    const result = await check(T.d1, T.d3);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('vehicle_inactive');
  });

  it('autorise des lieux différents dans le même pays', async () => {
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationA,
      dropoffLocationId: ID.locationB,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(result.available).toBe(true);
  });

  it('refuse une restitution dans un autre pays', async () => {
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationA,
      dropoffLocationId: ID.locationForeign,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('cross_country');
  });

  // ----------------------------------------------------------
  // ISSUE 06 — la restitution est validée même à l'identique.
  // ----------------------------------------------------------
  it('ISSUE 06 : refuse une restitution sur un point « pickup only » identique au pickup', async () => {
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationPickupOnly,
      dropoffLocationId: ID.locationPickupOnly,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('dropoff_disabled');
  });

  it('ISSUE 06 : refuse une restitution sur un point « pickup only » sans dropoff explicite', async () => {
    // Même sans dropoffLocationId, le point de prise en charge est le
    // point de restitution effectif et doit donc accepter le dépôt.
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationPickupOnly,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('dropoff_disabled');
  });

  it('ISSUE 06 : le calendrier refuse aussi un point « pickup only »', async () => {
    await expect(
      service.calendar(ID.vehicleOne, ID.locationPickupOnly, '2035-06'),
    ).rejects.toThrow();
  });

  // ----------------------------------------------------------
  // ISSUE 04 — les horaires de restitution suivent le dropoff.
  // ----------------------------------------------------------
  it('ISSUE 04 : accepte une restitution 19:00 locale au point d’ouverture 10:00-20:00', async () => {
    // Pickup à Integration Hub (09:00-18:00) ; restitution au point
    // « dropoff only » ouvert 10:00-20:00. 17:00Z = 19:00 à Budapest
    // (UTC+2 en juin) : hors horaires du pickup mais dans ceux du dropoff.
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationA,
      dropoffLocationId: ID.locationDropoffOnly,
      pickupAt: T.d1,
      returnAt: T.d2Evening,
    });
    expect(result.available).toBe(true);
  });

  it('ISSUE 04 : refuse une restitution 09:30 locale au point ouvrant à 10:00', async () => {
    // 07:30Z = 09:30 à Budapest : valide pour le pickup (09:00-18:00)
    // mais trop tôt pour le point de restitution (ouvre à 10:00).
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationA,
      dropoffLocationId: ID.locationDropoffOnly,
      pickupAt: T.d1,
      returnAt: T.d2Early,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('outside_return_hours');
  });

  it('ISSUE 04 : la prise en charge garde les horaires du pickup', async () => {
    // 06:30Z = 08:30 à Budapest : avant l'ouverture du pickup (09:00),
    // quel que soit le point de restitution choisi.
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationA,
      dropoffLocationId: ID.locationDropoffOnly,
      pickupAt: '2035-06-01T06:30:00.000Z',
      returnAt: T.d2Evening,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('outside_pickup_hours');
  });

  it('ISSUE 04 : le calendrier expose les créneaux de restitution du dropoff', async () => {
    const calendar = await service.calendar(
      ID.vehicleOne,
      ID.locationA,
      '2035-06',
      ID.locationDropoffOnly,
    );
    const day = calendar.days.find((item) => item.date === '2035-06-02');
    expect(day).toBeTruthy();
    const times = (day?.returnSlots ?? []).map((slot) => slot.time);
    // Ouverture du dropoff à 10:00 : aucun créneau de restitution avant.
    expect(times).not.toContain('09:00');
    expect(times).toContain('10:00');
    expect(times).toContain('19:30');
  });

  // ----------------------------------------------------------
  // ISSUE 05 — éligibilité séparée pickup / dropoff.
  // ----------------------------------------------------------
  it('ISSUE 05 : la liste pickup exclut un point « dropoff only »', async () => {
    const list = await locations.listForVehicle(ID.vehicleOne, 'pickup');
    const ids = list.map((item) => item.id);
    expect(ids).toContain(ID.locationPickupOnly);
    expect(ids).not.toContain(ID.locationDropoffOnly);
  });

  it('ISSUE 05 : la liste dropoff inclut un point « dropoff only »', async () => {
    const list = await locations.listForVehicle(ID.vehicleOne, 'dropoff');
    const ids = list.map((item) => item.id);
    expect(ids).toContain(ID.locationDropoffOnly);
    expect(ids).not.toContain(ID.locationPickupOnly);
  });

  it('ISSUE 05 : la liste « all » contient les deux capacités', async () => {
    const list = await locations.listForVehicle(ID.vehicleOne, 'all');
    const ids = list.map((item) => item.id);
    expect(ids).toContain(ID.locationPickupOnly);
    expect(ids).toContain(ID.locationDropoffOnly);
  });

  it('ISSUE 05 : le scope par défaut reste la prise en charge', async () => {
    const list = await locations.listForVehicle(ID.vehicleOne);
    const ids = list.map((item) => item.id);
    expect(ids).toContain(ID.locationPickupOnly);
    expect(ids).not.toContain(ID.locationDropoffOnly);
  });

  // ----------------------------------------------------------
  // ISSUE 11 — politique « aucun lien = tous les lieux ».
  // ----------------------------------------------------------
  it('ISSUE 11 : un véhicule sans affectation est disponible dans tous les lieux', async () => {
    expect(await locations.vehicleSupportsLocation(ID.vehicleOne, ID.locationA)).toBe(true);
    expect(await locations.vehicleSupportsLocation(ID.vehicleOne, ID.locationB)).toBe(true);
    const list = await locations.listForVehicle(ID.vehicleOne, 'pickup');
    expect(list.length).toBeGreaterThanOrEqual(4);
  });

  it('ISSUE 11 : dès qu’une affectation existe, seuls les lieux affectés sont disponibles', async () => {
    await db.query(
      'INSERT INTO vehicle_rental_locations (vehicle_id, location_id) VALUES ($1, $2)',
      [ID.vehicleOne, ID.locationA],
    );
    expect(await locations.vehicleSupportsLocation(ID.vehicleOne, ID.locationA)).toBe(true);
    expect(await locations.vehicleSupportsLocation(ID.vehicleOne, ID.locationB)).toBe(false);

    // Le calendrier et la validation doivent refuser un lieu non affecté.
    const result = await service.check({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationB,
      pickupAt: T.d1,
      returnAt: T.d3,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('location_not_supported');

    const list = await locations.listForVehicle(ID.vehicleOne, 'pickup');
    expect(list.map((item) => item.id)).toEqual([ID.locationA]);
  });

  it('exclut la réservation en cours de modification (workflow admin)', async () => {
    const reservation = await insertReservation(db, { from: T.d1, to: T.d3 });
    const result = await check(T.d1b, T.d2, { excludeReservationId: reservation.id });
    expect(result.available).toBe(true);
  });

  it('reflète les vraies réservations dans le calendrier', async () => {
    await insertReservation(db, { from: T.d1, to: T.d3 });
    const calendar = await service.calendar(ID.vehicleOne, ID.locationA, '2035-06');
    const day1 = calendar.days.find((day) => day.date === '2035-06-01');
    const day4 = calendar.days.find((day) => day.date === '2035-06-04');
    expect(day1?.status).not.toBe('available');
    expect(day4?.slots.length).toBeGreaterThan(0);
  });

  it('propose la prochaine période libre et des véhicules réellement disponibles', async () => {
    await insertReservation(db, { from: T.d1, to: T.d3 });
    const result = await service.getAlternatives({
      vehicleId: ID.vehicleOne,
      pickupLocationId: ID.locationA,
      dropoffLocationId: ID.locationA,
      pickupAt: T.d1,
      returnAt: T.d3,
    });

    expect(result.available).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.nextAvailable).not.toBeNull();

    const next = result.nextAvailable;
    if (next) {
      // La période suggérée ne doit jamais être fictive : on la revalide.
      const revalidated = await service.check({
        vehicleId: ID.vehicleOne,
        pickupLocationId: ID.locationA,
        pickupAt: next.pickupAt,
        returnAt: next.returnAt,
      });
      expect(revalidated.available).toBe(true);
      expect(new Date(next.pickupAt).getTime()).toBeGreaterThanOrEqual(new Date(T.d3).getTime());
    }

    const ids = result.alternatives.map((vehicle) => vehicle.vehicleId);
    expect(ids).toContain(ID.vehicleTwo);
    expect(ids).not.toContain(ID.vehicleOne);
  });

  it('fait évoluer la disponibilité après la confirmation d’un autre client', async () => {
    const first = await check(T.d1, T.d3);
    expect(first.available).toBe(true);

    // Un autre client confirme une réservation sur le même véhicule.
    await insertReservation(db, { from: T.d1, to: T.d3, status: 'confirmed' });

    const second = await check(T.d1, T.d3);
    expect(second.available).toBe(false);
    expect(second.reason).toBe('conflict');
  });

  it('empêche deux réservations simultanées sur le même véhicule', async () => {
    // Reproduit exactement le chemin applicatif : verrou de la ligne
    // véhicule (FOR UPDATE ... SKIP LOCKED) puis insertion.
    const attempt = async (): Promise<boolean> => {
      const client = clientFor(TEST_DB);
      await client.connect();
      try {
        await client.query('BEGIN');
        const available = await client.query(
          `SELECT v.id
             FROM vehicles v
             WHERE v.id = $1::uuid
               AND v.status = 'active'
               AND v.id IN (
                 SELECT available.id FROM find_available_vehicles($2::timestamptz, $3::timestamptz) AS available
               )
             LIMIT 1
             FOR UPDATE OF v SKIP LOCKED`,
          [ID.vehicleOne, T.d1, T.d3],
        );
        if (available.rowCount === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query(
          `INSERT INTO reservations
             (customer_id, vehicle_id, pickup_at, return_at, rental_days, daily_price, deposit_amount, total_amount, status)
           VALUES ($1, $2, $3, $4, 2, 100.00, 1000.00, 200.00, 'confirmed')`,
          [ID.customerUser, ID.vehicleOne, T.d1, T.d3],
        );
        await client.query('COMMIT');
        return true;
      } catch {
        await client.query('ROLLBACK');
        return false;
      } finally {
        await client.end();
      }
    };

    const outcomes = await Promise.all([attempt(), attempt()]);
    expect(outcomes.filter(Boolean).length).toBe(1);

    const stored = await db.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM reservations WHERE vehicle_id = $1 AND status = \'confirmed\'',
      [ID.vehicleOne],
    );
    expect(stored.rows[0].total).toBe('1');
  });

  it('garantit au niveau base deux insertions concurrentes (contrainte EXCLUDE)', async () => {
    // Même en contournant le verrou applicatif, la contrainte
    // d'exclusion PostgreSQL doit refuser la seconde insertion.
    const directInsert = async (): Promise<boolean> => {
      const client = clientFor(TEST_DB);
      await client.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO reservations
             (customer_id, vehicle_id, pickup_at, return_at, rental_days, daily_price, deposit_amount, total_amount, status)
           VALUES ($1, $2, $3, $4, 2, 100.00, 1000.00, 200.00, 'confirmed')`,
          [ID.customerUser, ID.vehicleOne, T.d1, T.d3],
        );
        await client.query('COMMIT');
        return true;
      } catch {
        await client.query('ROLLBACK');
        return false;
      } finally {
        await client.end();
      }
    };

    const outcomes = await Promise.all([directInsert(), directInsert()]);
    expect(outcomes.filter(Boolean).length).toBe(1);
  });
});
