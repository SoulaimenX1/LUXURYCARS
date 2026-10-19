import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';
export class ReturnFeePolicy1790856000004 implements MigrationInterface {
 name='ReturnFeePolicy1790856000004';
 async up(runner:QueryRunner){await runner.query(readFileSync(join(process.cwd(),'database','patches','006-return-policy.sql'),'utf8'));}
 async down(){throw new Error('Fee policies require manual review before removal.');}
}
