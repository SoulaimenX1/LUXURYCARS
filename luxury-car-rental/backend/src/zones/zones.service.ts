import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CheckAddressDto } from './dto/check-address.dto.js';
import type { CreateZoneDto, UpdateZoneDto } from './dto/zone-admin.dto.js';
import type { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule.dto.js';
import {
  findEligibleZone,
  ZONE_COLUMNS,
  type Db,
  type ZoneRow,
} from './zones.queries.js';

// ============================================================
// ZONES DE SERVICE (administration & éligibilité)
// ============================================================
//
// Toute décision « cette adresse est-elle livrable ? » est rendue
// ici, côté serveur, à partir de la configuration admin (zone
// active + service adresse activé + ville couverte).

type PricingRuleRow = {
  id: string;
  zone_id: string;
  service_type: string;
  fee_mode: string;
  fixed_fee: string | null;
  currency: string;
  minimum_fee: string | null;
  modifiers: unknown;
  status: string;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const RULE_COLUMNS = `id, zone_id, service_type, fee_mode, fixed_fee, currency,
  minimum_fee, modifiers, status, effective_from, effective_to, notes,
  created_at, updated_at`;

const toPublicZone = (z: ZoneRow) => ({
  id: z.id,
  code: z.code,
  name: z.name,
  countryCode: z.country_code,
  cities: Array.isArray(z.cities) ? z.cities : [],
  timezone: z.timezone,
  opensAt: z.opens_at,
  closesAt: z.closes_at,
  leadTimeMinutes: Number(z.lead_time_minutes),
  afterHoursAllowed: Boolean(z.after_hours_allowed),
  holidayExceptions: Array.isArray(z.holiday_exceptions) ? z.holiday_exceptions : [],
  fleetRestrictions: z.fleet_restrictions ?? {},
});

const toAdminZone = (z: ZoneRow) => ({
  ...toPublicZone(z),
  active: Boolean(z.active),
  addressServiceEnabled: Boolean(z.address_service_enabled),
  cutoffTime: z.cutoff_time,
  notes: z.notes,
});

const toRule = (r: PricingRuleRow) => ({
  id: r.id,
  zoneId: r.zone_id,
  serviceType: r.service_type,
  feeMode: r.fee_mode,
  fixedFee: r.fixed_fee,
  currency: r.currency,
  minimumFee: r.minimum_fee,
  modifiers: r.modifiers ?? {},
  status: r.status,
  effectiveFrom: r.effective_from,
  effectiveTo: r.effective_to,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

@Injectable()
export class ZonesService {
  constructor(private readonly dataSource: DataSource) {}

  // ----------------------------------------------------------
  // Lecture publique (aucune donnée interne : ni notes admin)
  // ----------------------------------------------------------
  async listPublic(executor: Db = this.dataSource) {
    const rows: ZoneRow[] = await executor.query(
      `SELECT ${ZONE_COLUMNS} FROM service_zones
        WHERE active AND address_service_enabled ORDER BY name`);
    return rows.map(toPublicZone);
  }

  async checkAddress(dto: CheckAddressDto, executor: Db = this.dataSource) {
    const verdict = await findEligibleZone(executor, {
      countryCode: dto.countryCode,
      city: dto.city,
    });
    return {
      eligible: Boolean(verdict.zone),
      reason: verdict.zone ? null : verdict.reason ?? 'address-not-in-zone',
      zone: verdict.zone ? toPublicZone(verdict.zone) : null,
    };
  }

  // ----------------------------------------------------------
  // Administration
  // ----------------------------------------------------------
  async listAdmin(executor: Db = this.dataSource) {
    const rows: ZoneRow[] = await executor.query(
      `SELECT ${ZONE_COLUMNS} FROM service_zones ORDER BY country_code, name`);
    return rows.map(toAdminZone);
  }

  async listRules(zoneId?: string, executor: Db = this.dataSource) {
    const rows: PricingRuleRow[] = zoneId
      ? await executor.query(
          `SELECT ${RULE_COLUMNS} FROM delivery_pricing_rules WHERE zone_id=$1
            ORDER BY service_type, created_at`, [zoneId])
      : await executor.query(
          `SELECT ${RULE_COLUMNS} FROM delivery_pricing_rules
            ORDER BY service_type, created_at`);
    return rows.map(toRule);
  }

  async createZone(dto: CreateZoneDto, executor: Db = this.dataSource) {
    try {
      const rows: ZoneRow[] = await executor.query(
        `INSERT INTO service_zones
           (code, name, country_code, active, address_service_enabled, cities,
            timezone, opens_at, closes_at, lead_time_minutes, cutoff_time,
            after_hours_allowed, holiday_exceptions, fleet_restrictions, notes)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15)
         RETURNING ${ZONE_COLUMNS}`,
        [
          dto.code, dto.name, dto.countryCode,
          dto.active ?? false, dto.addressServiceEnabled ?? false,
          JSON.stringify(dto.cities ?? []),
          dto.timezone ?? 'Europe/Budapest',
          dto.opensAt ?? '09:00', dto.closesAt ?? '18:00',
          dto.leadTimeMinutes ?? 0, dto.cutoffTime ?? null,
          dto.afterHoursAllowed ?? false,
          JSON.stringify(dto.holidayExceptions ?? []),
          JSON.stringify(dto.fleetRestrictions ?? {}),
          dto.notes ?? null,
        ]);
      return toAdminZone(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('A zone with this code already exists');
      }
      throw error;
    }
  }

  // Mise à jour par paires (propriété -> colonne) : aucune clé
  // utilisateur n'est jamais interpolée dans le SQL.
  async updateZone(id: string, dto: UpdateZoneDto, executor: Db = this.dataSource) {
    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column}=$${values.length}`);
    };
    if (dto.name !== undefined) push('name', dto.name);
    if (dto.active !== undefined) push('active', dto.active);
    if (dto.addressServiceEnabled !== undefined) push('address_service_enabled', dto.addressServiceEnabled);
    if (dto.cities !== undefined) push('cities', JSON.stringify(dto.cities));
    if (dto.timezone !== undefined) push('timezone', dto.timezone);
    if (dto.opensAt !== undefined) push('opens_at', dto.opensAt);
    if (dto.closesAt !== undefined) push('closes_at', dto.closesAt);
    if (dto.leadTimeMinutes !== undefined) push('lead_time_minutes', dto.leadTimeMinutes);
    if (dto.cutoffTime !== undefined) push('cutoff_time', dto.cutoffTime);
    if (dto.afterHoursAllowed !== undefined) push('after_hours_allowed', dto.afterHoursAllowed);
    if (dto.holidayExceptions !== undefined) push('holiday_exceptions', JSON.stringify(dto.holidayExceptions));
    if (dto.fleetRestrictions !== undefined) push('fleet_restrictions', JSON.stringify(dto.fleetRestrictions));
    if (dto.notes !== undefined) push('notes', dto.notes);
    if (!sets.length) throw new BadRequestException('No field to update');
    values.push(id);
    const rows: ZoneRow[] = await executor.query(
      `UPDATE service_zones SET ${sets.join(', ')} WHERE id=$${values.length}
        RETURNING ${ZONE_COLUMNS}`, values);
    if (!rows[0]) throw new NotFoundException('Service zone not found');
    return toAdminZone(rows[0]);
  }

  async createRule(zoneId: string, dto: CreatePricingRuleDto, executor: Db = this.dataSource) {
    if (dto.feeMode === 'formula') {
      throw new BadRequestException(
        'Formula-based delivery fees (zone / distance / provider) are not implemented: they require a paid integration that has not been approved',
      );
    }
    const zone: ZoneRow[] = await executor.query(
      `SELECT ${ZONE_COLUMNS} FROM service_zones WHERE id=$1`, [zoneId]);
    if (!zone[0]) throw new NotFoundException('Service zone not found');
    if (dto.status === 'active' && dto.fixedFee === undefined) {
      throw new BadRequestException('An active pricing rule requires an approved fixed fee');
    }
    try {
      const rows: PricingRuleRow[] = await executor.query(
        `INSERT INTO delivery_pricing_rules
           (zone_id, service_type, fee_mode, fixed_fee, currency, minimum_fee,
            modifiers, status, effective_from, effective_to, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)
         RETURNING ${RULE_COLUMNS}`,
        [
          zoneId, dto.serviceType, dto.feeMode ?? 'fixed',
          dto.fixedFee ?? null, dto.currency ?? 'EUR', dto.minimumFee ?? null,
          JSON.stringify(dto.modifiers ?? {}), dto.status ?? 'draft',
          dto.effectiveFrom ?? null, dto.effectiveTo ?? null, dto.notes ?? null,
        ]);
      return toRule(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('An active rule already exists for this service type in this zone');
      }
      throw error;
    }
  }

  async updateRule(ruleId: string, dto: UpdatePricingRuleDto, executor: Db = this.dataSource) {
    if (dto.feeMode === 'formula') {
      throw new BadRequestException(
        'Formula-based delivery fees (zone / distance / provider) are not implemented: they require a paid integration that has not been approved',
      );
    }
    const existing: PricingRuleRow[] = await executor.query(
      `SELECT ${RULE_COLUMNS} FROM delivery_pricing_rules WHERE id=$1`, [ruleId]);
    if (!existing[0]) throw new NotFoundException('Pricing rule not found');
    const nextStatus = dto.status ?? existing[0].status;
    const nextFee = dto.fixedFee !== undefined ? dto.fixedFee : existing[0].fixed_fee;
    if (nextStatus === 'active' && (nextFee === null || nextFee === undefined)) {
      throw new BadRequestException('An active pricing rule requires an approved fixed fee');
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column}=$${values.length}`);
    };
    if (dto.feeMode !== undefined) push('fee_mode', dto.feeMode);
    if (dto.fixedFee !== undefined) push('fixed_fee', dto.fixedFee);
    if (dto.currency !== undefined) push('currency', dto.currency);
    if (dto.minimumFee !== undefined) push('minimum_fee', dto.minimumFee);
    if (dto.modifiers !== undefined) push('modifiers', JSON.stringify(dto.modifiers));
    if (dto.status !== undefined) push('status', dto.status);
    if (dto.effectiveFrom !== undefined) push('effective_from', dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) push('effective_to', dto.effectiveTo);
    if (dto.notes !== undefined) push('notes', dto.notes);
    if (!sets.length) throw new BadRequestException('No field to update');
    values.push(ruleId);
    try {
      const rows: PricingRuleRow[] = await executor.query(
        `UPDATE delivery_pricing_rules SET ${sets.join(', ')} WHERE id=$${values.length}
          RETURNING ${RULE_COLUMNS}`, values);
      return toRule(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('An active rule already exists for this service type in this zone');
      }
      throw error;
    }
  }
}
