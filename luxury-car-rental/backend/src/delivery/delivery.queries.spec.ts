import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  buildSideFingerprint,
  validateQuoteForBooking,
  assertQuoteMatchesFreshTotal,
  markQuoteAccepted,
} from './delivery.queries.js';
import type { Db } from '../zones/zones.queries.js';

// ============================================================
// REVALIDATION DES DEVIS PERSISTÉS
// ============================================================
// Un devis volé, expiré, déjà utilisé ou dont le prix a changé
// est refusé avec un message distinct — jamais accepté à l'aveugle.

const QUOTE_ID = '3c9d2f10-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const USER = '550e8400-e29b-41d4-a716-446655440000';
const VEHICLE = '7bf18b4c-4e28-439a-8b03-ccb2aa133614';

const pickupAt = new Date('2035-07-01T09:00:00.000+02:00');
const returnAt = new Date('2035-07-04T09:00:00.000+02:00');

const doorFingerprint = {
  mode: 'DOOR_TO_DOOR' as const,
  locationId: null,
  countryCode: 'HU',
  city: 'budapest',
};
const pointFingerprint = {
  mode: 'APPROVED_POINT' as const,
  locationId: VEHICLE,
  countryCode: null,
  city: null,
};

const expected = {
  vehicleId: VEHICLE,
  pickupAt,
  returnAt,
  pickupPoint: doorFingerprint,
  dropoffPoint: pointFingerprint,
};

const quoteRow = (over: Record<string, unknown> = {}) => ({
  id: QUOTE_ID,
  created_for: USER,
  vehicle_id: VEHICLE,
  pickup_at: pickupAt.toISOString(),
  return_at: returnAt.toISOString(),
  pickup_point: doorFingerprint,
  dropoff_point: pointFingerprint,
  breakdown: { totalAmount: '965.00' },
  status: 'issued',
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  ...over,
});

const mockDb = (rows: unknown[]): Db =>
  ({ query: vi.fn(async (_sql: string, _params?: unknown[]) => rows) }) as unknown as Db;

describe('buildSideFingerprint', () => {
  it('normalise le côté point (identifiant seul)', () => {
    expect(
      buildSideFingerprint({ mode: 'APPROVED_POINT', locationId: 'x', address: { countryCode: 'HU', city: 'Budapest' } }),
    ).toEqual({ mode: 'APPROVED_POINT', locationId: 'x', countryCode: null, city: null });
  });

  it('normalise le côté porte (pays ISO + ville sans accents/casse)', () => {
    expect(
      buildSideFingerprint({
        mode: 'DOOR_TO_DOOR',
        address: { countryCode: '  hu ', city: ' BUDAPEST ' },
      }),
    ).toEqual({ mode: 'DOOR_TO_DOOR', locationId: null, countryCode: 'HU', city: 'budapest' });
  });
});

describe('validateQuoteForBooking', () => {
  const params = { quoteId: QUOTE_ID, userId: USER, expected };

  it('accepte un devis valide et retourne la ventilation', async () => {
    const result = await validateQuoteForBooking(mockDb([quoteRow()]), params);
    expect(result.breakdown.totalAmount).toBe('965.00');
  });

  it("inexistant → 404 (et devis d'un autre client → 404, sans fuite)", async () => {
    await expect(validateQuoteForBooking(mockDb([]), params)).rejects.toThrow(NotFoundException);
    await expect(
      validateQuoteForBooking(mockDb([quoteRow({ created_for: 'autre' })]), params),
    ).rejects.toThrow(NotFoundException);
  });

  it('déjà accepté → 409', async () => {
    await expect(
      validateQuoteForBooking(mockDb([quoteRow({ status: 'accepted' })]), params),
    ).rejects.toThrow(ConflictException);
  });

  it('expiré → 409', async () => {
    await expect(
      validateQuoteForBooking(
        mockDb([quoteRow({ expires_at: new Date(Date.now() - 1000).toISOString() })]),
        params,
      ),
    ).rejects.toThrow('expired');
  });

  it('véhicule ou fenêtre différent → 409 (empreinte)', async () => {
    await expect(
      validateQuoteForBooking(mockDb([quoteRow({ vehicle_id: 'autre' })]), params),
    ).rejects.toThrow('does not match');
    await expect(
      validateQuoteForBooking(
        mockDb([quoteRow({ pickup_point: { ...doorFingerprint, city: 'vienna' } })]),
        params,
      ),
    ).rejects.toThrow('does not match');
  });
});

describe('assertQuoteMatchesFreshTotal', () => {
  it('accepte un total identique (y compris nombre équivalent)', () => {
    expect(() => assertQuoteMatchesFreshTotal({ totalAmount: '965.00' }, '965.00')).not.toThrow();
    expect(() => assertQuoteMatchesFreshTotal({}, '965.00')).not.toThrow();
  });

  it('refuse tout écart de prix → nouveau devis obligatoire', () => {
    expect(() => assertQuoteMatchesFreshTotal({ totalAmount: '970.00' }, '965.00')).toThrow(
      ConflictException,
    );
    expect(() => assertQuoteMatchesFreshTotal({ totalAmount: { hack: 1 } }, '965.00')).toThrow(
      ConflictException,
    );
  });
});

describe('markQuoteAccepted', () => {
  it('réclame atomiquement le devis (1 ligne mise à jour)', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => [{ id: QUOTE_ID }]);
    await markQuoteAccepted({ query } as unknown as Db, QUOTE_ID, 'reservation');
    expect(query.mock.calls[0][0]).toContain("status='accepted'");
    expect(query.mock.calls[0][0]).toContain('status=\'issued\'');
  });

  it('0 ligne (expiré/course) → 409', async () => {
    const query = vi.fn(async () => []);
    await expect(
      markQuoteAccepted({ query } as unknown as Db, QUOTE_ID, 'reservation'),
    ).rejects.toThrow(ConflictException);
  });
});
