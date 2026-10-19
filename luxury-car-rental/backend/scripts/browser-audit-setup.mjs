// Isolated Phase 2 audit harness. Never connects to the application's data database.
import { Client } from 'pg';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, cp, copyFile, symlink, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(backend, '..');
const audit = join(root, 'audit', 'phase2');
const frontend = join(audit, 'runtime', 'frontend');
const database = 'luxuar_browser_audit_20261019';
const env = dotenv.parse(await readFile(join(backend, '.env')));
if (database === env.DB_DATABASE || !/^luxuar_browser_audit_\d{8}$/.test(database)) throw Error('Unsafe database target');
const connection = { host: env.DB_HOST, port: Number(env.DB_PORT ?? 5432), user: env.DB_USERNAME, password: env.DB_PASSWORD };
const admin = new Client({ ...connection, database: 'postgres' });
await admin.connect();
const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount;
if (exists && !process.argv.includes('--resume-seed')) throw Error('Audit database exists; refusing to overwrite');
if (!exists) await admin.query(`CREATE DATABASE ${database}`);
await admin.end();
const db = new Client({ ...connection, database });
await db.connect();
if (!exists) {
await db.query(await readFile(join(backend, 'database/schema.sql'), 'utf8'));
for (const name of (await readdir(join(backend, 'database/patches'))).filter(n => n.endsWith('.sql')).sort()) {
  await db.query(await readFile(join(backend, 'database/patches', name), 'utf8'));
}
}
const password = 'AuditOnly!2026Car';
const hash = await argon2.hash(password);
for (const role of ['admin', 'staff']) {
  await db.query(`INSERT INTO users(email,password_hash,role,first_name,last_name) VALUES($1,$2,$3,'Audit',$4)`, [`audit.${role}@example.test`,hash,role,role]);
}
const brand = (await db.query(`INSERT INTO brands(name) VALUES ('Audit Bentley') RETURNING id`)).rows[0].id;
const category = (await db.query(`INSERT INTO categories(name) VALUES ('Audit Grand Touring') RETURNING id`)).rows[0].id;
const model = (await db.query(`INSERT INTO vehicle_models(brand_id,category_id,name) VALUES($1,$2,'Continental Audit') RETURNING id`,[brand,category])).rows[0].id;
const vehicles = [];
for (let i=1;i<=3;i++) {
  const row=(await db.query(`INSERT INTO vehicles(model_id,manufacture_year,license_plate,vin,transmission,fuel_type,seats,power_hp,daily_price,security_deposit,vehicle_value,mileage_km,description)
    VALUES($1,2025,$2,$3,'automatic','petrol',4,550,300,2000,200000,1000,'Disposable browser audit fixture; not a real rental vehicle.') RETURNING id`,[model,`AUDIT-00${i}`,`AUDITVIN00000000${i}`])).rows[0];
  vehicles.push(row.id);
  for(let j=1;j<=3;j++) await db.query(`INSERT INTO vehicle_images(vehicle_id,storage_path,is_primary,sort_order,alt_text) VALUES($1,$2,$3,$4,'Audit gallery copy')`,[row.id,`/vehicles/audit-${j}.png`,j===1,j]);
}
const location=(await db.query(`INSERT INTO rental_locations(code,name,category,city,country,address,timezone,opens_at,closes_at,pickup_fee,dropoff_fee) VALUES('AUDIT-HUB','Audit Budapest Hub','showroom','Budapest','Hongrie','Test address 1','Europe/Budapest','00:00','23:59',0,0) RETURNING id`)).rows[0].id;
await db.end();
await mkdir(frontend,{recursive:true});
await mkdir(join(audit,'evidence'),{recursive:true});
await cp(join(root,'frontend/src'),join(frontend,'src'),{recursive:true});
for (const name of ['package.json','tsconfig.json','next.config.ts','postcss.config.mjs','next-env.d.ts']) {
  try { await copyFile(join(root,'frontend',name),join(frontend,name)); } catch(e) { if(e.code!=='ENOENT')throw e; }
}
await symlink(join(root,'frontend/node_modules'),join(frontend,'node_modules'),'junction');
await mkdir(join(frontend,'public/vehicles'),{recursive:true});
await cp(join(root,'frontend/public/media'),join(frontend,'public/media'),{recursive:true});
for(const entry of await readdir(join(root,'frontend/public'),{withFileTypes:true})) if(entry.isFile()) await copyFile(join(root,'frontend/public',entry.name),join(frontend,'public',entry.name));
const images=(await readdir(join(root,'frontend/public/vehicles'))).filter(n=>n.endsWith('.png')).slice(0,3);
for(let i=0;i<images.length;i++) await copyFile(join(root,'frontend/public/vehicles',images[i]),join(frontend,`public/vehicles/audit-${i+1}.png`));
await writeFile(join(frontend,'.env.local'),'NEXT_PUBLIC_API_URL=http://127.0.0.1:3201\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:3200\n');
await writeFile(join(audit,'fixture.json'),JSON.stringify({database,frontendPort:3200,backendPort:3201,vehicles,location,admin:'audit.admin@example.test',staff:'audit.staff@example.test',password,originalRecordsCopied:false},null,2));
await writeFile(join(audit,'runtime','backend-env.json'),JSON.stringify({...env,DB_DATABASE:database,PORT:'3201',NODE_ENV:'development',JWT_SECRET:randomBytes(48).toString('hex'),VEHICLE_IMAGES_DIR:join(frontend,'public/vehicles'),INSPECTION_IMAGES_DIR:join(audit,'runtime/private-inspection-media')}));
await writeFile(join(audit,'runtime','start-backend.mjs'),`import {readFile} from 'node:fs/promises';\nObject.assign(process.env,JSON.parse(await readFile(new URL('./backend-env.json',import.meta.url),'utf8')));\nawait import(${JSON.stringify(new URL('../dist/main.js',import.meta.url).href)});\n`);
console.log(JSON.stringify({database,vehicles,location,frontend,ready:true}));
