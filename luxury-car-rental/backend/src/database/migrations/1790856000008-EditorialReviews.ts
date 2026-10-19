import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';

// Migration additive : avis éditoriaux « maison » sur les fiches véhicule.
export class EditorialReviews1790856000008 implements MigrationInterface {
  name='EditorialReviews1790856000008';
  async up(runner:QueryRunner) {
    await runner.query(readFileSync(join(process.cwd(),'database','patches','014-editorial-reviews.sql'),'utf8'));
  }
  async down() {throw new Error('Review production data before removing editorial reviews.');}
}
