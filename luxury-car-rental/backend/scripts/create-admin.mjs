// ============================================================
// Créer ou réinitialiser un compte administrateur.
//
// AUCUNE ROUTE DE L'API NE PERMET DE CRÉER UN ADMIN :
// UsersService.createCustomer force role = 'customer'.
// Ce script est donc obligatoire pour tester les routes admin.
//
// Utilisation (depuis le dossier backend/) :
//   node scripts/create-admin.mjs
//   node scripts/create-admin.mjs admin@luxury.test "AdminPass123!"
//
// Le compte est idempotent : relancer le script réinitialise
// le mot de passe et réactive le compte.
// ============================================================

import 'dotenv/config';

import argon2 from 'argon2';
import pg from 'pg';

const { Client } = pg;

// ============================================================
// 1. PARAMÈTRES
// ============================================================

const email = (
  process.argv[2] ?? 'admin@luxury.test'
)
  .trim()
  .toLowerCase();

const password =
  process.argv[3] ?? 'AdminPass123!';

// Le DTO d'inscription exige 12 caractères minimum.
if (password.length < 12) {
  console.error(
    '✗ Le mot de passe doit contenir au moins 12 caractères.',
  );
  process.exit(1);
}

for (const key of [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
]) {
  if (!process.env[key]) {
    console.error(
      `✗ Variable manquante : ${key}.`,
    );
    console.error(
      '  Lancez la commande depuis le dossier backend/ pour que dotenv lise .env.',
    );
    process.exit(1);
  }
}

// ============================================================
// 2. HACHAGE ARGON2 (identique à l'API)
// ============================================================

console.log('→ Génération du hash Argon2...');

const passwordHash =
  await argon2.hash(password);

// ============================================================
// 3. CONNEXION POSTGRESQL
// ============================================================

const client = new Client({
  host: process.env.DB_HOST,

  port: Number(
    process.env.DB_PORT ?? 5432,
  ),

  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

await client.connect();

console.log(
  `→ Connecté à ${process.env.DB_DATABASE} sur ${process.env.DB_HOST}`,
);

// ============================================================
// 4. CRÉATION OU MISE À JOUR
// ============================================================

const existing =
  await client.query(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );

let userId;

if (existing.rowCount > 0) {
  // Le compte existe déjà : on réinitialise
  // le mot de passe et les droits.
  userId = existing.rows[0].id;

  await client.query(
    `UPDATE users
        SET password_hash = $2,
            role          = 'admin',
            status        = 'active',
            updated_at    = now()
      WHERE id = $1`,
    [userId, passwordHash],
  );

  console.log(
    `→ Compte existant mis à jour : ${email}`,
  );
} else {
  const inserted =
    await client.query(
      `INSERT INTO users (
         email,
         password_hash,
         role,
         status,
         first_name,
         last_name
       )
       VALUES ($1, $2, 'admin', 'active', $3, $4)
       RETURNING id`,
      [
        email,
        passwordHash,
        process.argv[4] ?? 'Administrateur',
        process.argv[5] ?? 'Système',
      ],
    );

  userId = inserted.rows[0].id;

  console.log(
    `→ Compte créé : ${email}`,
  );
}

await client.end();

// ============================================================
// 5. RÉCAPITULATIF
// ============================================================

console.log('');
console.log('  ┌─────────────────────────────────┐');
console.log('  │  COMPTE ADMINISTRATEUR PRÊT     │');
console.log('  └─────────────────────────────────┘');
console.log('');
console.log(`  email     : ${email}`);
console.log(`  password  : ${password}`);
console.log(`  user id   : ${userId}`);
console.log('');
console.log(
  '  Dans Postman : POST /auth/login',
);
console.log(
  '  → le rôle "admin" sera utilisé pour',
);
console.log(
  '    authenticate le token adminToken.',
);
console.log('');