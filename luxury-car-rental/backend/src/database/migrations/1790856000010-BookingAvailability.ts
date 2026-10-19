import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';

// Migration additive : horaires d'ouverture, fuseau horaire et
// affectation véhicule <-> lieu de prise en charge. Aucune donnée
// existante n'est supprimée ni réinitialisée.
export class BookingAvailability1790856000010 implements MigrationInterface {
  name='BookingAvailability1790856000010';
  async up(runner:QueryRunner) {
    await runner.query(readFileSync(join(process.cwd(),'database','patches','016-booking-availability.sql'),'utf8'));
  }
  async down() {throw new Error('Review production data before removing booking availability columns.');}
}
