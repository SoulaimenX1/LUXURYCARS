import { describe, it, expect, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { PremiumService } from './premium.service.js';

// ============================================================
// BRANCHE PORTE-À-PORTE DU DEVIS SERVEUR
// ============================================================
// Les modes sont additionnels : sans `pickupServiceMode` /
// `dropoffServiceMode`, le contrat historique (points seuls)
// reste strictement inchangé — vérifié par la spec existante.
// Ici : tarifs lus dans la configuration admin (zone + règle),
// règle du même pays sur tous les côtés, aucun montant inventé.

const VEHICLE = '550e8400-e29b-41d4-a716-446655440000';
const POINT = '7bf18b4c-4e28-439a-8b03-ccb2aa133614';

type Over = {
  locations?: Record<string, unknown>[];
  zones?: Record<string, unknown>[];
  rules?: Record<string, unknown>[];
};

const mockQuery = (over: Over = {}) =>
  vi.fn(async (sql: string): Promise<unknown[]> => {
    if (sql.includes('FROM vehicles')) {
      return [{ id: VEHICLE, daily_price: '300.00', security_deposit: '2000.00' }];
    }
    if (sql.includes('FROM premium_extras')) return [];
    if (sql.includes('FROM premium_promotions')) return [];
    if (sql.includes('FROM rental_fee_policy')) {
      return [{ lateFeePerDay: '0.00', fuelFeePerPercent: '0.00', mileageAllowancePerDay: 200, excessMileageFee: '0.00' }];
    }
    if (sql.includes('FROM rental_locations')) return over.locations ?? [];
    if (sql.includes('FROM service_zones')) return over.zones ?? [];
    if (sql.includes('FROM delivery_pricing_rules')) return over.rules ?? [];
    return [];
  });

const huZone = {
  id: '9a1b7e2c-1c33-4b55-8c11-2f4d6e8a9b01',
  code: 'HU-ALL',
  name: 'Hongrie — Tout le pays',
  country_code: 'HU',
  active: true,
  address_service_enabled: true,
  cities: [],
  timezone: 'Europe/Budapest',
  opens_at: '09:00:00',
  closes_at: '18:00:00',
  lead_time_minutes: 0,
  cutoff_time: null,
  after_hours_allowed: false,
  holiday_exceptions: [],
  fleet_restrictions: {},
  notes: null,
};

const activeRule = (fee: string) => ({
  fee_mode: 'fixed',
  fixed_fee: fee,
  minimum_fee: null,
  modifiers: {},
});

const placeRow = {
  id: POINT,
  name: 'Budapest Airport (BUD)',
  city: 'Budapest',
  country: 'Hongrie',
  country_code: null,
  category: 'airport',
  pickup_fee: '15.00',
  dropoff_fee: '20.00',
  one_way_fee: '50.00',
  can_pickup: true,
  can_dropoff: true,
};

const service = (over: Over = {}) =>
  new PremiumService({ query: mockQuery(over) } as unknown as DataSource);

describe('PremiumService door-to-door quotation', () => {
  it('door pickup → point: ajoute le tarif zone sans toucher aux frais de point', async () => {
    const s = service({
      locations: [placeRow],
      zones: [huZone],
      rules: [activeRule('45.00')],
    });
    const quote = await s.quote({
      vehicleId: VEHICLE,
      pickupAt: '2035-07-01T09:00:00.000+02:00',
      returnAt: '2035-07-04T09:00:00.000+02:00',
      pickupServiceMode: 'DOOR_TO_DOOR',
      dropoffServiceMode: 'APPROVED_POINT',
      pickupDoor: {
        address: { line1: 'Fő utca 1', city: 'Budapest', countryCode: 'HU' },
      },
      dropoffLocationId: POINT,
    });
    // 3 jours × 300 € + (porte 45 € + restitution point 20 €)
    expect(quote.deliveryAmount).toBe('65.00');
    expect(quote.baseAmount).toBe('900.00');
    expect(quote.totalAmount).toBe('965.00');
    expect(quote.locationFees).toEqual({
      pickup: '0.00',
      dropoff: '20.00',
      oneWay: '0.00',
      doorPickup: '45.00',
      doorDropoff: '0.00',
    });
    expect(quote.pickupMethod).toBe('branch');
    expect(quote.pickupLocationName).toContain('Fő utca 1');
    expect(quote.dropoffLocationName).toContain('Budapest Airport');
    expect(quote.pickupLocationId).toBeNull();
    expect(quote.dropoffLocationId).toBe(POINT);
  });

  it('point → door retour: applique le trajet simple du point d’origine', async () => {
    const s = service({
      locations: [placeRow],
      zones: [huZone],
      rules: [activeRule('45.00')],
    });
    const quote = await s.quote({
      vehicleId: VEHICLE,
      pickupAt: '2035-07-01T09:00:00.000+02:00',
      returnAt: '2035-07-04T09:00:00.000+02:00',
      pickupServiceMode: 'APPROVED_POINT',
      dropoffServiceMode: 'DOOR_TO_DOOR',
      pickupLocationId: POINT,
      dropoffDoor: {
        address: { line1: 'Andrássy út 5', city: 'Budapest', countryCode: 'HU' },
      },
    });
    // pickup point 15 € + porte 45 € + one-way 50 €
    expect(quote.deliveryAmount).toBe('110.00');
    expect(quote.locationFees).toEqual({
      pickup: '15.00',
      dropoff: '0.00',
      oneWay: '50.00',
      doorPickup: '0.00',
      doorDropoff: '45.00',
    });
    expect(quote.dropoffLocationName).toContain('Andrássy út 5');
  });

  it('applique la règle du même pays sur tous les côtés (codes ISO)', async () => {
    const s = service({ locations: [placeRow], zones: [huZone], rules: [activeRule('45.00')] });
    await expect(
      s.quote({
        vehicleId: VEHICLE,
        pickupAt: '2035-07-01T09:00:00.000+02:00',
        returnAt: '2035-07-04T09:00:00.000+02:00',
        pickupServiceMode: 'APPROVED_POINT',
        dropoffServiceMode: 'DOOR_TO_DOOR',
        pickupLocationId: POINT, // Hongrie
        dropoffDoor: {
          address: { line1: '1 Rue de la Paix', city: 'Paris', countryCode: 'FR' },
        },
      }),
    ).rejects.toThrow('same country');
  });

  it('refuse explicitement quand aucune règle active ne tarife la porte', async () => {
    const s = service({ locations: [placeRow], zones: [huZone], rules: [] });
    await expect(
      s.quote({
        vehicleId: VEHICLE,
        pickupAt: '2035-07-01T09:00:00.000+02:00',
        returnAt: '2035-07-04T09:00:00.000+02:00',
        pickupServiceMode: 'DOOR_TO_DOOR',
        dropoffServiceMode: 'APPROVED_POINT',
        pickupDoor: { address: { line1: 'Fő utca 1', city: 'Budapest', countryCode: 'HU' } },
        dropoffLocationId: POINT,
      }),
    ).rejects.toThrow('pricing-not-configured');
  });

  it('refuse un mode porte-à-porte sans adresse', async () => {
    const s = service({ locations: [placeRow], zones: [huZone], rules: [activeRule('45.00')] });
    await expect(
      s.quote({
        vehicleId: VEHICLE,
        pickupAt: '2035-07-01T09:00:00.000+02:00',
        returnAt: '2035-07-04T09:00:00.000+02:00',
        pickupServiceMode: 'DOOR_TO_DOOR',
        dropoffServiceMode: 'APPROVED_POINT',
        dropoffLocationId: POINT,
      }),
    ).rejects.toThrow('pickup address is required');
  });

  it('conserve le contrat historique sans modes (frais aéroport fixes)', async () => {
    const s = service(); // aucune requête de zone/sertisseur
    const quote = await s.quote({
      vehicleId: VEHICLE,
      pickupDate: '2035-07-01',
      returnDate: '2035-07-04',
      pickupMethod: 'airport',
    });
    expect(quote.deliveryAmount).toBe('80.00');
    expect(quote.locationFees).toEqual({ pickup: '0.00', dropoff: '0.00', oneWay: '0.00' });
    expect(quote.pickupMethod).toBe('airport');
  });
});
