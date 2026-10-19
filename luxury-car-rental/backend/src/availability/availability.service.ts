import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LocationsService } from '../locations/locations.service.js';
import type { RentalLocation } from '../locations/locations.service.js';
import { formatDateInZone, slotTimes, zonedWallTimeToUtc } from './timezone.js';
import { canonicalCountry, findEligibleZone, type ZoneRow } from '../zones/zones.queries.js';

export const SLOT_MINUTES = 30;
export const MIN_RENTAL_DAYS = 1;
export const MAX_RENTAL_DAYS = 365;

export interface CalendarSlot {
  time: string;
  at: string;
}

export interface CalendarDay {
  date: string;
  status: 'available' | 'partial' | 'unavailable' | 'past';
  slots: CalendarSlot[];
  returnSlots: CalendarSlot[];
  reason: string | null;
}

export interface CalendarResponse {
  vehicleId: string;
  locationId: string;
  month: string;
  timezone: string;
  slotMinutes: number;
  minRentalDays: number;
  location: {
    id: string;
    name: string;
    category: string;
    city: string;
    country: string;
    address: string;
    timezone: string;
    opensAt: string;
    closesAt: string;
  };
  days: CalendarDay[];
}

export interface AvailabilityCheckResult {
  available: boolean;
  reason: string | null;
  message: string | null;
  details: {
    vehicleId: string;
    pickupLocationId: string | null;
    pickupAt: string;
    returnAt: string;
    rentalDays: number;
    timezone: string;
    minRentalDays: number;
    openingHours: { opensAt: string; closesAt: string } | null;
  } | null;
}

export interface NextAvailable {
  pickupAt: string;
  returnAt: string;
  durationDays: number;
}

export interface AlternativeVehicle {
  vehicleId: string;
  modelId: string;
  brandName?: string;
  modelName?: string;
  imageUrl?: string | null;
  dailyPrice?: number | null;
  available: boolean;
}

export interface AlternativesResponse {
  vehicleId: string;
  requested: {
    pickupAt: string;
    returnAt: string;
    pickupLocationId: string;
    dropoffLocationId: string;
  };
  available: boolean;
  message?: string | null;
  nextAvailable: NextAvailable | null;
  alternatives: AlternativeVehicle[];
}

interface Block {
  from: Date;
  to: Date;
}

// Deux intervalles entrent en conflit s'ils se chevauchent ou si
// l'écart entre eux est inférieur au délai de remise en service.
function conflicts(startMs: number, endMs: number, block: Block, bufferMs: number): boolean {
  return startMs < block.to.getTime() + bufferMs && block.from.getTime() < endMs + bufferMs;
}

function billedDays(pickupAt: Date, returnAt: Date): number {
  const milliseconds = returnAt.getTime() - pickupAt.getTime();
  return Math.max(MIN_RENTAL_DAYS, Math.ceil(milliseconds / 86_400_000));
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly locations: LocationsService,
  ) {}

  private async requireVehicle(vehicleId: string): Promise<{ id: string; status: string }> {
    const rows: { id: string; status: string }[] = await this.dataSource.query(
      `SELECT id, status FROM vehicles WHERE id = $1::uuid`,
      [vehicleId],
    );
    if (!rows[0]) throw new NotFoundException('Vehicle not found');
    return rows[0];
  }

  // Réservations bloquantes, indisponibilités et locations actives.
  // `excludeReservationId` permet à l'administration de réévaluer une
  // réservation en cours de modification sans qu'elle se bloque elle-même.
  private async loadBlocks(
    vehicleId: string,
    from: Date,
    to: Date,
    excludeReservationId?: string,
  ): Promise<Block[]> {
    const reservations: { from: Date; to: Date }[] = await this.dataSource.query(
      `SELECT pickup_at AS "from", return_at AS "to"
       FROM reservations
       WHERE vehicle_id = $1::uuid
         AND status IN ('pending', 'confirmed', 'converted')
         AND return_at > $2::timestamptz
         AND pickup_at < $3::timestamptz
         AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [vehicleId, from.toISOString(), to.toISOString(), excludeReservationId ?? null],
    );

    const unavailability: { from: Date; to: Date }[] = await this.dataSource.query(
      `SELECT starts_at AS "from", ends_at AS "to"
       FROM vehicle_unavailability
       WHERE vehicle_id = $1::uuid
         AND ends_at > $2::timestamptz
         AND starts_at < $3::timestamptz`,
      [vehicleId, from.toISOString(), to.toISOString()],
    );

    const rentals: { from: Date; to: Date }[] = await this.dataSource.query(
      `SELECT r.started_at AS "from", r.expected_return_at AS "to"
       FROM rentals r
       JOIN reservations res ON res.id = r.reservation_id
       WHERE res.vehicle_id = $1::uuid
         AND r.status = 'active'
         AND r.expected_return_at > $2::timestamptz
         AND r.started_at < $3::timestamptz`,
      [vehicleId, from.toISOString(), to.toISOString()],
    );

    return [...reservations, ...unavailability, ...rentals].map((row) => ({
      from: new Date(row.from),
      to: new Date(row.to),
    }));
  }

  private bufferMs(location: RentalLocation): number {
    return Math.max(0, Number(location.turnaroundMinutes) || 0) * 60_000;
  }

  // ========================================================
  // CALENDRIER MENSUEL RÉEL
  // ========================================================
  async calendar(vehicleId: string, locationId: string, month: string, dropoffLocationId?: string): Promise<CalendarResponse> {
    const vehicle = await this.requireVehicle(vehicleId);

    let location: RentalLocation;
    try {
      location = await this.locations.getLocation(locationId);
    } catch {
      throw new NotFoundException('Pickup location not found');
    }
    if (!location.enabled || !location.canPickup) {
      throw new BadRequestException('Pickup location is not available');
    }
    if (!(await this.locations.vehicleSupportsLocation(vehicleId, locationId))) {
      throw new BadRequestException('Vehicle is not available at this location');
    }

    // ISSUE 04 : les créneaux de restitution suivent le point de
    // restitution effectif (horaires + fuseau), pas ceux du pickup.
    let dropoff: RentalLocation = location;
    if (dropoffLocationId && dropoffLocationId !== locationId) {
      try {
        dropoff = await this.locations.getLocation(dropoffLocationId);
      } catch {
        throw new NotFoundException('Drop-off location not found');
      }
      if (!dropoff.enabled || !dropoff.canDropoff) {
        throw new BadRequestException('Drop-off location is not available');
      }
      if (dropoff.country !== location.country) {
        throw new BadRequestException('Pickup and drop-off must be in the same country');
      }
      if (!(await this.locations.vehicleSupportsLocation(vehicleId, dropoffLocationId))) {
        throw new BadRequestException('Vehicle cannot be returned at this location');
      }
    } else if (!dropoff.canDropoff) {
      // ISSUE 06 : un point « pickup only » ne peut pas servir de restitution,
      // y compris lorsqu'il est identique au point de prise en charge.
      throw new BadRequestException('Drop-off location is not available');
    }

    const timezone = location.timezone || 'Europe/Paris';
    const dropoffTimezone = dropoff.timezone || timezone;
    const buffer = this.bufferMs(location);

    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const firstDate = `${month}-01`;
    const nextMonth = monthNumber === 12
      ? `${year + 1}-01`
      : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;

    const rangeStart = zonedWallTimeToUtc(firstDate, '00:00', timezone);
    const rangeEnd = zonedWallTimeToUtc(`${nextMonth}-01`, '00:00', timezone);

    const blocks = await this.loadBlocks(vehicleId, rangeStart, rangeEnd);
    const now = Date.now();
    const timesOfDay = slotTimes(location.opensAt, location.closesAt, SLOT_MINUTES);
    const returnTimesOfDay = dropoffLocationId && dropoffLocationId !== locationId
      ? slotTimes(dropoff.opensAt, dropoff.closesAt, SLOT_MINUTES)
      : timesOfDay;

    const days: CalendarDay[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${month}-${String(day).padStart(2, '0')}`;

      if (vehicle.status !== 'active') {
        days.push({
          date,
          status: 'unavailable',
          slots: [],
          returnSlots: [],
          reason: 'Vehicle is not available for rental',
        });
        continue;
      }

      const windowEnd = zonedWallTimeToUtc(date, location.closesAt, timezone);
      if (windowEnd.getTime() <= now) {
        days.push({ date, status: 'past', slots: [], returnSlots: [], reason: null });
        continue;
      }

      const slots: CalendarSlot[] = [];
      const returnSlots: CalendarSlot[] = [];
      let futureSteps = 0;

      for (const time of timesOfDay) {
        const at = zonedWallTimeToUtc(date, time, timezone);
        if (at.getTime() < now) continue;
        futureSteps += 1;

        const start = at.getTime();
        const minimumEnd = start + MIN_RENTAL_DAYS * 86_400_000;
        if (!blocks.some((block) => conflicts(start, minimumEnd, block, buffer))) {
          slots.push({ time, at: at.toISOString() });
        }
      }

      // Créneaux de restitution : horaires/fuseau du point de restitution.
      for (const time of returnTimesOfDay) {
        const at = zonedWallTimeToUtc(date, time, dropoffTimezone);
        const instant = at.getTime();
        if (instant < now) continue;
        const insideBlock = blocks.some(
          (block) => block.from.getTime() < instant && instant < block.to.getTime(),
        );
        if (!insideBlock) returnSlots.push({ time, at: at.toISOString() });
      }

      let status: 'available' | 'partial' | 'unavailable';
      if (slots.length === 0) status = 'unavailable';
      else if (futureSteps > 0 && slots.length >= futureSteps) status = 'available';
      else status = 'partial';

      days.push({
        date,
        status,
        slots,
        returnSlots,
        reason: status === 'unavailable'
          ? 'No valid rental interval of at least one day starts on this date'
          : null,
      });
    }

    return {
      vehicleId,
      locationId,
      month,
      timezone,
      slotMinutes: SLOT_MINUTES,
      minRentalDays: MIN_RENTAL_DAYS,
      location: {
        id: location.id,
        name: location.name,
        category: location.category,
        city: location.city,
        country: location.country,
        address: location.address,
        timezone,
        opensAt: location.opensAt,
        closesAt: location.closesAt,
      },
      days,
    };
  }

  // ========================================================
  // VALIDATION D'UN INTERVALLE COMPLET
  // ========================================================
  async check(input: {
    vehicleId: string;
    pickupLocationId?: string;
    pickupAt: string;
    returnAt: string;
    dropoffLocationId?: string;
    excludeReservationId?: string;
    // Modes de service (additionnels) : un côté « porte-à-porte »
    // est validé par sa zone de service active, pas par un lieu.
    pickupServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
    dropoffServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
    pickupDoor?: { city: string; countryCode: string };
    dropoffDoor?: { city: string; countryCode: string };
  }): Promise<AvailabilityCheckResult> {
    const pickupAt = new Date(input.pickupAt);
    const returnAt = new Date(input.returnAt);
    if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime())) {
      throw new BadRequestException('Invalid pickup or return datetime');
    }

    const pickupMode = input.pickupServiceMode ?? 'APPROVED_POINT';
    const dropoffMode = input.dropoffServiceMode ?? 'APPROVED_POINT';
    if (pickupMode === 'APPROVED_POINT' && !input.pickupLocationId) {
      throw new BadRequestException('Pickup location is required');
    }
    if (pickupMode === 'DOOR_TO_DOOR' && !input.pickupDoor) {
      throw new BadRequestException('A pickup address is required for door-to-door collection');
    }
    if (dropoffMode === 'DOOR_TO_DOOR' && !input.dropoffDoor) {
      throw new BadRequestException('A return address is required for door-to-door return');
    }

    const vehicle = await this.requireVehicle(input.vehicleId);

    const unavailable = (
      reason: string,
      message: string,
      timezone = 'Europe/Paris',
      openingHours: { opensAt: string; closesAt: string } | null = null,
    ): AvailabilityCheckResult => ({
      available: false,
      reason,
      message,
      details: {
        vehicleId: input.vehicleId,
        pickupLocationId: input.pickupLocationId ?? null,
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        rentalDays: billedDays(pickupAt, returnAt),
        timezone,
        minRentalDays: MIN_RENTAL_DAYS,
        openingHours,
      },
    });

    // ---- Côté « point de service » (pickup) ----
    let location: RentalLocation | null = null;
    if (pickupMode === 'APPROVED_POINT') {
      try {
        location = await this.locations.getLocation(input.pickupLocationId!);
      } catch {
        return unavailable('location_not_found', 'Pickup location not found');
      }
      if (!location.enabled || !location.canPickup) {
        return unavailable('location_disabled', 'Pickup location is not available', location.timezone || 'Europe/Paris', { opensAt: location.opensAt, closesAt: location.closesAt });
      }
      if (!(await this.locations.vehicleSupportsLocation(input.vehicleId, input.pickupLocationId!))) {
        return unavailable('location_not_supported', 'Vehicle is not available at this location', location.timezone || 'Europe/Paris', { opensAt: location.opensAt, closesAt: location.closesAt });
      }
    }

    const timezone = location?.timezone || 'Europe/Paris';
    const openingHours: { opensAt: string; closesAt: string } | null =
      location ? { opensAt: location.opensAt, closesAt: location.closesAt } : null;

    // ---- Côté « point de service » (restitution) ----
    // ISSUE 04 / ISSUE 06 : le point de restitution effectif est toujours
    // validé, même lorsqu'il est identique au point de prise en charge. Un
    // point « pickup only » (canDropoff = false) ne peut jamais servir de
    // restitution, et la règle du même pays s'applique dans tous les cas.
    const dropoffLocationId = dropoffMode === 'DOOR_TO_DOOR'
      ? null
      : (input.dropoffLocationId ?? input.pickupLocationId ?? null);
    let dropoff: RentalLocation | null = dropoffMode === 'DOOR_TO_DOOR' ? null : location;
    if (dropoffMode !== 'DOOR_TO_DOOR' && dropoffLocationId !== input.pickupLocationId) {
      try {
        dropoff = await this.locations.getLocation(dropoffLocationId!);
      } catch {
        return unavailable('dropoff_not_found', 'Drop-off location not found', timezone, openingHours);
      }
    }
    if (dropoff && (!dropoff.enabled || !dropoff.canDropoff)) {
      const dropoffZone = dropoff.timezone || timezone;
      return unavailable(
        'dropoff_disabled',
        'Drop-off location is not available',
        dropoffZone,
        { opensAt: dropoff.opensAt, closesAt: dropoff.closesAt },
      );
    }
    if (dropoffMode !== 'DOOR_TO_DOOR' && dropoffLocationId !== input.pickupLocationId && dropoff &&
        !(await this.locations.vehicleSupportsLocation(input.vehicleId, dropoffLocationId!))) {
      return unavailable('dropoff_not_supported', 'Vehicle cannot be returned at this location', timezone, openingHours);
    }

    // ---- Éligibilité des côtés porte-à-porte + pays unique ----
    // La règle du même pays s'applique sur TOUS les côtés, codes ISO
    // normalisés (les libellés historiques « Hongrie », « France » …
    // sont ramenés à leur code).
    const sideCountries: (string | null)[] = [];
    if (location) sideCountries.push(canonicalCountry(location.country));
    if (dropoff && dropoff !== location) sideCountries.push(canonicalCountry(dropoff.country));
    let pickupZoneRow: ZoneRow | null = null;
    let dropoffZoneRow: ZoneRow | null = null;
    if (pickupMode === 'DOOR_TO_DOOR') {
      const verdict = await findEligibleZone(this.dataSource, {
        countryCode: input.pickupDoor!.countryCode,
        city: input.pickupDoor!.city,
      });
      if (!verdict.zone) {
        return unavailable('pickup_zone_unavailable', 'Pickup address is not inside an active delivery zone', timezone, openingHours);
      }
      pickupZoneRow = verdict.zone;
      sideCountries.push(canonicalCountry(verdict.zone.country_code));
    }
    if (dropoffMode === 'DOOR_TO_DOOR') {
      const verdict = await findEligibleZone(this.dataSource, {
        countryCode: input.dropoffDoor!.countryCode,
        city: input.dropoffDoor!.city,
      });
      if (!verdict.zone) {
        return unavailable('dropoff_zone_unavailable', 'Return address is not inside an active delivery zone', timezone, openingHours);
      }
      dropoffZoneRow = verdict.zone;
      sideCountries.push(canonicalCountry(verdict.zone.country_code));
    }
    if (new Set(sideCountries.filter((c): c is string => Boolean(c))).size > 1) {
      return unavailable('cross_country', 'Pickup and drop-off must be in the same country', timezone, openingHours);
    }
    if (vehicle.status !== 'active') {
      return unavailable('vehicle_inactive', 'Vehicle is not available for rental', timezone, openingHours);
    }
    if (returnAt.getTime() <= pickupAt.getTime()) {
      return unavailable('invalid_range', 'Return datetime must be after pickup datetime', timezone, openingHours);
    }
    if (pickupAt.getTime() <= Date.now()) {
      return unavailable('pickup_in_past', 'Pickup datetime must be in the past-future window', timezone, openingHours);
    }

    const days = billedDays(pickupAt, returnAt);
    if (days > MAX_RENTAL_DAYS) {
      return unavailable('duration_too_long', `Maximum rental duration is ${MAX_RENTAL_DAYS} days`, timezone, openingHours);
    }

    // Enlèvement et restitution doivent se situer pendant les
    // heures d'ouverture (heure locale) : celles du point de
    // service, ou de la zone de service pour un côté porte-à-porte.
    if (location) {
      const pickupWindowStart = zonedWallTimeToUtc(formatDateInZone(pickupAt, timezone), location.opensAt, timezone);
      const pickupWindowEnd = zonedWallTimeToUtc(formatDateInZone(pickupAt, timezone), location.closesAt, timezone);
      if (pickupAt.getTime() < pickupWindowStart.getTime() || pickupAt.getTime() >= pickupWindowEnd.getTime()) {
        return unavailable('outside_pickup_hours', `Pickup must be between ${location.opensAt} and ${location.closesAt} (${timezone})`, timezone, openingHours);
      }
    } else if (pickupZoneRow) {
      // Même convention que les points : fermeture exclue au pickup.
      const zoneTz = pickupZoneRow.timezone || timezone;
      const windowStart = zonedWallTimeToUtc(formatDateInZone(pickupAt, zoneTz), pickupZoneRow.opens_at, zoneTz);
      const windowEnd = zonedWallTimeToUtc(formatDateInZone(pickupAt, zoneTz), pickupZoneRow.closes_at, zoneTz);
      if (pickupAt.getTime() < windowStart.getTime() || pickupAt.getTime() >= windowEnd.getTime()) {
        return unavailable('outside_pickup_hours', `Pickup must be between ${pickupZoneRow.opens_at} and ${pickupZoneRow.closes_at} (${zoneTz})`, zoneTz, { opensAt: pickupZoneRow.opens_at, closesAt: pickupZoneRow.closes_at });
      }
    }

    // ISSUE 04 : la restitution est validée avec les horaires et le fuseau
    // du point de restitution effectif, et non ceux du point de prise en
    // charge. La prise en charge garde, elle, les horaires du pickup.
    if (dropoff) {
      const dropoffTimezone = dropoff.timezone || timezone;
      const returnWindowStart = zonedWallTimeToUtc(formatDateInZone(returnAt, dropoffTimezone), dropoff.opensAt, dropoffTimezone);
      const returnWindowEnd = zonedWallTimeToUtc(formatDateInZone(returnAt, dropoffTimezone), dropoff.closesAt, dropoffTimezone);
      if (returnAt.getTime() < returnWindowStart.getTime() || returnAt.getTime() > returnWindowEnd.getTime()) {
        return unavailable(
          'outside_return_hours',
          `Return must be between ${dropoff.opensAt} and ${dropoff.closesAt} (${dropoffTimezone})`,
          dropoffTimezone,
          { opensAt: dropoff.opensAt, closesAt: dropoff.closesAt },
        );
      }
    } else if (dropoffZoneRow) {
      // Même convention que les points : fermeture incluse au retour.
      const zoneTz = dropoffZoneRow.timezone || timezone;
      const windowStart = zonedWallTimeToUtc(formatDateInZone(returnAt, zoneTz), dropoffZoneRow.opens_at, zoneTz);
      const windowEnd = zonedWallTimeToUtc(formatDateInZone(returnAt, zoneTz), dropoffZoneRow.closes_at, zoneTz);
      if (returnAt.getTime() < windowStart.getTime() || returnAt.getTime() > windowEnd.getTime()) {
        return unavailable('outside_return_hours', `Return must be between ${dropoffZoneRow.opens_at} and ${dropoffZoneRow.closes_at} (${zoneTz})`, zoneTz, { opensAt: dropoffZoneRow.opens_at, closesAt: dropoffZoneRow.closes_at });
      }
    }

    const buffer = location ? this.bufferMs(location) : (dropoff ? this.bufferMs(dropoff) : 0);
    const blocks = await this.loadBlocks(
      input.vehicleId,
      new Date(pickupAt.getTime() - buffer),
      new Date(returnAt.getTime() + buffer),
      input.excludeReservationId,
    );
    const blocked = blocks.some((block) =>
      conflicts(pickupAt.getTime(), returnAt.getTime(), block, buffer),
    );
    if (blocked) {
      return unavailable('conflict', 'The selected period is no longer available for this vehicle', timezone, openingHours);
    }

    return {
      available: true,
      reason: null,
      message: null,
      details: {
        vehicleId: input.vehicleId,
        pickupLocationId: input.pickupLocationId ?? null,
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        rentalDays: days,
        timezone,
        minRentalDays: MIN_RENTAL_DAYS,
        openingHours,
      },
    };
  }

  // ========================================================
  // ALTERNATIVES
  // ========================================================
  async getAlternatives(input: {
    vehicleId: string;
    pickupLocationId: string;
    pickupAt: string;
    returnAt: string;
    dropoffLocationId?: string;
    durationDays?: number;
  }): Promise<AlternativesResponse> {
    const pickupAt = new Date(input.pickupAt);
    const returnAt = new Date(input.returnAt);
    const dropoffLocationId = input.dropoffLocationId ?? input.pickupLocationId;

    const initialCheck = await this.check({
      vehicleId: input.vehicleId,
      pickupLocationId: input.pickupLocationId,
      pickupAt: pickupAt.toISOString(),
      returnAt: returnAt.toISOString(),
      dropoffLocationId,
    });

    const durationMs = returnAt.getTime() - pickupAt.getTime();
    const durationDays = input.durationDays ?? Math.max(MIN_RENTAL_DAYS, Math.ceil(durationMs / 86_400_000));

    if (initialCheck.available) {
      return {
        vehicleId: input.vehicleId,
        requested: {
          pickupAt: pickupAt.toISOString(),
          returnAt: returnAt.toISOString(),
          pickupLocationId: input.pickupLocationId,
          dropoffLocationId,
        },
        available: true,
        nextAvailable: null,
        alternatives: [],
      };
    }

    const location = await this.locations.getLocation(input.pickupLocationId);
    const timezone = location.timezone || 'Europe/Paris';
    const buffer = this.bufferMs(location);

    const nextAvailable = await this.findNextAvailableInterval(
      input.vehicleId,
      location,
      timezone,
      buffer,
      durationDays,
      pickupAt,
    );

    const alternatives = await this.findSimilarAvailableVehicles(
      input.vehicleId,
      input.pickupLocationId,
      dropoffLocationId,
      pickupAt,
      returnAt,
    );

    return {
      vehicleId: input.vehicleId,
      requested: {
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        pickupLocationId: input.pickupLocationId,
        dropoffLocationId,
      },
      available: false,
      message: initialCheck.message ?? 'This vehicle is unavailable for your selected dates',
      nextAvailable,
      alternatives,
    };
  }

  private async findNextAvailableInterval(
    vehicleId: string,
    location: RentalLocation,
    timezone: string,
    buffer: number,
    durationDays: number,
    fromTime: Date,
  ): Promise<NextAvailable | null> {
    // Recherche bornée : 90 jours glissants, candidats calés sur
    // les heures d'ouverture du point de service (heure locale).
    const searchDays = 90;
    const durationMs = durationDays * 86_400_000;

    for (let day = 0; day < searchDays; day += 1) {
      // Premier instant candidat : l'ouverture de ce jour-là,
      // ou `fromTime` si celui-ci tombe déjà pendant ce jour.
      const dayDate = new Date(fromTime.getTime() + day * 86_400_000);
      const dayStr = formatDateInZone(dayDate, timezone);
      let candidatePickup: Date;
      try {
        const openUtc = zonedWallTimeToUtc(dayStr, location.opensAt, timezone);
        const closeUtc = zonedWallTimeToUtc(dayStr, location.closesAt, timezone);
        candidatePickup = openUtc.getTime() > fromTime.getTime() ? openUtc : fromTime;
        if (candidatePickup.getTime() > closeUtc.getTime()) {
          // Après la fermeture : la proposition ouvre le lendemain.
          continue;
        }
        if (candidatePickup.getTime() < openUtc.getTime()) {
          continue;
        }
      } catch {
        continue;
      }

      const candidateReturn = new Date(candidatePickup.getTime() + durationMs);

      // Retour pendant les heures d'ouverture du jour de restitution.
      const returnDayStr = formatDateInZone(candidateReturn, timezone);
      let withinHours = true;
      try {
        const returnOpen = zonedWallTimeToUtc(returnDayStr, location.opensAt, timezone);
        const returnClose = zonedWallTimeToUtc(returnDayStr, location.closesAt, timezone);
        if (candidateReturn.getTime() < returnOpen.getTime() || candidateReturn.getTime() > returnClose.getTime()) {
          withinHours = false;
        }
      } catch {
        withinHours = false;
      }
      if (!withinHours) continue;

      const blocks = await this.loadBlocks(
        vehicleId,
        new Date(candidatePickup.getTime() - buffer),
        new Date(candidateReturn.getTime() + buffer),
      );
      const blocked = blocks.some((block) =>
        conflicts(candidatePickup.getTime(), candidateReturn.getTime(), block, buffer),
      );
      if (blocked) continue;

      const chk = await this.check({
        vehicleId,
        pickupLocationId: location.id,
        pickupAt: candidatePickup.toISOString(),
        returnAt: candidateReturn.toISOString(),
      });
      if (chk.available) {
        return {
          pickupAt: candidatePickup.toISOString(),
          returnAt: candidateReturn.toISOString(),
          durationDays,
        };
      }
    }
    return null;
  }

  private async findSimilarAvailableVehicles(
    excludeVehicleId: string,
    pickupLocationId: string,
    dropoffLocationId: string,
    pickupAt: Date,
    returnAt: Date,
  ): Promise<AlternativeVehicle[]> {
    // Véhicules actifs du même modèle ou de la même catégorie,
    // avec leur image principale pour une proposition utilisable
    // directement dans l'interface client.
    const vehicles: Array<{
      id: string;
      modelId: string;
      status: string;
      dailyPrice: number | null;
      brandName: string | null;
      modelName: string | null;
      categoryName: string | null;
      imageUrl: string | null;
      requestedModelId: string | null;
      requestedCategoryId: string | null;
    }> = await this.dataSource.query(
      `SELECT v.id,
              v.model_id,
              v.status,
              v.daily_price,
              b.name AS "brandName",
              m.name AS "modelName",
              c.name AS "categoryName",
              img.storage_path AS "imageUrl",
              req.model_id AS "requestedModelId",
              reqm.category_id AS "requestedCategoryId"
       FROM vehicles v
       LEFT JOIN vehicle_models m ON m.id = v.model_id
       LEFT JOIN brands b ON b.id = m.brand_id
       LEFT JOIN categories c ON c.id = m.category_id
       LEFT JOIN LATERAL (
         SELECT storage_path
         FROM vehicle_images i
         WHERE i.vehicle_id = v.id AND i.is_primary
         LIMIT 1
       ) img ON true
       LEFT JOIN LATERAL (
         SELECT model_id FROM vehicles WHERE id = $2::uuid
       ) req ON true
       LEFT JOIN vehicle_models reqm ON reqm.id = req.model_id
       WHERE v.id <> $1::uuid
         AND v.status = 'active'
       ORDER BY (v.model_id = req.model_id) DESC,
                (m.category_id = reqm.category_id) DESC,
                v.daily_price ASC NULLS LAST
       LIMIT 30`,
      [excludeVehicleId, excludeVehicleId],
    );

    const result: AlternativeVehicle[] = [];
    for (const v of vehicles) {
      const chk = await this.check({
        vehicleId: v.id,
        pickupLocationId,
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        dropoffLocationId,
      });
      if (chk.available) {
        result.push({
          vehicleId: v.id,
          modelId: v.modelId,
          brandName: v.brandName ?? undefined,
          modelName: v.modelName ?? undefined,
          imageUrl: v.imageUrl ?? null,
          dailyPrice: v.dailyPrice ?? null,
          available: true,
        });
        if (result.length >= 6) break;
      }
    }
    return result;
  }
}
