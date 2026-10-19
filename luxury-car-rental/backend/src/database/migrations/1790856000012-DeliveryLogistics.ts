import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';

// Migration additive : livraison & collecte (zones, tarifs, points de
// service réservation, missions transport, événements, chauffeurs,
// registre de localisation véhicules, devis de livraison). Aucune
// donnée existante n'est supprimée ni réinitialisée.
export class DeliveryLogistics1790856000012 implements MigrationInterface {
  name='DeliveryLogistics1790856000012';
  async up(runner:QueryRunner) {
    await runner.query(readFileSync(join(process.cwd(),'database','patches','022-vehicle-delivery-logistics.sql'),'utf8'));
  }
  async down() {throw new Error('Delivery logistics data requires manual review before removal.');}
}
