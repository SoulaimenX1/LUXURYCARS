import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';

// Migration additive : avis client autorisés dès qu'une réservation existe.
export class ReviewsFromReservations1790856000009 implements MigrationInterface {
  name='ReviewsFromReservations1790856000009';
  async up(runner:QueryRunner) {
    await runner.query(readFileSync(join(process.cwd(),'database','patches','015-reviews-from-reservations.sql'),'utf8'));
  }
  async down() {throw new Error('Review production data before relaxing the review rule.');}
}
