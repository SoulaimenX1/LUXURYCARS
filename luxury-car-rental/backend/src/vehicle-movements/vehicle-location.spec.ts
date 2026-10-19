import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  recordVehicleLocation,
  setVehicleHomeLocation,
  requireDestination,
} from './vehicle-location.js';
import type { Db } from '../zones/zones.queries.js';

// ============================================================
// REGISTRE DE LOCALISATION : événements append-only +
// projection atomique (jamais d'affectation = position).
// ============================================================

const VEHICLE = '550e8400-e29b-41d4-a716-446655440000';
const LOCATION = '7bf18b4c-4e28-439a-8b03-ccb2aa133614';

describe('recordVehicleLocation', () => {
  it("insère l'événement et projette la position dans le MÊME CTE (atomique)", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => [{ id: 'event-id' }]);
    const result = await recordVehicleLocation(
      { query } as unknown as Db,
      {
        vehicleId: VEHICLE,
        eventKind: 'reservation_return',
        toLocationId: LOCATION,
        source: 'system',
        reservationId: VEHICLE,
      },
    );
    expect(result).toEqual({ id: 'event-id' });
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO vehicle_location_events');
    expect(sql).toContain('UPDATE vehicles SET current_location_id=$5');
    expect(sql).toContain('WITH ev AS');
    expect(query.mock.calls[0][1]).toEqual([
      VEHICLE, 'reservation_return', null, null, LOCATION,
      null, null, null, VEHICLE, null, null, 'system', null, null,
    ]);
  });

  it('événement à adresse seule → projection NULL (position jamais inventée)', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => [{ id: 'event-id' }]);
    await recordVehicleLocation({ query } as unknown as Db, {
      vehicleId: VEHICLE,
      eventKind: 'reservation_return',
      toAddress: { line1: 'Fő utca 1', city: 'Budapest', countryCode: 'HU' },
      occurredAt: new Date('2035-07-04T09:00:00.000Z'),
    });
    const params = query.mock.calls[0][1] as unknown[];
    expect(params[4]).toBeNull(); // to_location_id → projection NULL
    expect(JSON.parse(params[6] as string)).toMatchObject({ city: 'Budapest' });
    expect(params[2]).toBe('2035-07-04T09:00:00.000Z');
  });
});

describe('requireDestination', () => {
  it('exige une destination explicite', () => {
    expect(() => requireDestination({})).toThrow(BadRequestException);
    expect(() => requireDestination({ toLocationId: LOCATION })).not.toThrow();
    expect(() => requireDestination({ toAddress: { city: 'Budapest' } })).not.toThrow();
  });
});

describe('setVehicleHomeLocation', () => {
  it("affecte le domicile SANS toucher à la position courante", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM rental_locations')) return [{ id: LOCATION }];
      if (sql.includes('FROM vehicles')) return [{ id: VEHICLE }];
      if (sql.includes('UPDATE vehicles SET home_location_id')) {
        return [{ id: VEHICLE, home_location_id: LOCATION }];
      }
      return [];
    });
    const result = await setVehicleHomeLocation(
      { query } as unknown as Db,
      VEHICLE,
      LOCATION,
    );
    expect(result.home_location_id).toBe(LOCATION);
    const update = query.mock.calls.find((c) =>
      (c[0] as string).includes('UPDATE vehicles SET home_location_id'),
    );
    expect((update![0] as string)).not.toContain('current_location_id');
  });

  it('refuse un domicile inexistant ou désactivé', async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM rental_locations')) return [];
      if (sql.includes('FROM vehicles')) {
        return params?.[0] === VEHICLE ? [{ id: VEHICLE }] : [];
      }
      return [];
    });
    await expect(
      setVehicleHomeLocation({ query } as unknown as Db, VEHICLE, LOCATION),
    ).rejects.toThrow(NotFoundException);
    await expect(
      setVehicleHomeLocation({ query } as unknown as Db, 'autre-id', null),
    ).rejects.toThrow(NotFoundException);
  });
});
