import { describe, it, expect, vi } from 'vitest';
import {
  canonicalCountry,
  normalizeCity,
  timeToMinutes,
  zonedParts,
  findEligibleZone,
  quoteDoorService,
  type Db,
  type ZoneRow,
} from './zones.queries.js';

// ============================================================
// Éligibilité des zones + tarif porte-à-porte.
// Aucun montant n'est inventé : pas de règle active = refus
// explicite, jamais un 0.00 silencieux.
// ============================================================

const zoneRow = (over: Partial<ZoneRow> = {}): ZoneRow => ({
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
  ...over,
});

type Handlers = {
  zones?: ZoneRow[];
  anyZones?: { active: boolean; address_service_enabled: boolean }[];
  rules?: unknown[];
  vehicle?: { category_name: string | null }[];
};

const mockDb = (handlers: Handlers): Db =>
  ({
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT active, address_service_enabled FROM service_zones')) {
        return handlers.anyZones ?? [];
      }
      if (sql.includes('FROM service_zones')) return handlers.zones ?? [];
      if (sql.includes('FROM delivery_pricing_rules')) return handlers.rules ?? [];
      if (sql.includes('FROM vehicles v')) return handlers.vehicle ?? [];
      return [];
    }),
  }) as unknown as Db;

const rule = (over: Record<string, unknown> = {}) => ({
  fee_mode: 'fixed',
  fixed_fee: '45.00',
  minimum_fee: null,
  modifiers: {},
  ...over,
});

describe('helpers géographiques purs', () => {
  it('normalise les pays en code ISO (libellés historiques inclus)', () => {
    expect(canonicalCountry('FR')).toBe('FR');
    expect(canonicalCountry('france')).toBe('FR');
    expect(canonicalCountry('Hongrie')).toBe('HU');
    expect(canonicalCountry('hungary')).toBe('HU');
    expect(canonicalCountry('Allemagne')).toBe('DE');
    expect(canonicalCountry('Suisse')).toBe('CH');
    expect(canonicalCountry('')).toBe('');
  });

  it('normalise les villes (casse, espaces, accents)', () => {
    expect(normalizeCity('  BUDAPEST ')).toBe('budapest');
    expect(normalizeCity('Marseille')).toBe('marseille');
    expect(normalizeCity('Székesfehérvár')).toBe('szekesfehervar');
  });

  it('convertit les horaires HH:MM(:SS) en minutes', () => {
    expect(timeToMinutes('09:00:00')).toBe(540);
    expect(timeToMinutes('18:30')).toBe(1110);
    expect(timeToMinutes(null)).toBe(0);
  });

  it("calcule la date/heure locale DANS le fuseau (pas de décalage simulé)", () => {
    const parts = zonedParts(new Date('2035-07-01T10:00:00Z'), 'Europe/Budapest');
    expect(parts.date).toBe('2035-07-01');
    expect(parts.minutes).toBe(12 * 60); // UTC+2 en été
    const winter = zonedParts(new Date('2035-01-15T10:00:00Z'), 'Europe/Budapest');
    expect(winter.minutes).toBe(11 * 60); // UTC+1 en hiver
  });
});

describe('findEligibleZone', () => {
  it("refuse un pays sans zone ('address-not-in-zone')", async () => {
    const verdict = await findEligibleZone(mockDb({ zones: [], anyZones: [] }), {
      countryCode: 'HU',
      city: 'Budapest',
    });
    expect(verdict.zone).toBeNull();
    expect(verdict.reason).toBe('address-not-in-zone');
  });

  it("refuse une zone inactive ('no-active-zone')", async () => {
    const verdict = await findEligibleZone(
      mockDb({ zones: [], anyZones: [{ active: false, address_service_enabled: true }] }),
      { countryCode: 'HU', city: 'Budapest' },
    );
    expect(verdict.reason).toBe('no-active-zone');
  });

  it("refuse le service adresse désactivé ('address-service-disabled')", async () => {
    const verdict = await findEligibleZone(
      mockDb({ zones: [], anyZones: [{ active: true, address_service_enabled: false }] }),
      { countryCode: 'HU', city: 'Budapest' },
    );
    expect(verdict.reason).toBe('address-service-disabled');
  });

  it("refuse une ville hors liste ('city-not-in-zone')", async () => {
    const verdict = await findEligibleZone(
      mockDb({ zones: [zoneRow({ cities: ['Budapest', 'Debrecen'] })] }),
      { countryCode: 'HU', city: 'Pécs' },
    );
    expect(verdict.zone).toBeNull();
    expect(verdict.reason).toBe('city-not-in-zone');
  });

  it('accepte une liste de villes vide = tout le pays (casse ignorée)', async () => {
    const verdict = await findEligibleZone(mockDb({ zones: [zoneRow()] }), {
      countryCode: 'HU',
      city: 'győr',
    });
    expect(verdict.zone?.code).toBe('HU-ALL');
  });

  it('accepte une ville listée (normalisation comprise)', async () => {
    const verdict = await findEligibleZone(
      mockDb({ zones: [zoneRow({ cities: ['Budapest'] })] }),
      { countryCode: 'HU', city: '  BUDAPEST ' },
    );
    expect(verdict.zone).not.toBeNull();
  });
});

describe('quoteDoorService', () => {
  // Fenêtre 09:00–18:00 (Europe/Budapest, UTC+2 en juillet).
  const inHours = '2035-07-01T09:00:00+02:00';
  const afterHours = '2035-07-01T19:00:00+02:00';

  const base = {
    countryCode: 'HU',
    city: 'Budapest',
    serviceType: 'door_pickup' as const,
    vehicleId: '550e8400-e29b-41d4-a716-446655440000',
  };

  it("refuse sans zone active ('address-not-in-zone')", async () => {
    const out = await quoteDoorService(mockDb({ zones: [], anyZones: [] }), {
      ...base,
      scheduledAt: new Date(inHours),
    });
    expect(out).toEqual({ ok: false, reason: 'address-not-in-zone' });
  });

  it("refuse sans règle active ('pricing-not-configured') — jamais un prix inventé", async () => {
    const out = await quoteDoorService(mockDb({ zones: [zoneRow()], rules: [] }), {
      ...base,
      scheduledAt: new Date(inHours),
    });
    expect(out).toEqual({ ok: false, reason: 'pricing-not-configured' });
  });

  it("refuse une règle brouillon ('pricing-not-configured')", async () => {
    const out = await quoteDoorService(
      mockDb({ zones: [zoneRow()], rules: [rule({ fixed_fee: null })] }),
      { ...base, scheduledAt: new Date(inHours) },
    );
    expect(out).toEqual({ ok: false, reason: 'pricing-not-configured' });
  });

  it('retourne le montant actif configuré (aucun montant du navigateur)', async () => {
    const out = await quoteDoorService(mockDb({ zones: [zoneRow()], rules: [rule()] }), {
      ...base,
      scheduledAt: new Date(inHours),
    });
    expect(out).toEqual({ ok: true, feeCents: 4500, zoneCode: 'HU-ALL' });
  });

  it("hors heures sans service après hours ('outside-operating-hours')", async () => {
    const out = await quoteDoorService(
      mockDb({ zones: [zoneRow()], rules: [rule()] }),
      { ...base, scheduledAt: new Date(afterHours) },
    );
    expect(out).toEqual({ ok: false, reason: 'outside-operating-hours' });
  });

  it('hors heures + après hours autorisé + majoration explicite', async () => {
    const out = await quoteDoorService(
      mockDb({
        zones: [zoneRow({ after_hours_allowed: true })],
        rules: [rule({ modifiers: { afterHours: { fee: '10.00' } } })],
      }),
      { ...base, scheduledAt: new Date(afterHours) },
    );
    expect(out).toEqual({ ok: true, feeCents: 5500, zoneCode: 'HU-ALL' });
  });

  it('majoration week-end uniquement si configurée (jours explicites)', async () => {
    const out = await quoteDoorService(
      mockDb({
        zones: [zoneRow()],
        rules: [rule({ modifiers: { weekend: { days: [0, 1, 2, 3, 4, 5, 6], fee: { fee: '5.00' } } } })],
      }),
      { ...base, scheduledAt: new Date(inHours) },
    );
    expect(out).toEqual({ ok: true, feeCents: 5000, zoneCode: 'HU-ALL' });
  });

  it('applique le montant minimum configuré', async () => {
    const out = await quoteDoorService(
      mockDb({ zones: [zoneRow()], rules: [rule({ minimum_fee: '60.00' })] }),
      { ...base, scheduledAt: new Date(inHours) },
    );
    expect(out).toEqual({ ok: true, feeCents: 6000, zoneCode: 'HU-ALL' });
  });

  it("refuse une prestation le jour d'une fermeture ('zone-closed')", async () => {
    const out = await quoteDoorService(
      mockDb({
        zones: [zoneRow({ holiday_exceptions: [{ date: '2035-12-25', closed: true }] })],
        rules: [rule()],
      }),
      { ...base, scheduledAt: new Date('2035-12-25T10:00:00+01:00') },
    );
    expect(out).toEqual({ ok: false, reason: 'zone-closed' });
  });

  it("applique un délai minimum ('insufficient-lead-time')", async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000); // +30 min < 120 min
    const out = await quoteDoorService(
      mockDb({ zones: [zoneRow({ lead_time_minutes: 120 })], rules: [rule()] }),
      { ...base, scheduledAt: soon },
    );
    expect(out).toEqual({ ok: false, reason: 'insufficient-lead-time' });
  });

  it("refuse une réservation le jour même après la coupure ('booking-after-cutoff')", async () => {
    const out = await quoteDoorService(
      mockDb({ zones: [zoneRow({ cutoff_time: '00:00' })], rules: [rule()] }),
      { ...base, scheduledAt: new Date() },
    );
    expect(out).toEqual({ ok: false, reason: 'booking-after-cutoff' });
  });

  it("applique la restriction de flotte (catégorie via le modèle, jamais le client)", async () => {
    const restricted = zoneRow({ fleet_restrictions: { categories: ['Sports Car'] } });
    const ok = await quoteDoorService(mockDb({ zones: [restricted], rules: [rule()], vehicle: [{ category_name: 'Sports Car' }] }), {
      ...base,
      scheduledAt: new Date(inHours),
    });
    expect(ok.ok).toBe(true);
    const ko = await quoteDoorService(mockDb({ zones: [restricted], rules: [rule()], vehicle: [{ category_name: 'SUV' }] }), {
      ...base,
      scheduledAt: new Date(inHours),
    });
    expect(ko).toEqual({ ok: false, reason: 'vehicle-not-allowed-in-zone' });
  });
});
