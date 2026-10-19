import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PremiumService } from '../premium/premium.service.js';
import type { QuoteDto } from '../premium/dto/quote.dto.js';
import { findEligibleZone } from '../zones/zones.queries.js';
import { buildSideFingerprint, persistQuote } from './delivery.queries.js';

// ============================================================
// DEVIS DE LIVRAISON (persistance & expiration)
// ============================================================
//
// Le calcul reste UNIQUEMENT dans premium.quote() (source de vérité
// des prix) : ce service persiste le résultat avec une expiration
// et une empreinte des entrées, pour pouvoir le revalider à la
// réservation. Aucun montant n'est accepté du navigateur.

@Injectable()
export class DeliveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly premium: PremiumService,
  ) {}

  async createQuote(dto: QuoteDto, userId: string | null) {
    // Toute la validation (modes, adresses, zones, tarifs actifs,
    // pays unique) est faite par le devis serveur lui-même.
    const quote = await this.premium.quote(dto);

    // Les dates sont déjà validées par premium.quote.
    const startIso = dto.pickupAt ?? `${dto.pickupDate}T00:00:00.000Z`;
    const endIso = dto.returnAt ?? `${dto.returnDate}T00:00:00.000Z`;

    // Zone du côté porte-à-porte (informatif, nullable).
    let zoneId: string | null = null;
    const doorAddress = [
      dto.pickupServiceMode === 'DOOR_TO_DOOR' ? dto.pickupDoor?.address : null,
      dto.dropoffServiceMode === 'DOOR_TO_DOOR' ? dto.dropoffDoor?.address : null,
    ].find((a) => Boolean(a));
    if (doorAddress) {
      const verdict = await findEligibleZone(this.dataSource, {
        countryCode: doorAddress!.countryCode,
        city: doorAddress!.city,
      });
      zoneId = verdict.zone?.id ?? null;
    }

    const pickupPoint = buildSideFingerprint({
      mode: dto.pickupServiceMode ?? 'APPROVED_POINT',
      locationId: quote.pickupLocationId,
      address: dto.pickupDoor?.address ?? null,
    });
    const dropoffPoint = buildSideFingerprint({
      mode: dto.dropoffServiceMode ?? 'APPROVED_POINT',
      locationId: quote.dropoffLocationId,
      address: dto.dropoffDoor?.address ?? null,
    });

    const saved = await persistQuote(this.dataSource, {
      createdFor: userId,
      vehicleId: quote.vehicleId,
      pickupAt: new Date(startIso),
      returnAt: new Date(endIso),
      zoneId,
      pickupPoint,
      dropoffPoint,
      breakdown: quote,
    });

    return { id: saved.id, expiresAt: saved.expiresAt, ...quote };
  }
}
