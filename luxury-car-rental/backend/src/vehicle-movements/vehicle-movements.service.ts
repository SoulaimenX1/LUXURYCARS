import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Db } from '../zones/zones.queries.js';
import {
  currentVehiclePositions,
  listVehicleMovements,
  recordVehicleLocation,
  requireDestination,
  setVehicleHomeLocation,
} from './vehicle-location.js';
import type { CreateManualEventDto } from './dto/manual-event.dto.js';

// ============================================================
// ADMINISTRATION DU REGISTRE DE LOCALISATION
// ============================================================

@Injectable()
export class VehicleMovementsService {
  constructor(private readonly dataSource: DataSource) {}

  current(vehicleId?: string, executor: Db = this.dataSource) {
    return currentVehiclePositions(executor, { vehicleId });
  }

  list(vehicleId: string | undefined, limit: number | undefined, executor: Db = this.dataSource) {
    return listVehicleMovements(executor, { vehicleId, limit });
  }

  // Événement manuel admin (source de vérité = le journal).
  async createManualEvent(dto: CreateManualEventDto, actorId: string) {
    requireDestination(dto);
    return recordVehicleLocation(this.dataSource, {
      vehicleId: dto.vehicleId,
      eventKind: dto.eventKind,
      fromLocationId: dto.fromLocationId ?? null,
      fromAddress: dto.fromAddress ?? null,
      toLocationId: dto.toLocationId ?? null,
      toAddress: dto.toAddress ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      actorId,
      source: 'admin',
      note: dto.note ?? null,
    });
  }

  // Affectation du domicile : ne change PAS la position physique.
  setHome(vehicleId: string, homeLocationId: string | null) {
    return setVehicleHomeLocation(this.dataSource, vehicleId, homeLocationId);
  }
}
