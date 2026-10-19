import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';

// Migration additive : ajoute le volet « service » à l'avis client
// (note + commentaire facultatifs, réservés aux réservations ayant
// inclus des options). Aucune donnée existante n'est supprimée.
export class ReviewServiceSection1790856000011 implements MigrationInterface {
  name='ReviewServiceSection1790856000011';
  async up(runner:QueryRunner) {
    await runner.query(readFileSync(join(process.cwd(),'database','patches','019-review-service-section.sql'),'utf8'));
  }
  async down() {throw new Error('Review service data requires manual review before removal.');}
}
