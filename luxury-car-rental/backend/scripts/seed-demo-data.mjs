// ============================================================
// seed-demo-data.mjs
// ============================================================
// Remplit la base de DONNÉES DE DÉMONSTRATION pour compléter les
// tables vides, SANS JAMAIS RIEN SUPPRIMER.
//
// Garanties :
//   * aucune opération destructrice (pas de TRUNCATE / DELETE / DROP) ;
//   * idempotent : chaque ligne est insérée seulement si absente
//     (clés explicites + ON CONFLICT DO NOTHING / vérifications) ;
//   * transactionnel : en cas d'erreur, tout est annulé.
//
// Utilisation (depuis le dossier backend/) :
//   node scripts/seed-demo-data.mjs
// ============================================================

import 'dotenv/config';

import pg from 'pg';

const { Client } = pg;

if (!process.env.DB_HOST || !process.env.DB_USERNAME || !process.env.DB_PASSWORD || !process.env.DB_DATABASE) {
  console.error('✗ Variables DB_* manquantes. Lancez la commande depuis le dossier backend/.');
  process.exit(1);
}

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

const q = (text, params = []) => client.query(text, params);

const DAY = 86_400_000;

/** Date ISO à J+offset (UTC), heure fixée par défaut à 09:00. */
function at(offsetDays, hour = 9) {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

/** Chaîne hexadécimale de 64 caractères (sha256 factice mais valide). */
function fakeSha(seed) {
  return seed.toString(16).padStart(64, '0').slice(-64);
}

const n2 = (v) => Number(v).toFixed(2);

const stats = {};
function bump(name, n = 1) {
  stats[name] = (stats[name] ?? 0) + n;
}

await client.connect();
console.log(`→ Connecté à ${process.env.DB_DATABASE} sur ${process.env.DB_HOST}`);

try {
  await q('BEGIN');

  // ==========================================================
  // 0. RÉFÉRENCES (admin + clients)
  // ==========================================================

  const adminRow = (await q(`SELECT id FROM users WHERE email = 'admin@luxury.test' LIMIT 1`)).rows[0]
    ?? (await q(`SELECT id FROM users WHERE role = 'admin' ORDER BY email LIMIT 1`)).rows[0];
  if (!adminRow) throw new Error('Aucun administrateur trouvé dans users.');
  const admin = adminRow.id;

  const custByEmail = async (email) =>
    (await q('SELECT id FROM users WHERE email = $1 LIMIT 1', [email])).rows[0]?.id ?? null;

  const C1 = await custByEmail('client.thesis.test@example.com');
  const C2 = await custByEmail('soulaimenbensalah5@gmail.com');
  const C3 = await custByEmail('postman7060@luxury.test');
  if (!C1 || !C2 || !C3) throw new Error('Les clients de démonstration attendus sont introuvables.');

  // Profils clients supplémentaires (facultatif, non destructif).
  const extraProfiles = [
    { email: 'customer.test1@example.com', dob: '1995-03-12', lic: 'DEMO-HU-30001', cc: 'HU' },
    { email: 'demo.customer.2025@example.com', dob: '1992-11-30', lic: 'DEMO-HU-30002', cc: 'HU' },
    { email: 'soulaimenbensalah@gmail.com', dob: '1988-07-21', lic: 'DEMO-TN-30003', cc: 'TN' },
  ];
  for (const p of extraProfiles) {
    const uid = await custByEmail(p.email);
    if (!uid) continue;
    const r = await q(
      `INSERT INTO customer_profiles
         (user_id, date_of_birth, address_line, city, postal_code, country,
          license_number, license_country, license_issued_on, license_expires_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING user_id`,
      [uid, p.dob, `${10 + Math.floor(Math.random() * 80)} Demo Avenue`, 'Budapest', '1051', p.cc, p.lic, p.cc, '2018-01-15', '2033-01-15'],
    );
    bump('customer_profiles', r.rowCount ?? r.rows.length);
  }

  // ==========================================================
  // 0bis. TÉLÉPHONE DES CLIENTS (désormais obligatoire)
  // ----------------------------------------------------------
  // Le numéro de téléphone est obligatoire dans l'espace client.
  // On renseigne les clients de démonstration qui n'en ont pas,
  // sans jamais écraser un numéro déjà présent (idempotent et
  // non destructif).
  // ==========================================================

  const DEMO_PHONES = [
    ['client.thesis.test@example.com', '+216 99 000 111'],
    ['soulaimenbensalah5@gmail.com', '+216 50 446 271'],
    ['postman7060@luxury.test', '+216 20 555 101'],
    ['customer.test1@example.com', '+216 20 555 202'],
    ['demo.customer.1005@example.com', '+36 50 446 271'],
    ['demo.customer.2025@example.com', '+36 11 222 333'],
    ['soulaimenbensalah@gmail.com', '+216 20 123 456'],
  ];
  for (const [email, phone] of DEMO_PHONES) {
    const r = await q(
      `UPDATE users
          SET phone = $2
        WHERE email = $1
          AND role = 'customer'
          AND (phone IS NULL OR btrim(phone) = '')`,
      [email, phone],
    );
    bump('users.phone', r.rowCount);
  }

  // ==========================================================
  // 1. POINTS DE LIVRAISON (rental_locations)
  // ==========================================================

  const LOCATIONS = [
    ['LUX-SHOWROOM', 'LuxuryCars Showroom Paris', 'showroom', 'Paris', 'France', '12 Avenue Montaigne, 75008 Paris', 0, 0, 0],
    ['CDG-T2', 'Aéroport Paris-Charles de Gaulle (T2)', 'airport', 'Roissy', 'France', 'Terminal 2E, 95700 Roissy-en-France', 90, 90, 120],
    ['NCE-APT', 'Aéroport Nice Côte d’Azur', 'airport', 'Nice', 'France', 'Aéroport Nice Côte d’Azur, 06200 Nice', 110, 110, 150],
    ['GVA-HOTEL', 'Hôtel Beau-Rivage Genève', 'hotel', 'Genève', 'Suisse', 'Quai du Mont-Blanc 13, 1201 Genève', 140, 140, 180],
    ['LYS-CTR', 'Centre-ville de Lyon', 'city_center', 'Lyon', 'France', 'Place Bellecour, 69002 Lyon', 70, 70, 90],
  ];
  for (const l of LOCATIONS) {
    const r = await q(
      `INSERT INTO rental_locations
         (code, name, category, city, country, address, pickup_fee, dropoff_fee, one_way_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (code) DO NOTHING`,
      l,
    );
    bump('rental_locations', r.rowCount);
  }
  const loc = {};
  for (const row of (await q('SELECT id, code FROM rental_locations')).rows) loc[row.code] = row.id;

  // ==========================================================
  // 2. PROMOTIONS PREMIUM
  // ==========================================================

  const PROMOS = [
    ['WELCOME10', 10, at(-30), at(90), 100, 4, true],
    ['SUMMER15', 15, at(-10), at(60), 50, 12, true],
  ];
  for (const p of PROMOS) {
    const r = await q(
      `INSERT INTO premium_promotions (code, percentage, starts_at, expires_at, max_uses, uses, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (code) DO NOTHING`,
      p,
    );
    bump('premium_promotions', r.rowCount);
  }

  // ==========================================================
  // 3. VÉHICULES + OPTIONS
  // ==========================================================

  const vehicles = {};
  for (const v of (await q('SELECT id, license_plate, daily_price, security_deposit, mileage_km FROM vehicles')).rows) {
    vehicles[v.license_plate] = {
      id: v.id,
      daily: Number(v.daily_price),
      deposit: Number(v.security_deposit),
      mileage: Number(v.mileage_km),
    };
  }
  const need = ['LC-0001', 'LC-0007', 'LC-0011', 'LC-0012', 'LC-0014', 'LC-0017', 'LC-0022', 'LC-0034', 'LC-0042', 'LC-0044', 'LC-0048', 'LC-0050', 'LC-0056'];
  for (const p of need) if (!vehicles[p]) throw new Error(`Véhicule ${p} introuvable.`);

  const extras = {};
  for (const e of (await q('SELECT id, code, amount, pricing FROM premium_extras')).rows) {
    extras[e.code] = { id: e.id, amount: Number(e.amount), pricing: e.pricing };
  }

  // ==========================================================
  // 4. RÉSERVATIONS DE DÉMONSTRATION
  // ==========================================================
  // Chaque véhicule est utilisé une seule fois -> aucun conflit
  // avec la contrainte d'exclusion (double réservation).

  const RESERVATIONS = [
    { num: 'RES-2026-900001', cust: C1, plate: 'LC-0001', from: -60, to: -57, status: 'converted', extras: ['GPS', 'CHILD_SEAT'], pref: { method: 'branch' } },
    { num: 'RES-2026-900002', cust: C2, plate: 'LC-0017', from: -45, to: -38, status: 'converted', extras: ['EXTRA_DRIVER'], pref: { method: 'airport', loc: 'CDG-T2' } },
    { num: 'RES-2026-900003', cust: C3, plate: 'LC-0034', from: -30, to: -27, status: 'converted', extras: ['PROTECTION_PLUS', 'CHILD_SEAT'], pref: { method: 'hotel', address: 'Hôtel Beau-Rivage, Genève', loc: 'GVA-HOTEL' } },
    { num: 'RES-2026-900004', cust: C1, plate: 'LC-0011', from: -2, to: 3, status: 'converted', extras: ['PROTECTION_PLUS'], pref: { method: 'showroom', loc: 'LUX-SHOWROOM' } },
    { num: 'RES-2026-900005', cust: C1, plate: 'LC-0007', from: 10, to: 13, status: 'confirmed', extras: ['GPS'], pref: { method: 'airport', loc: 'NCE-APT' } },
    { num: 'RES-2026-900006', cust: C2, plate: 'LC-0022', from: 12, to: 16, status: 'confirmed', extras: ['CHILD_SEAT'], pref: { method: 'branch' } },
    { num: 'RES-2026-900007', cust: C3, plate: 'LC-0044', from: 15, to: 18, status: 'confirmed', extras: [], pref: { method: 'city_center', loc: 'LYS-CTR' } },
    { num: 'RES-2026-900008', cust: C2, plate: 'LC-0014', from: 20, to: 22, status: 'pending', extras: ['EXTRA_DRIVER'], pref: { method: 'branch' } },
    { num: 'RES-2026-900009', cust: C1, plate: 'LC-0048', from: 25, to: 27, status: 'pending', extras: [], pref: { method: 'branch' } },
    { num: 'RES-2026-900010', cust: C3, plate: 'LC-0056', from: 30, to: 33, status: 'pending', extras: ['GPS'], pref: { method: 'hotel', address: 'InterContinental Lyon, 20 Quai Jules Courmont', loc: 'LYS-CTR' } },
    { num: 'RES-2026-900011', cust: C1, plate: 'LC-0012', from: 40, to: 42, status: 'rejected', extras: [], pref: { method: 'branch' }, reason: 'Véhicule non disponible pour ces dates.' },
    { num: 'RES-2026-900012', cust: C2, plate: 'LC-0050', from: -20, to: -18, status: 'expired', extras: [], pref: { method: 'branch' } },
    { num: 'RES-2026-900013', cust: C3, plate: 'LC-0042', from: 45, to: 48, status: 'cancelled', extras: [], pref: { method: 'branch' } },
  ];

  const reservations = {}; // num -> { id, ... }

  for (const r of RESERVATIONS) {
    const v = vehicles[r.plate];
    let pickupPlan = r.pickup; // reserved for extension override
    const days = Math.round((new Date(at(r.to)).getTime() - new Date(at(r.from)).getTime()) / DAY);
    void pickupPlan;

    // Options : montant figé pour l'historique.
    let extrasAmount = 0;
    const extraRows = [];
    for (const code of r.extras) {
      const ex = extras[code];
      const total = ex.pricing === 'daily' ? ex.amount * days : ex.amount;
      extrasAmount += total;
      extraRows.push({ code, ex, total });
    }
    const total = days * v.daily + extrasAmount;

    // Livraison : frais fixes si un point a un tarif.
    let deliveryAmount = 0;
    if (r.pref.loc && loc[r.pref.loc]) {
      const fee = r.pref.method === 'showroom' ? 0 : (r.status === 'converted' || r.status === 'confirmed' || r.status === 'pending' ? 90 : 0);
      deliveryAmount = fee;
    }
    const grandTotal = total + deliveryAmount;

    const decided = r.status === 'pending' ? null : r.status === 'expired' ? null : admin;
    const decidedAt = decided ? at(r.from + Math.min(days, 1), 8) : null;

    const ins = await q(
      `INSERT INTO reservations
         (reservation_number, customer_id, vehicle_id, pickup_at, return_at, rental_days, daily_price,
          deposit_amount, total_amount, extras_amount, discount_amount, delivery_amount,
          status, customer_notes, decided_by, decided_at, decision_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (reservation_number) DO NOTHING
       RETURNING id`,
      [
        r.num, r.cust, v.id, at(r.from), at(r.to), days, v.daily,
        v.deposit, grandTotal, extrasAmount, deliveryAmount,
        r.status, 'Réservation de démonstration.', decided, decidedAt, r.reason ?? null,
      ],
    );
    let id = ins.rows[0]?.id;
    const created = Boolean(id);
    if (!id) id = (await q('SELECT id FROM reservations WHERE reservation_number = $1', [r.num])).rows[0].id;
    bump('reservations', created ? 1 : 0);
    reservations[r.num] = { id, ...r, days, v, extrasAmount, deliveryAmount, grandTotal, created };

    if (!created) continue;

    // Options détaillées
    for (const er of extraRows) {
      await q(
        `INSERT INTO reservation_extras
           (reservation_id, extra_id, name_snapshot, amount_snapshot, pricing_snapshot, unit_price_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (reservation_id, extra_id) DO NOTHING`,
        [id, er.ex.id, er.code, n2(er.total), er.ex.pricing, n2(er.ex.amount)],
      );
      bump('reservation_extras');
    }

    // Préférences de prise en charge
    const pm = r.pref.method === 'city_center' || r.pref.method === 'showroom' ? 'branch' : r.pref.method;
    const locId = r.pref.loc ? loc[r.pref.loc] : null;
    const snap = locId ? (await q('SELECT name FROM rental_locations WHERE id = $1', [locId])).rows[0].name : null;
    await q(
      `INSERT INTO reservation_preferences
         (reservation_id, pickup_method, delivery_address, delivery_status,
          pickup_location_id, dropoff_location_id, pickup_location_snapshot, dropoff_location_snapshot,
          pickup_address, dropoff_address, checkin_at)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$6,$7,$7,$8)
       ON CONFLICT (reservation_id) DO NOTHING`,
      [
        id, pm, r.pref.address ?? null, r.status === 'converted' ? 'accepted' : 'requested',
        locId, snap, r.pref.address ?? null,
        r.status === 'converted' ? at(r.from, 8) : null,
      ],
    );
    bump('reservation_preferences');
  }

  // ==========================================================
  // 5. LOCATIONS (rentals) + inspections + finances + avis
  // ==========================================================

  const docPath = (name) => `/var/luxury/documents/demo/${name}`;

  async function ensureDocument(rentalId, type, fileName, shaSeed, invoiceId = null) {
    const r = await q(
      `INSERT INTO documents (rental_id, invoice_id, type, file_name, storage_path, size_bytes, sha256, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (storage_path) DO NOTHING`,
      [rentalId, invoiceId, type, fileName, docPath(fileName), 18_432 + shaSeed, fakeSha(shaSeed), admin],
    );
    bump('documents', r.rowCount);
  }

  // --- Rental A : Ferrrari SF90 (réservation 1), CLÔTURÉE -----
  {
    const res = reservations['RES-2026-900001'];
    const ins = await q(
      `INSERT INTO rentals (contract_number, reservation_id, status, started_at, expected_return_at, returned_at, closed_at, opened_by, closed_by, notes)
       VALUES ('DEMO-CTR-0001',$1,'closed',$2,$3,$3,$3,$4,$4,'Location clôturée sans incident.')
       ON CONFLICT (contract_number) DO NOTHING RETURNING id`,
      [res.id, at(-60), at(-57), admin],
    );
    const rentalId = ins.rows[0]?.id ?? (await q(`SELECT id FROM rentals WHERE contract_number='DEMO-CTR-0001'`)).rows[0].id;
    bump('rentals', ins.rowCount);

    // Inspections
    const h = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'handover',$2,$3,$4,100,'excellent','Véhicule impeccable au départ.')
       ON CONFLICT (rental_id,type) DO NOTHING RETURNING id`,
      [rentalId, at(-60, 9), admin, res.v.mileage],
    );
    bump('inspections', h.rowCount);
    const ret = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'return',$2,$3,$4,70,'good','Retour conforme, léger nettoyage nécessaire.')
       ON CONFLICT (rental_id,type) DO NOTHING RETURNING id`,
      [rentalId, at(-57, 18), admin, res.v.mileage + 180],
    );
    bump('inspections', ret.rowCount);

    // Caution
    const dep = await q(
      `INSERT INTO security_deposits (rental_id,amount,status,held_at,released_at,retained_amount)
       VALUES ($1,$2,'released',$3,$4,0) ON CONFLICT (rental_id) DO NOTHING`,
      [rentalId, res.v.deposit, at(-60, 9), at(-57, 18)],
    );
    bump('security_deposits', dep.rowCount);

    // Frais supplémentaires : carburant
    const chg = res.created || (await q('SELECT 1 FROM additional_charges WHERE rental_id=$1', [rentalId])).rowCount === 0
      ? await q(
          `INSERT INTO additional_charges (rental_id,type,description,amount,created_by)
           VALUES ($1,'fuel','Complément carburant (plein partiel au retour)',120.00,$2)`,
          [rentalId, admin],
        )
      : { rowCount: 0 };
    bump('additional_charges', chg.rowCount);
    const chgId = (await q(`SELECT id FROM additional_charges WHERE rental_id=$1 AND type='fuel' LIMIT 1`, [rentalId])).rows[0]?.id ?? null;

    // Facture
    const subtotal = res.grandTotal + 120;
    const inv = await q(
      `INSERT INTO invoices (invoice_number,rental_id,status,subtotal,tax_rate,tax_amount,total_amount,issued_at,issued_by)
       VALUES ('DEMO-INV-0001',$1,'issued',$2,0,0,$2,$3,$4) ON CONFLICT (invoice_number) DO NOTHING RETURNING id`,
      [rentalId, n2(subtotal), at(-56, 10), admin],
    );
    const invoiceId = inv.rows[0]?.id ?? (await q(`SELECT id FROM invoices WHERE invoice_number='DEMO-INV-0001'`)).rows[0].id;
    bump('invoices', inv.rowCount);
    if (inv.rows[0]) {
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,$2,3,$3)`, [invoiceId, `${res.plate} — location 3 jours`, n2(res.v.daily)]);
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,'GPS navigation',1,15.00)`, [invoiceId]);
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,'Siège enfant',1,25.00)`, [invoiceId]);
      if (chgId) await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price,additional_charge_id) VALUES ($1,'Complément carburant',1,120.00,$2)`, [invoiceId, chgId]);
      bump('invoice_items', 4);
    }

    // Paiements
    const pays = [
      ['rental_payment', 'card', res.grandTotal, 'PAY-DEMO-0001-R'],
      ['charge_payment', 'card', 120, 'PAY-DEMO-0001-C'],
      ['deposit_payment', 'card', res.v.deposit, 'PAY-DEMO-0001-D'],
      ['deposit_refund', 'bank_transfer', res.v.deposit, 'REF-DEMO-0001-D'],
    ];
    for (const p of pays) {
      const r = await q(
        `INSERT INTO payments (rental_id,type,method,amount,reference,recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (rental_id, type, reference) WHERE reference IS NOT NULL DO NOTHING`,
        [rentalId, p[0], p[1], n2(p[2]), p[3], admin],
      );
      bump('payments', r.rowCount);
    }

    // Documents
    await ensureDocument(rentalId, 'contract', 'DEMO-CTR-0001.pdf', 1001);
    await ensureDocument(rentalId, 'invoice', 'DEMO-INV-0001.pdf', 1002, invoiceId);
    await ensureDocument(rentalId, 'inspection_report', 'DEMO-CTR-0001-inspections.pdf', 1003);

    // Avis
    const rev = await q(
      `INSERT INTO vehicle_reviews (customer_id,rental_id,vehicle_id,rating,title,comment)
       VALUES ($1,$2,$3,5,'Une expérience inoubliable','Service impeccable et voiture en parfait état. La SF90 est spectaculaire.')
       ON CONFLICT (rental_id) DO NOTHING`,
      [res.cust, rentalId, res.v.id],
    );
    bump('vehicle_reviews', rev.rowCount);
  }

  // --- Rental B : Porsche 911 Turbo S (réservation 2), CLÔTURÉE avec prolongation ---
  {
    const res = reservations['RES-2026-900002'];
    const ins = await q(
      `INSERT INTO rentals (contract_number, reservation_id, status, started_at, expected_return_at, returned_at, closed_at, opened_by, closed_by, notes)
       VALUES ('DEMO-CTR-0002',$1,'closed',$2,$3,$3,$3,$4,$4,'Prolongation de 2 jours accordée au client.')
       ON CONFLICT (contract_number) DO NOTHING RETURNING id`,
      [res.id, at(-45), at(-38), admin],
    );
    const rentalId = ins.rows[0]?.id ?? (await q(`SELECT id FROM rentals WHERE contract_number='DEMO-CTR-0002'`)).rows[0].id;
    bump('rentals', ins.rowCount);

    const h = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'handover',$2,$3,$4,100,'good','Départ à l''aéroport CDG.')
       ON CONFLICT (rental_id,type) DO NOTHING RETURNING id`,
      [rentalId, at(-45, 8), admin, res.v.mileage],
    );
    bump('inspections', h.rowCount);
    const ret = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'return',$2,$3,$4,55,'good','Retour après prolongation.')
       ON CONFLICT (rental_id,type) DO NOTHING RETURNING id`,
      [rentalId, at(-38, 19), admin, res.v.mileage + 310],
    );
    bump('inspections', ret.rowCount);

    const dep = await q(
      `INSERT INTO security_deposits (rental_id,amount,status,held_at,released_at)
       VALUES ($1,$2,'released',$3,$4) ON CONFLICT (rental_id) DO NOTHING`,
      [rentalId, res.v.deposit, at(-45, 8), at(-38, 19)],
    );
    bump('security_deposits', dep.rowCount);

    // Prolongation : 5j (9575) -> 7j (13405) — insérée une seule fois.
    const hasExt = (await q('SELECT 1 FROM rental_extensions WHERE rental_id=$1', [rentalId])).rowCount;
    if (!hasExt) {
      const oldTotal = 5 * res.v.daily + 15 * 5;
      const ext = await q(
        `INSERT INTO rental_extensions (rental_id,old_return_at,new_return_at,old_total_amount,new_total_amount,additional_amount,extended_by,reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Demande client acceptée par l''agence.')`,
        [rentalId, at(-40), at(-38), n2(oldTotal), n2(res.grandTotal), n2(res.grandTotal - oldTotal), admin],
      );
      bump('rental_extensions', ext.rowCount);
    }

    const inv = await q(
      `INSERT INTO invoices (invoice_number,rental_id,status,subtotal,tax_rate,tax_amount,total_amount,issued_at,issued_by)
       VALUES ('DEMO-INV-0002',$1,'issued',$2,0,0,$2,$3,$4) ON CONFLICT (invoice_number) DO NOTHING RETURNING id`,
      [rentalId, n2(res.grandTotal), at(-37, 10), admin],
    );
    const invoiceId = inv.rows[0]?.id ?? (await q(`SELECT id FROM invoices WHERE invoice_number='DEMO-INV-0002'`)).rows[0].id;
    bump('invoices', inv.rowCount);
    if (inv.rows[0]) {
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,$2,7,$3)`, [invoiceId, `${res.plate} — location 7 jours`, n2(res.v.daily)]);
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,'Conducteur additionnel',7,15.00)`, [invoiceId]);
      bump('invoice_items', 2);
    }

    for (const p of [
      ['rental_payment', 'card', res.grandTotal, 'PAY-DEMO-0002-R'],
      ['deposit_payment', 'card', res.v.deposit, 'PAY-DEMO-0002-D'],
      ['deposit_refund', 'bank_transfer', res.v.deposit, 'REF-DEMO-0002-D'],
    ]) {
      const r = await q(
        `INSERT INTO payments (rental_id,type,method,amount,reference,recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (rental_id, type, reference) WHERE reference IS NOT NULL DO NOTHING`,
        [rentalId, p[0], p[1], n2(p[2]), p[3], admin],
      );
      bump('payments', r.rowCount);
    }

    await ensureDocument(rentalId, 'contract', 'DEMO-CTR-0002.pdf', 2001);
    await ensureDocument(rentalId, 'invoice', 'DEMO-INV-0002.pdf', 2002, invoiceId);
    await ensureDocument(rentalId, 'inspection_report', 'DEMO-CTR-0002-inspections.pdf', 2003);

    const rev = await q(
      `INSERT INTO vehicle_reviews (customer_id,rental_id,vehicle_id,rating,title,comment)
       VALUES ($1,$2,$3,4,'Très bonne voiture','Confortable et performante. Prise en charge à l''aéroport très pratique.')
       ON CONFLICT (rental_id) DO NOTHING`,
      [res.cust, rentalId, res.v.id],
    );
    bump('vehicle_reviews', rev.rowCount);
  }

  // --- Rental C : Rolls-Royce Phantom (réservation 3), CLÔTURÉE avec dommage ---
  {
    const res = reservations['RES-2026-900003'];
    const ins = await q(
      `INSERT INTO rentals (contract_number, reservation_id, status, started_at, expected_return_at, returned_at, closed_at, opened_by, closed_by, notes)
       VALUES ('DEMO-CTR-0003',$1,'closed',$2,$3,$3,$3,$4,$4,'Dommage mineur constaté au retour.')
       ON CONFLICT (contract_number) DO NOTHING RETURNING id`,
      [res.id, at(-30), at(-27), admin],
    );
    const rentalId = ins.rows[0]?.id ?? (await q(`SELECT id FROM rentals WHERE contract_number='DEMO-CTR-0003'`)).rows[0].id;
    bump('rentals', ins.rowCount);

    const h = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'handover',$2,$3,$4,100,'excellent','Livraison à l''hôtel.')
       ON CONFLICT (rental_id,type) DO NOTHING RETURNING id`,
      [rentalId, at(-30, 11), admin, res.v.mileage],
    );
    bump('inspections', h.rowCount);
    const ret = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'return',$2,$3,$4,40,'fair','Rayure sur le pare-chocs arrière.')
       ON CONFLICT (rental_id,type) DO NOTHING RETURNING id`,
      [rentalId, at(-27, 17), admin, res.v.mileage + 180],
    );
    bump('inspections', ret.rowCount);

    let dmgId = null;
    if (ret.rows[0]) {
      const dmg = await q(
        `INSERT INTO inspection_damages (inspection_id,vehicle_zone,description,severity,estimated_repair_cost)
         VALUES ($1,'rear bumper','Rayure et léger enfoncement sur le pare-chocs arrière droit.','minor',450.00) RETURNING id`,
        [ret.rows[0].id],
      );
      dmgId = dmg.rows[0].id;
      bump('inspection_damages', 1);
    }

    const dep = await q(
      `INSERT INTO security_deposits (rental_id,amount,status,retained_amount,retention_reason,held_at,released_at)
       VALUES ($1,$2,'partially_retained',450.00,'Réparation du pare-chocs arrière',$3,$4)
       ON CONFLICT (rental_id) DO NOTHING`,
      [rentalId, res.v.deposit, at(-30, 11), at(-27, 17)],
    );
    bump('security_deposits', dep.rowCount);

    const existingCharge = (await q(`SELECT id FROM additional_charges WHERE rental_id=$1 AND type='damage' LIMIT 1`, [rentalId])).rows[0]?.id;
    let chgId;
    if (existingCharge) {
      chgId = existingCharge;
    } else {
      const chg = await q(
        `INSERT INTO additional_charges (rental_id,type,description,amount,inspection_damage_id,created_by)
         VALUES ($1,'damage','Réparation pare-chocs arrière droit',450.00,$2,$3) RETURNING id`,
        [rentalId, dmgId, admin],
      );
      chgId = chg.rows[0].id;
      bump('additional_charges', 1);
    }

    const subtotal = res.grandTotal + 450;
    const inv = await q(
      `INSERT INTO invoices (invoice_number,rental_id,status,subtotal,tax_rate,tax_amount,total_amount,issued_at,issued_by)
       VALUES ('DEMO-INV-0003',$1,'issued',$2,0,0,$2,$3,$4) ON CONFLICT (invoice_number) DO NOTHING RETURNING id`,
      [rentalId, n2(subtotal), at(-26, 10), admin],
    );
    const invoiceId = inv.rows[0]?.id ?? (await q(`SELECT id FROM invoices WHERE invoice_number='DEMO-INV-0003'`)).rows[0].id;
    bump('invoices', inv.rowCount);
    if (inv.rows[0]) {
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,$2,3,$3)`, [invoiceId, `${res.plate} — location 3 jours`, n2(res.v.daily)]);
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,'Protection additionnelle',3,30.00)`, [invoiceId]);
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price) VALUES ($1,'Siège enfant',1,25.00)`, [invoiceId]);
      await q(`INSERT INTO invoice_items (invoice_id,description,quantity,unit_price,additional_charge_id) VALUES ($1,'Réparation pare-chocs arrière droit',1,450.00,$2)`, [invoiceId, chgId]);
      bump('invoice_items', 4);
    }

    for (const p of [
      ['rental_payment', 'card', res.grandTotal, 'PAY-DEMO-0003-R'],
      ['charge_payment', 'card', 450, 'PAY-DEMO-0003-C'],
      ['deposit_payment', 'card', res.v.deposit, 'PAY-DEMO-0003-D'],
      ['deposit_refund', 'bank_transfer', res.v.deposit - 450, 'REF-DEMO-0003-D'],
    ]) {
      const r = await q(
        `INSERT INTO payments (rental_id,type,method,amount,reference,recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (rental_id, type, reference) WHERE reference IS NOT NULL DO NOTHING`,
        [rentalId, p[0], p[1], n2(p[2]), p[3], admin],
      );
      bump('payments', r.rowCount);
    }

    await ensureDocument(rentalId, 'contract', 'DEMO-CTR-0003.pdf', 3001);
    await ensureDocument(rentalId, 'invoice', 'DEMO-INV-0003.pdf', 3002, invoiceId);
    await ensureDocument(rentalId, 'inspection_report', 'DEMO-CTR-0003-inspections.pdf', 3003);

    const rev = await q(
      `INSERT INTO vehicle_reviews (customer_id,rental_id,vehicle_id,rating,title,comment)
       VALUES ($1,$2,$3,4,'Très luxueuse','Voiture exceptionnelle. Un petit dommage a été facturé, traitement correct.')
       ON CONFLICT (rental_id) DO NOTHING`,
      [res.cust, rentalId, res.v.id],
    );
    bump('vehicle_reviews', rev.rowCount);
  }

  // --- Rental D : Lamborghini Urus (réservation 4), EN COURS ---
  {
    const res = reservations['RES-2026-900004'];
    const ins = await q(
      `INSERT INTO rentals (contract_number, reservation_id, status, started_at, expected_return_at, opened_by, notes)
       VALUES ('DEMO-CTR-0004',$1,'active',$2,$3,$4,'Location en cours.')
       ON CONFLICT (contract_number) DO NOTHING RETURNING id`,
      [res.id, at(-2), at(3), admin],
    );
    const rentalId = ins.rows[0]?.id ?? (await q(`SELECT id FROM rentals WHERE contract_number='DEMO-CTR-0004'`)).rows[0].id;
    bump('rentals', ins.rowCount);

    const h = await q(
      `INSERT INTO inspections (rental_id,type,performed_at,performed_by,mileage_km,fuel_level_pct,overall_condition,notes)
       VALUES ($1,'handover',$2,$3,$4,100,'excellent','Départ au showroom.')
       ON CONFLICT (rental_id,type) DO NOTHING`,
      [rentalId, at(-2, 9), admin, res.v.mileage],
    );
    bump('inspections', h.rowCount);

    const dep = await q(
      `INSERT INTO security_deposits (rental_id,amount,status,held_at)
       VALUES ($1,$2,'held',$3) ON CONFLICT (rental_id) DO NOTHING`,
      [rentalId, res.v.deposit, at(-2, 9)],
    );
    bump('security_deposits', dep.rowCount);

    for (const p of [
      ['rental_payment', 'card', res.grandTotal, 'PAY-DEMO-0004-R'],
      ['deposit_payment', 'card', res.v.deposit, 'PAY-DEMO-0004-D'],
    ]) {
      const r = await q(
        `INSERT INTO payments (rental_id,type,method,amount,reference,recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (rental_id, type, reference) WHERE reference IS NOT NULL DO NOTHING`,
        [rentalId, p[0], p[1], n2(p[2]), p[3], admin],
      );
      bump('payments', r.rowCount);
    }

    await ensureDocument(rentalId, 'contract', 'DEMO-CTR-0004.pdf', 4001);
  }

  // ==========================================================
  // 6. FAVORIS
  // ==========================================================

  const FAVORITES = [
    [C1, 'LC-0007'], [C1, 'LC-0012'], [C1, 'LC-0028'],
    [C2, 'LC-0038'], [C2, 'LC-0044'],
    [C3, 'LC-0028'], [C3, 'LC-0039'],
  ];
  for (const [cust, plate] of FAVORITES) {
    const r = await q(
      `INSERT INTO favorite_vehicles (customer_id, vehicle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cust, vehicles[plate].id],
    );
    bump('favorite_vehicles', r.rowCount);
  }

  // ==========================================================
  // 7. INDISPONIBILITÉS PLANIFIÉES
  // ==========================================================

  const UNAVAIL = [
    ['LC-0053', 60, 62, 'maintenance', 'Entretien périodique constructeur'],
    ['LC-0035', 70, 72, 'repair', 'Remplacement des plaquettes de frein'],
  ];
  for (const [plate, from, to, reason, notes] of UNAVAIL) {
    const exists = (await q('SELECT 1 FROM vehicle_unavailability WHERE vehicle_id=$1 AND starts_at=$2', [vehicles[plate].id, at(from)])).rowCount;
    if (!exists) {
      await q(
        `INSERT INTO vehicle_unavailability (vehicle_id,starts_at,ends_at,reason,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [vehicles[plate].id, at(from), at(to), reason, notes, admin],
      );
      bump('vehicle_unavailability');
    }
  }

  // ==========================================================
  // 8. NOTIFICATIONS PERSONNELLES + PRÉFÉRENCES
  // ==========================================================

  const NOTIFS = [
    [C1, 'reservations', 'info', 'Réservation confirmée', 'Votre réservation RES-2026-900005 a été confirmée.', '/account/reservations', 'demo:res:5'],
    [C1, 'rentals', 'success', 'Prise en charge effectuée', 'Votre location du Lamborghini Urus a débuté.', '/account/rentals', 'demo:rental:4'],
    [C1, 'payments', 'info', 'Paiement enregistré', 'Nous avons enregistré votre paiement de 11 150,00 €.', '/account/rentals', 'demo:pay:4'],
    [C2, 'reservations', 'info', 'Réservation confirmée', 'Votre réservation RES-2026-900006 a été confirmée.', '/account/reservations', 'demo:res:6'],
    [C2, 'reservations', 'warning', 'Réservation en attente', 'Votre réservation RES-2026-900008 est en attente de validation.', '/account/reservations', 'demo:res:8'],
    [C3, 'rentals', 'warning', 'Frais additionnels', 'Des frais de réparation ont été ajoutés à votre location.', '/account/rentals', 'demo:rental:3'],
    [C3, 'reservations', 'success', 'Réservation confirmée', 'Votre réservation RES-2026-900007 a été confirmée.', '/account/reservations', 'demo:res:7'],
    [admin, 'fleet', 'info', 'Entretien planifié', 'Le véhicule LC-0053 entre en maintenance dans 60 jours.', '/admin/vehicles', 'demo:fleet:1'],
    [admin, 'payments', 'success', 'Paiement reçu', 'Un paiement de 13 405,00 € a été enregistré.', '/admin/finance', 'demo:adminpay:2'],
  ];
  for (const [recipient, cat, prio, title, message, url, key] of NOTIFS) {
    const r = await q(
      `INSERT INTO user_notifications (recipient_id,category,priority,title,message,action_url,event_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (recipient_id,event_key) DO NOTHING`,
      [recipient, cat, prio, title, message, url, key],
    );
    bump('user_notifications', r.rowCount);
  }

  for (const uid of [C1, C2, C3, admin]) {
    const r = await q(
      `INSERT INTO notification_preferences (user_id,booking_updates,rental_reminders,fleet_news,email_enabled)
       VALUES ($1,true,true,true,false) ON CONFLICT (user_id) DO NOTHING`,
      [uid],
    );
    bump('notification_preferences', r.rowCount);
  }

  // ==========================================================
  // 9. E-MAILS CLIENTS (outbox)
  // ==========================================================

  const EMAILS = [
    [C1, 'Confirmation de votre réservation', 'Bonjour, votre réservation RES-2026-900005 est confirmée.'],
    [C2, 'Votre contrat de location', 'Bonjour, votre contrat de location est disponible.'],
    [C3, 'Merci pour votre visite', 'Bonjour, merci d’avoir choisi LuxuryCars. Au plaisir de vous revoir.'],
  ];
  for (const [cust, subject, message] of EMAILS) {
    const exists = (await q('SELECT 1 FROM customer_email_outbox WHERE customer_id=$1 AND subject=$2', [cust, subject])).rowCount;
    if (!exists) {
      await q(
        `INSERT INTO customer_email_outbox (customer_id,subject,message,status,sent_at)
         VALUES ($1,$2,$3,'sent',now())`,
        [cust, subject, message],
      );
      bump('customer_email_outbox');
    }
  }

  // ==========================================================
  // 10. JOURNAL D'AUDIT
  // ==========================================================

  const AUDIT = [
    ['RESERVATION_CONFIRMED', 'reservations', reservations['RES-2026-900005'].id],
    ['RESERVATION_CONFIRMED', 'reservations', reservations['RES-2026-900006'].id],
    ['RESERVATION_CONFIRMED', 'reservations', reservations['RES-2026-900007'].id],
    ['RENTAL_OPENED', 'rentals', null],
    ['RENTAL_CLOSED', 'rentals', null],
    ['INVOICE_ISSUED', 'invoices', null],
  ];
  for (const [action, entityType, entityId] of AUDIT) {
    const exists = (await q('SELECT 1 FROM audit_logs WHERE action=$1 AND entity_type=$2 AND entity_id IS NOT DISTINCT FROM $3', [action, entityType, entityId])).rowCount;
    if (!exists) {
      await q(
        `INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,new_values)
         VALUES ($1,$2,$3,$4,$5)`,
        [admin, action, entityType, entityId, JSON.stringify({ source: 'seed-demo-data' })],
      );
      bump('audit_logs');
    }
  }

  await q('COMMIT');
  console.log('✓ Données de démonstration insérées (transaction validée).');
} catch (error) {
  await q('ROLLBACK');
  console.error('✗ Échec — tout a été annulé :', error.message);
  process.exitCode = 1;
} finally {
  console.log('\nLignes ajoutées par table :');
  for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(26)} ${v}`);
  await client.end();
}
