# Tester l'API avec Postman

Guide complet pour tester le backend NestJS de bout en bout.

---

## 1. Prérequis

| Outil | Version | Vérification |
|---|---|---|
| Node.js | 20+ | `node -v` |
| PostgreSQL | 15+ | `psql --version` |
| Postman | Desktop ou Web | — |

Les dépendances sont déjà installées (`node_modules` existe dans `backend/` et `frontend/`).

---

## 2. Démarrage rapide (copier-coller)

Ouvrir **deux terminaux**.

### Terminal 1 — Base de données + backend

```powershell
cd "C:\Users\soulaimen pc\Desktop\LUXURYCARS\luxury-car-rental\backend"

# 1. Créer la base si elle n'existe pas encore
#    (lecture des identifiants depuis .env)
$envMap = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_0-9]+)\s*=\s*(.*)$') { $envMap[$Matches[1]] = $Matches[2].Trim() }
}
$env:PGPASSWORD = $envMap['DB_PASSWORD']
& "C:\Program Files\PostgreSQL\15\bin\createdb.exe" `
    -h $envMap['DB_HOST'] -p $envMap['DB_PORT'] `
    -U $envMap['DB_USERNAME'] $envMap['DB_DATABASE'] 2>$null

# 2. Appliquer le schéma
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" `
    -h $envMap['DB_HOST'] -p $envMap['DB_PORT'] `
    -U $envMap['DB_USERNAME'] -d $envMap['DB_DATABASE'] `
    -v ON_ERROR_STOP=1 -f "database\schema.sql"

# 3. Créer le compte administrateur (OBLIGATOIRE)
node scripts\create-admin.mjs

# 4. Lancer l'API
npm run start:dev
```

L'API doit afficher :

```
Backend running on http://localhost:3001
[Nest] ... Mapped {/auth/login, POST}
...
```

### Terminal 2 — Vérification

```powershell
curl.exe http://localhost:3001
#Hello World!
```

Puis dans Postman : **Import** → `backend/postman/luxury-cars.postman_collection.json` → **Run collection**.

---

## 3. Pourquoi l'étape 3 est obligatoire

**Aucune route de l'API ne permet de créer un administrateur.**

`backend/src/users/users.service.ts` force systématiquement le rôle :

```ts
role: UserRole.CUSTOMER,
```

L'inscription publique (`POST /auth/register`) passe par cette méthode. Il n'existe ni route de création d'utilisateur, ni script de seed, ni script de migration dans `package.json`.

Conséquence : sans compte admin, **toutes** ces routes sont inaccessibles :

- `GET /dashboard/admin`
- `GET /reservations/admin/pending`
- `PATCH /reservations/admin/by-number/:n/confirm`
- `PATCH /reservations/admin/by-number/:n/reject`
- `POST /vehicles`, `POST /vehicles/brands|categories|models`
- `GET /vehicles` (liste admin)
- `PATCH /vehicles/by-plate/:plate`
- `POST /vehicles/by-plate/:plate/image` (photo) et `.../video`
- `DELETE /vehicles/by-plate/:plate/image` et `.../video`

Le script `scripts/create-admin.mjs` insère le compte en SQL avec le rôle `admin` et un hash Argon2 — exactement le même format que `auth.service.ts`.

**Le script est idempotent** : le relancer réinitialise le mot de passe et réactive le compte.

```powershell
node scripts\create-admin.mjs
node scripts\create-admin.mjs mon@admin.com "UnMotDePasse123!"
```

> `import 'dotenv/config'` lit `.env` depuis le **répertoire courant**. Lancer la commande depuis `backend/`.

---

## 4. Pourquoi `psql` plutôt que le CLI TypeORM

`package.json` ne contient **aucun script de migration**. Et le CLI TypeORM ne peut pas charger `src/database/data-source.ts` car **`ts-node` n'est pas installé** (le projet est en ESM avec `"type": "module"`).

`database/schema.sql` ne dépend pas de TypeORM : il suffit donc de l'appliquer directement.

Le schéma installe automatiquement les extensions nécessaires :

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- contraintes d'exclusion (anti-double réservation)
CREATE EXTENSION IF NOT EXISTS citext;       -- emails insensibles à la casse
```

`gen_random_uuid()` est intégré depuis PostgreSQL 13.

### Alternative avec le CLI TypeORM

Si vous préférez passer par les migrations TypeORM (à/build d'abord) :

```powershell
npm run build
npx typeorm migration:run -d dist/database/data-source.js
```

⚠️ `down()` lève volontairement une exception : l'rollback doit être écrit et relu à la main.

---

## 5. Variables de la collection

| Variable | Valeur par défaut |
|---|---|
| `baseUrl` | `http://localhost:3001` |
| `adminEmail` | `admin@luxury.test` |
| `adminPassword` | `AdminPass123!` |
| `customerEmail` | `client@luxury.test` |
| `customerPassword` | `ClientPass123!` |

Les variables suivantes sont **remplies automatiquement** par les scripts de test :
`adminToken`, `customerToken`, `reservationToCancel`, `reservationToConfirm`, `reservationToReject`.

Les dates (`pickupDate`, `returnDate`) sont **calculées dynamiquement** dans les scripts *Pre-request* à +30, +40 et +50 jours, car l'API refuse toute date de départ dans le passé.

---

## 6. Ordre d'exécution

L'ordre des dossiers est significatif.

```
00 · Santé                     aucun jeton
01 · Auth — Administrateur     login → capture adminToken
02 · Auth — Client             register ×2, login → capture customerToken
03 · Profil utilisateur        auth/me, profile/me, PATCH
04 · Marques                   GET public, POST admin
05 · Catégories                GET public, POST admin
06 · Modèles                   GET public, POST admin
07 · Véhicules                 POST admin, GET admin, PATCH admin, POST/DELETE média, GET catalog, GET available
08 · Profil client & permis    POST customer-profiles/me, GET customer-profiles/me
09 · Réservations — Client     3× POST, GET me, PATCH cancel
10 · Réservations — Admin      GET pending, PATCH confirm, PATCH reject
11 · Tableau de bord           GET dashboard/admin
12 · Cas d'erreur              12 requêtes volontairement invalides
```

### Pourquoi cet ordre est obligatoire

1. **Les marques, catégories et modèles doivent exister avant les véhicules.** Les APIs de création référencent par *nom* et renvoient `404 Brand not found` sinon.

2. **Le profil client doit exister avant toute réservation.** Sinon `400 Complete your customer profile before booking`.

3. **Le permis est contrôlé automatiquement lors de la confirmation.** `confirmReservation` vérifie que les informations du permis sont présentes et que sa date d'expiration couvre toute la période de location.

4. **Les trois réservations utilisent des périodes non chevauchantes** (+30/+33, +40/+45, +50/+52). La contrainte d'exclusion PostgreSQL `ex_res_no_double_booking` renverrait sinon `409`.

   > Une réservation ne peut être **ni confirmée puis refusée, ni annulée puis confirmée** : le statut n'est plus `pending`. Il faut donc trois réservations distinctes.

---

## 7. Réponses attendues

### `POST /vehicles` (201)

```json
{
  "id": "7f3c…",
  "modelId": "a91b…",
  "manufactureYear": 2023,
  "licensePlate": "TUN-488-FR",
  "vin": "WP0ZZZ99ZTS392134",
  "color": "Rouge",
  "transmission": "automatic",
  "fuelType": "petrol",
  "seats": 2,
  "powerHp": 700,
  "dailyPrice": "1450.00",
  "securityDeposit": "5000.00",
  "mileageKm": 12000,
  "status": "active"
}
```

⚠️ Les colonnes `NUMERIC` arrivent en **chaîne** (`"1450.00"`), pas en nombre. C'est normal : PostgreSQL préserve la précision, TypeORM ne convertit pas.

### `POST /auth/login` (200)

```json
{
  "accessToken": "eyJhbGciOi…",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "…", "firstName": "…", "role": "admin" }
}
```

Durée de vie **1 heure**. Il n'y a pas de refresh token : `refresh_tokens` existe dans le schéma mais n'est pas utilisé. Après 1 h, relancez `POST /auth/login`.

### `POST /reservations` (201)

```json
{
  "id": "b2e4…",
  "reservationNumber": "RES-2026-000001",
  "status": "pending",
  "pickupAt": "2026-11-03T00:00:00.000Z",
  "returnAt": "2026-11-06T00:00:00.000Z",
  "rentalDays": 3,
  "dailyPrice": "1450.00",
  "depositAmount": "5000.00",
  "totalAmount": "4350.00",
  "customerNotes": "…",
  "decidedBy": null,
  "decidedAt": null,
  "decisionReason": null
}
```

Le numéro `RES-YYYY-000001` est généré par un `DEFAULT` PostgreSQL sur la colonne.

Le total est calculé **en centimes entiers** puis reconverti, et une contrainte `CHECK (total_amount = rental_days * daily_price)` le revérifie en base.

### `GET /dashboard/admin` (200)

```json
{
  "vehicles":    { "total": 1, "byStatus": { "active": 1 } },
  "reservations":{ "total": 3, "byStatus": { "pending": 1, "confirmed": 1, "rejected": 1 } },
  "customers":   { "total": 1 }
}
```

> `customers.total` compte les **profils clients** (table `customer_profiles`), pas les utilisateurs de rôle `customer`. La vue `v_dashboard_summary` du schéma utilise une autre définition (comptes `users`). Ce service n'utilise pas la vue.

---

## 8. Cas d'erreur à vérifier

Le dossier `12 · Cas d'erreur attendus` contient 12 requêtes qui **doivent toutes échouer**.

| Requête | Code | Cause |
|---|---|---|
| Champ `country` dans `POST /vehicles/brands` | **400** | `forbidNonWhitelisted: true` — le ValidationPipe global rejette tout champ absent du DTO |
| Marque déjà créée | **409** | doublon `ILike` |
| Mot de passe erroné | **401** | message volontairement générique |
| `dashboard/admin` avec un jeton client | **403** | authentifié mais rôle insuffisant |
| `reservations/me` sans jeton | **401** | en-tête `Authorization` manquant |
| `available?from=2027-06-10&to=2027-06-05` | **400** | `return_at > pickup_at` |
| `available?from=15-10-2026` | **400** | regex `^\d{4}-\d{2}-\d{2}$` |
| `available?from=2027-02-30` | **400** | format valide mais date calendaire inexistante |
| `mileageKm: 100` après `18500` | **400** | le kilométrage ne peut pas diminuer |
| VIN `WP0ZZZ99ZTS39213O` | **400** | regex `/^[A-HJ-NPR-Z0-9]{17}$/` — `O` est exclu |
| Plaque `tun-488-fr` (déjà `TUN-488-FR`) | **409** | normalisée en majuscules avant recherche |
| Motif de refus `"Non"` | **400** | `@Length(5, 500)` sur `RejectReservationDto` |

### Codes HTTP du projet

| Code | Signification |
|---|---|
| 200 | lecture / mise à jour réussie |
| 201 | ressource créée |
| 400 | validation DTO ou règle métier |
| 401 | jeton absent, invalide ou compte non actif |
| 403 | rôle insuffisant |
| 404 | ressource introuvable (ou masquée volontairement) |
| 409 | conflit d'unicité, chevauchement de dates, statut incompatible |

---

## 9. Tester les garde-fous PostgreSQL

C'est le cœur du système. Testez-le **directement en SQL** — Postman ne peut pas déclencher un conflit de dates en parallèle.

```powershell
$envMap = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_0-9]+)\s*=\s*(.*)$') { $envMap[$Matches[1]] = $Matches[2].Trim() }
}
$env:PGPASSWORD = $envMap['DB_PASSWORD']
$psql = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
$conn = @('-h',$envMap['DB_HOST'],'-p',$envMap['DB_PORT'],'-U',$envMap['DB_USERNAME'],'-d',$envMap['DB_DATABASE'])

function Invoke-Sql($sql) { & $psql @conn -v ON_ERROR_STOP=1 -c $sql }

# Un.trigger refuse qu'une réservation chevauche une fenêtre de maintenance
Invoke-Sql @"
SELECT v.license_plate, u.starts_at, u.ends_at
FROM vehicle_unavailability u
JOIN vehicles v ON v.id = u.vehicle_id;
"@

# La vue du catalogue public
Invoke-Sql "SELECT * FROM v_dashboard_summary;"

# Les réservations en attente
Invoke-Sql "SELECT reservation_number, status, total_amount FROM reservations ORDER BY created_at DESC;"
```

### La double réservation est impossible

```sql
-- Doit échouer : exclusion constraint "ex_res_no_double_booking"
INSERT INTO reservations (customer_id, vehicle_id, pickup_at, return_at,
                          rental_days, daily_price, deposit_amount, total_amount)
SELECT customer_id, vehicle_id, pickup_at, return_at,
       rental_days, daily_price, deposit_amount, total_amount
FROM reservations WHERE status = 'confirmed' LIMIT 1;
```

Le message PostgreSQL attendu :

```
ERROR:  conflicting key value violates exclusion constraint "ex_res_no_double_booking"
```

C'est exactement ce code (`23P01`) que `reservations.service.ts` intercepte pour renvoyer un `409` propre.

---

## 10. Repartir de zéro

**L'API n'expose pas de `DELETE` généraliste.** Aucun véhicule, marque, catégorie, modèle ou réservation ne peut être supprimé. La seule exception concerne les **médias d'un véhicule** : `DELETE /vehicles/by-plate/:plate/image` et `DELETE /vehicles/by-plate/:plate/video` retirent la photo ou la vidéo (fichier + ligne). Pour tout le reste, le CRUD disponible est en réalité un **CRU** (Create, Read, Update).

Pour réinitialiser entre deux tests :

```powershell
Invoke-Sql @"
TRUNCATE reservations, vehicle_unavailability, vehicle_images,
         vehicle_models, vehicles, categories, brands,
         customer_profiles, users
RESTART IDENTITY CASCADE;
"@

# Puis recréer l'admin
node scripts\create-admin.mjs
```

> `TRUNCATE ... CASCADE` supprime aussi `payments`, `invoices`, `rentals` — ils n'ont pas d'entité TypeORM mais référencent ces tables.

---

## 11. Exécution en ligne de commande (Newman)

Newman permet de rejouer la collection sans interface Postman.

```powershell
cd "C:\Users\soulaimen pc\Desktop\LUXURYCARS\luxury-car-rental\backend"

npx --yes newman@6 run postman\luxury-cars.postman_collection.json `
  --env-var "baseUrl=http://localhost:3001" `
  --reporters cli
```

> Le drapeau se nomme **`--env-var`**, pas `-e` : `-e` attend un *fichier* d'environnement. Écrire `-e "baseUrl=..."` provoque une erreur.

### Prérequis : une base propre

La collection **n'est pas idempotente** — un second passage renvoie `409` sur la création des marques. Réinitialiser avant chaque exécution (voir section 10), puis recréer l'admin :

```powershell
Invoke-Sql @"
TRUNCATE reservations, vehicle_unavailability, vehicle_images,
         vehicle_models, vehicles, categories, brands,
         customer_profiles, users
RESTART IDENTITY CASCADE;
"@

node scripts\create-admin.mjs
```

### Résultat attendu

```
┌─────────────────────────┬───────────────────┬──────────────────┐
│              requests  │                45 │                0 │
│        test-scripts     │                45 │                0 │
│      prerequest-scripts │                 4 │                0 │
│           assertions    │                68 │                0 │
└─────────────────────────┴───────────────────┴──────────────────┘
```

**68 assertions, 0 échec.** Si une assertion échoue, c'est presque toujours une base déjà peuplée (voir ci-dessus) ou un backend arrêté.

### Isolation : une base dédiée

Pour ne pas toucher aux données de développement, utiliser une seconde base :

```powershell
# 1. Créer et peupler la base de test
& "C:\Program Files\PostgreSQL\15\bin\createdb.exe" `
    -h $envMap['DB_HOST'] -p $envMap['DB_PORT'] `
    -U $envMap['DB_USERNAME'] luxury_car_rental_test

& "C:\Program Files\PostgreSQL\15\bin\psql.exe" `
    -h $envMap['DB_HOST'] -p $envMap['DB_PORT'] `
    -U $envMap['DB_USERNAME'] -d luxury_car_rental_test `
    -q -v ON_ERROR_STOP=1 -f database\schema.sql

# 2. Créer l'admin dans CETTE base
$env:DB_DATABASE = 'luxury_car_rental_test'
node scripts\create-admin.mjs

# 3. Démarrer l'API sur cette base et un autre port
$env:DB_DATABASE = 'luxury_car_rental_test'
$env:PORT = '3011'
npx nest start

# 4. Exécuter la collection contre le port 3011
npx --yes newman@6 run postman\luxury-cars.postman_collection.json `
  --env-var "baseUrl=http://localhost:3011" --reporters cli
```

`dotenv` ne surcharge pas les variables déjà présentes dans l'environnement : les valeurs `$env:` ci-dessus priment sur le fichier `.env`.

Pour l'intégration continue, `newman-reporter-htmlextra` produit un rapport HTML.

---

## 12. Tests automatisés existants

La collection Postman complète est déjà couverte côté serveur.

```powershell
npm test          # 33 tests unitaires (vitest)
npm run test:e2e  # tests de bout en bout
npm run lint      # oxlint
```

Couverture actuelle :

| Fichier | Tests |
|---|---|
| `auth.service.spec.ts` | 6 |
| `reservations.service.spec.ts` | 5 |
| `reservations-admin.service.spec.ts` | 5 |
| `jwt-auth.guard.spec.ts` | 5 |
| `roles.guard.spec.ts` | 4 |
| `users.profile.spec.ts` | 4 |
| `users.service.spec.ts` | 3 |
| `app.controller.spec.ts` | 1 |

> `test/app.e2e-spec.ts` vérifie encore `'Hello World!'` — reliquat du starter NestJS, à remplacer.

---

## 13. Limites connues lors des tests

| Limite | Impact |
|---|---|
| **`DELETE` limité aux médias** | seuls la photo et la vidéo d'un véhicule peuvent être supprimées ; CRU pour le reste, réinitialisation manuelle en SQL |
| **Aucun refresh token** | les jetons expirent au bout d'1 h |
| **Pas de rate limiting** sur `/auth/login` | pas de protection anti-bruteforce |
| **Pas de CORS** dans `main.ts` | un frontend sur `:3000` ne peut pas appeler l'API sur `:3001` |
| **Pas de seed** | tout le catalogue doit être créé via l'API ou le SQL |
| **8 tables sans entité** | `rentals`, `inspections`, `payments`, `invoices`, `documents`, `audit_logs`, `vehicle_unavailability`, `security_deposits` existent en SQL mais n'ont ni module ni route (`vehicle_images` a désormais une entité et des routes, via le module véhicules) |
| **Vues ignorées** | `v_dashboard_summary` et `v_monthly_revenue` ne sont pas utilisées par le service |
| **Migration dépend du `cwd`** | `database/schema.sql` est résolu depuis `process.cwd()` |

---

## 14. Commandes complètes

```powershell
cd "C:\Users\soulaimen pc\Desktop\LUXURYCARS\luxury-car-rental\backend"

npm install            # si node_modules est absent
npm run start:dev      # API sur :3001, rechargement à chaud
npm run build          # compile vers dist/
npm run start:prod     # node dist/main
npm test               # 33 tests unitaires
npm run test:cov       # couverture
npm run test:e2e
npm run format         # prettier
npm run lint           # oxlint

node scripts\create-admin.mjs    # créer/réinitialiser l'admin
```
