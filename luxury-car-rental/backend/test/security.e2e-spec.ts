import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import type { Client } from 'pg';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import dotenv from 'dotenv';

import {
  closeDisposableDatabase,
  openDisposableDatabase,
} from './support/itest-database.js';

import type {
  DisposableDatabase,
} from './support/itest-database.js';

// ==========================================================
// TESTS D'INTÉGRATION HTTP — AUTHENTIFICATION, RBAC ET PROPRIÉTÉ
// ==========================================================
//
// Ces tests démarrent la VRAIE application NestJS (AppModule,
// guards, controllers, TypeORM) branchée sur une base PostgreSQL
// jetable. Ils vérifient au niveau HTTP les règles de sécurité
// réelles, et non des simulations :
//
//   - l'authentification JWT est obligatoire sur les routes privées ;
//   - un client ne peut PAS appeler une route administrateur (403) ;
//   - un client ne voit QUE ses propres réservations ;
//   - un client ne peut PAS lire ni marquer comme lue la notification
//     d'un autre client (404, sans fuite d'information) ;
//   - un mot de passe invalide est refusé (401).
//
// La base est créée puis jetée à chaque exécution : aucune donnée
// de développement n'est touchée.

dotenv.config();

const TEST_DB = 'luxury_car_rental_security_itest';

// IMPORTANT : ces variables doivent être posées AVANT que
// AppModule (et son ConfigModule) ne soit chargé. dotenv ne
// remplace jamais une variable déjà présente dans process.env,
// la connexion TypeORM cible donc bien la base jetable.
process.env.DB_DATABASE = TEST_DB;
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'integration-test-secret-key-0123456789abcdef';
}

const CUSTOMER_PASSWORD = 'CustomerPass123!';
const ADMIN_PASSWORD = 'AdminPass123!';

const ID = {
  customerA: '00000000-0000-4000-8000-0000000000a1',
  customerB: '00000000-0000-4000-8000-0000000000b1',
  admin: '00000000-0000-4000-8000-0000000000c1',
  brand: 'f0000000-0000-4000-8000-0000000000f1',
  category: 'c0000000-0000-4000-8000-0000000000c1',
  model: 'd0000000-0000-4000-8000-0000000000d1',
  vehicle: 'a0000000-0000-4000-8000-0000000000a1',
};

const EMAIL = {
  customerA: 'security.customer.a@example.com',
  customerB: 'security.customer.b@example.com',
  admin: 'security.admin@example.com',
};

let database: DisposableDatabase;
let db: Client;
let app: INestApplication;
let customerAToken = '';
let adminToken = '';
let customerBNotificationId = '';
let customerBReservationNumber = '';

async function seed(target: Client) {
  const customerHash = await argon2.hash(CUSTOMER_PASSWORD);
  const adminHash = await argon2.hash(ADMIN_PASSWORD);

  await target.query(
    `INSERT INTO users (id, email, password_hash, role, status, first_name, last_name)
     VALUES
       ($1, $4, $6, 'customer', 'active', 'Security', 'Alpha'),
       ($2, $5, $6, 'customer', 'active', 'Security', 'Bravo'),
       ($3, $7, $8, 'admin',    'active', 'Security', 'Admin')`,
    [ID.customerA, ID.customerB, ID.admin, EMAIL.customerA, EMAIL.customerB, customerHash, EMAIL.admin, adminHash],
  );

  // Les deux clients ont un permis enregistré : aucune notification
  // « permis requis » ne vient parasiter les assertions de propriété.
  await target.query(
    `INSERT INTO customer_profiles
       (user_id, date_of_birth, license_number, license_country, license_issued_on, license_expires_on)
     VALUES
       ($1, '1990-01-01', 'SEC-A', 'HU', '2015-01-01', '2040-01-01'),
       ($2, '1991-02-02', 'SEC-B', 'HU', '2016-01-01', '2040-01-01')`,
    [ID.customerA, ID.customerB],
  );

  await target.query(`INSERT INTO brands (id, name) VALUES ($1, 'Security Motors')`, [ID.brand]);
  await target.query(`INSERT INTO categories (id, name) VALUES ($1, 'Integration')`, [ID.category]);
  await target.query(
    `INSERT INTO vehicle_models (id, brand_id, category_id, name) VALUES ($1, $2, $3, 'Guard')`,
    [ID.model, ID.brand, ID.category],
  );
  await target.query(
    `INSERT INTO vehicles
       (id, model_id, manufacture_year, license_plate, vin, transmission, fuel_type,
        daily_price, security_deposit, vehicle_value, status)
     VALUES ($1, $2, 2024, 'SEC-01', 'SECVIN00000000001', 'automatic', 'petrol',
             100.00, 1000.00, 90000.00, 'active')`,
    [ID.vehicle, ID.model],
  );

  // Réservation future appartenant AU CLIENT B uniquement.
  const reservation = await target.query<{ reservation_number: string }>(
    `INSERT INTO reservations
       (customer_id, vehicle_id, pickup_at, return_at, rental_days, daily_price,
        deposit_amount, total_amount, status)
     VALUES ($1, $2, '2035-07-01T09:00:00.000Z', '2035-07-03T09:00:00.000Z',
             2, 100.00, 1000.00, 200.00, 'pending')
     RETURNING reservation_number`,
    [ID.customerB, ID.vehicle],
  );
  customerBReservationNumber = reservation.rows[0].reservation_number;

  // Notification privée appartenant AU CLIENT B uniquement.
  const notification = await target.query<{ id: string }>(
    `INSERT INTO user_notifications
       (recipient_id, category, priority, title, message, event_key)
     VALUES ($1, 'reservations', 'info', 'Private to B', 'Belongs to customer B', 'security:private:b')
     RETURNING id`,
    [ID.customerB],
  );
  customerBNotificationId = notification.rows[0].id;
}

async function login(email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return (response.body as { accessToken: string }).accessToken;
}

describe('Sécurité HTTP (PostgreSQL réel + NestJS)', () => {
  beforeAll(async () => {
    database = await openDisposableDatabase(TEST_DB);
    db = database.db;
    await seed(db);

    // AppModule est importé ici : process.env cible déjà la base jetable.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    customerAToken = await login(EMAIL.customerA, CUSTOMER_PASSWORD);
    adminToken = await login(EMAIL.admin, ADMIN_PASSWORD);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    if (database) {
      await closeDisposableDatabase(database);
    }
  });

  // --------------------------------------------------------
  // AUTHENTIFICATION
  // --------------------------------------------------------

  it('refuse une route privée sans jeton (401)', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/notifications/inbox').expect(401);
  });

  it('refuse un mot de passe invalide (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL.customerA, password: 'not-the-password' })
      .expect(401);
  });

  it('authentifie un client valide et expose son identité', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ email: EMAIL.customerA, role: 'customer' });
  });

  it('inscrit un nouveau client puis autorise sa connexion', async () => {
    const email = 'security.newcomer@example.com';
    const password = 'NewcomerPass123!';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ firstName: 'New', lastName: 'Comer', email, password })
      .expect(201);

    const token = await login(email, password);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  // --------------------------------------------------------
  // RBAC : un client ne peut jamais atteindre les routes admin
  // --------------------------------------------------------

  it('interdit à un client l’accès administrateur (403)', async () => {
    await request(app.getHttpServer())
      .get('/auth/admin-check')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/admin/customers')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(403);
  });

  it('autorise un administrateur sur les routes admin', async () => {
    await request(app.getHttpServer())
      .get('/auth/admin-check')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  // --------------------------------------------------------
  // PROPRIÉTÉ DES RÉSERVATIONS
  // --------------------------------------------------------

  it('ne montre au client que ses propres réservations', async () => {
    const response = await request(app.getHttpServer())
      .get('/reservations/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    const numbers = (response.body as { reservationNumber: string }[]).map((r) => r.reservationNumber);
    expect(Array.isArray(response.body)).toBe(true);
    expect(numbers).not.toContain(customerBReservationNumber);
  });

  it('refuse l’annulation de la réservation d’un autre client (404, sans fuite)', async () => {
    await request(app.getHttpServer())
      .patch(`/reservations/by-number/${customerBReservationNumber}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);

    // La réservation de B est intacte.
    const row = await db.query<{ status: string }>(
      'SELECT status FROM reservations WHERE reservation_number = $1',
      [customerBReservationNumber],
    );
    expect(row.rows[0].status).toBe('pending');
  });

  // --------------------------------------------------------
  // PROPRIÉTÉ DES NOTIFICATIONS PRIVÉES
  // --------------------------------------------------------

  it('ne diffuse au client que ses propres notifications', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications/inbox')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    const ids = (response.body as { id: string }[]).map((n) => n.id);
    expect(ids).not.toContain(customerBNotificationId);
  });

  it('refuse de marquer comme lue la notification d’un autre client (404)', async () => {
    await request(app.getHttpServer())
      .patch(`/notifications/inbox/${customerBNotificationId}/read`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);

    // La notification de B reste non lue.
    const row = await db.query<{ read_at: string | null }>(
      'SELECT read_at FROM user_notifications WHERE id = $1',
      [customerBNotificationId],
    );
    expect(row.rows[0].read_at).toBeNull();
  });

  it('valide le format des identifiants de notification (400)', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/inbox/not-a-uuid/read')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(400);
  });
});
