import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
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
// TESTS D'INTÉGRATION HTTP — LIMITATION DE DÉBIT AUTH
// ==========================================================
//
// Démarre la VRAIE application NestJS et limite volontairement les
// seuils (via overrideProvider) pour observer le comportement réel :
//
//   - l'inscription est bloquée en HTTP 429 après N requêtes par IP ;
//   - la connexion est bloquée en HTTP 429 après N tentatives par compte ;
//   - la réponse 429 expose l'en-tête `Retry-After`.
//
// La base de développement n'est jamais touchée.

dotenv.config();

const TEST_DB = 'luxury_car_rental_ratelimit_itest';

process.env.DB_DATABASE = TEST_DB;
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'integration-test-secret-key-0123456789abcdef';
}

const CUSTOMER_ID = '00000000-0000-4000-8000-0000000000d1';
const CUSTOMER_EMAIL = 'ratelimit.customer@example.com';
const CUSTOMER_PASSWORD = 'CustomerPass123!';

// Seuils volontairement bas pour provoquer facilement un 429.
const TEST_RATE_LIMIT = {
  windowMs: 60_000,
  registerMaxPerIp: 3,
  loginMaxPerIp: 1_000,
  loginMaxPerAccount: 3,
};

let database: DisposableDatabase;
let app: INestApplication;

async function seed() {
  const hash = await argon2.hash(CUSTOMER_PASSWORD);

  await database.db.query(
    `INSERT INTO users (id, email, password_hash, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'customer', 'active', 'Rate', 'Limit')`,
    [CUSTOMER_ID, CUSTOMER_EMAIL, hash],
  );
}

describe('Limitation de débit (PostgreSQL réel + NestJS)', () => {
  beforeAll(async () => {
    database = await openDisposableDatabase(TEST_DB);
    await seed();

    const { AppModule } = await import('../src/app.module.js');

    const { AUTH_RATE_LIMIT_OPTIONS } = await import(
      '../src/auth/rate-limit/auth-rate-limit.options.js'
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_RATE_LIMIT_OPTIONS)
      .useValue(TEST_RATE_LIMIT)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    if (database) {
      await closeDisposableDatabase(database);
    }
  });

  // --------------------------------------------------------
  // INSCRIPTION : limite par IP
  // --------------------------------------------------------

  it('autorise les inscriptions sous le seuil puis bloque en 429', async () => {
    const server = app.getHttpServer();

    for (let index = 0; index < TEST_RATE_LIMIT.registerMaxPerIp; index += 1) {
      await request(server)
        .post('/auth/register')
        .send({
          firstName: 'Rate',
          lastName: `Number${index}`,
          email: `ratelimit.register.${index}@example.com`,
          password: 'RateLimitPass123!',
        })
        .expect(201);
    }

    const blocked = await request(server)
      .post('/auth/register')
      .send({
        firstName: 'Rate',
        lastName: 'Blocked',
        email: 'ratelimit.register.blocked@example.com',
        password: 'RateLimitPass123!',
      })
      .expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
    expect(
      Number(blocked.headers['retry-after']),
    ).toBeGreaterThan(0);
  });

  // --------------------------------------------------------
  // CONNEXION : limite par compte
  // --------------------------------------------------------

  it('bloque la connexion après N tentatives pour un même compte (429)', async () => {
    const server = app.getHttpServer();

    for (let attempt = 0; attempt < TEST_RATE_LIMIT.loginMaxPerAccount; attempt += 1) {
      await request(server)
        .post('/auth/login')
        .send({ email: CUSTOMER_EMAIL, password: 'wrong-password' })
        .expect(401);
    }

    const blocked = await request(server)
      .post('/auth/login')
      .send({ email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD })
      .expect(429);

    // Même avec le BON mot de passe, la limite s'applique d'abord.
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('n’affecte pas un autre compte', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ratelimit.register.0@example.com', password: 'RateLimitPass123!' })
      .expect(200);
  });
});
