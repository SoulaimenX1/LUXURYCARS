import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';

// Migration additive sans suppression des réservations existantes.
export class LocationsAnd3D1790856000005 implements MigrationInterface {
  name='LocationsAnd3D1790856000005';
  async up(runner:QueryRunner) {
    await runner.query(readFileSync(join(process.cwd(),'database','patches','007-locations-and-models.sql'),'utf8'));
  }
  async down() {throw new Error('Review production data before removing rental locations and 3D models.');}
}
