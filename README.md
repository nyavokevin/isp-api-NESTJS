# Mini ISP Management API — NestJS + RouterOS

API backend complète pour la gestion d'un mini FAI (Fournisseur d'Accès Internet) avec
intégration native RouterOS/MikroTik via l'API Winbox (port 8728).

---

## Stack technique

| Composant       | Technologie                          |
|-----------------|--------------------------------------|
| Framework       | NestJS 10 (Node.js)                  |
| Langage         | TypeScript 5                         |
| Auth            | JWT (Bearer token) via Passport      |
| RouterOS        | `node-routeros` (API Winbox port 8728)|
| Documentation   | Swagger / OpenAPI 3                  |
| Validation      | class-validator + class-transformer  |

---

## Installation rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Editer .env avec vos paramètres RouterOS

# 3. Démarrer en développement
npm run start:dev

# 4. Ou compiler + démarrer en production
npm run build && npm start
```

L'API démarre sur **http://localhost:3001**
Swagger UI disponible sur **http://localhost:3001/docs**

---

## Configuration `.env`

```env
PORT=3001
JWT_SECRET=votre-secret-jwt-fort
JWT_EXPIRES_IN=24h

# MikroTik RouterOS (API Winbox)
ROUTEROS_HOST=192.168.88.1
ROUTEROS_USER=admin
ROUTEROS_PASSWORD=votre-mot-de-passe
ROUTEROS_PORT=8728
ROUTEROS_TIMEOUT=10000
```

> **Note RouterOS** : L'application fonctionne en mode **dégradé gracieux** si le routeur
> est inaccessible — toutes les routes retournent les données seed locales sans erreur.

---

## Comptes seed (développement)

Le compte admin par défaut est créé au démarrage via le seed auth dans `src/auth/auth.service.ts`.

| Email                  | Mot de passe | Rôle         |
|------------------------|--------------|--------------|
| admin@isp.mg           | admin123     | admin        |
| tech@isp.mg            | tech123      | technician   |
| commercial@isp.mg      | sales123     | sales        |

---

## Endpoints API

### Auth — `/api/auth`

| Méthode | Route        | Description                          |
|---------|--------------|--------------------------------------|
| POST    | `/login`     | Connexion → retourne JWT token        |
| GET     | `/me`        | Profil session courante (auth requis) |
| POST    | `/logout`    | Déconnexion (invalide côté client)    |

**Exemple login :**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@isp.mg","password":"admin123"}'
```

---

### Clients — `/api/clients`

| Méthode | Route               | RouterOS                  | Description                    |
|---------|---------------------|---------------------------|--------------------------------|
| GET     | `/`                 | —                         | Liste avec filtres (search, status, area, plan) |
| GET     | `/stats`            | —                         | Agrégats (total, actifs, soldes)|
| GET     | `/:id`              | —                         | Détail client                  |
| POST    | `/`                 | `ppp/secret/add`          | Créer client + secret PPPoE    |
| PUT     | `/:id`              | `ppp/secret/set`          | Modifier client (sync RouterOS)|
| DELETE  | `/:id`              | `ppp/secret/remove`       | Supprimer client + secret      |
| POST    | `/:id/suspend`      | `ppp/secret/set disabled` | Suspendre (désactive PPPoE)    |
| POST    | `/:id/activate`     | `ppp/secret/set enabled`  | Activer (réactive PPPoE)       |

**Body création client :**
```json
{
  "name": "Jean Rakoto",
  "phone": "+261340000001",
  "address": "Lot II J 45 Antananarivo",
  "pppoeLogin": "jean.rakoto",
  "pppoePassword": "secret123",
  "plan": "fiber-10mbps",
  "expiration": "2025-12-31",
  "area": "Antananarivo Centre"
}
```

---

### Payments — `/api/payments`

| Méthode | Route          | Description                                    |
|---------|----------------|------------------------------------------------|
| GET     | `/`            | Liste transactions (filtres: search, state, method, clientId) |
| GET     | `/dashboard`   | Stats mensuelles, impayés, transactions récentes |
| GET     | `/:id`         | Détail transaction                             |
| POST    | `/`            | Enregistrer un paiement                        |
| PUT     | `/:id`         | Modifier un paiement                           |
| DELETE  | `/:id`         | Supprimer un paiement                          |

**États paiement :** `Collected` | `Pending` | `Overdue`
**Moyens paiement :** `cash` | `MVola` | `Airtel Money` | `Orange Money` | `Virement` | `Cheque`

---

### Plans — `/api/plans`

| Méthode | Route              | RouterOS                     | Description                   |
|---------|--------------------|------------------------------|-------------------------------|
| GET     | `/`                | —                            | Catalogue des plans           |
| GET     | `/sync-routeros`   | `ppp/profile/print`          | Sync profils depuis MikroTik  |
| GET     | `/:id`             | —                            | Détail plan                   |
| POST    | `/`                | `ppp/profile/add`            | Créer plan + profil PPPoE     |
| PUT     | `/:id`             | `ppp/profile/set`            | Modifier plan (sync RouterOS) |
| DELETE  | `/:id`             | `ppp/profile/remove`         | Supprimer plan + profil       |

**Body création plan :**
```json
{
  "name": "Fibre 10 Mbps",
  "profileId": "fiber-10mbps",
  "price": 25000,
  "download": 10,
  "upload": 5,
  "quota": "Illimite",
  "validity": "30 jours",
  "popular": true
}
```
> Le `rate-limit` RouterOS est calculé automatiquement : `10M/5M`

---

### Monitoring — `/api/monitoring`

| Méthode | Route                        | RouterOS source                   | Description                  |
|---------|------------------------------|-----------------------------------|------------------------------|
| GET     | `/`                          | Tout combiné                      | Dashboard monitoring complet |
| GET     | `/system`                    | `system/resource/print`           | CPU, RAM, uptime, stockage   |
| GET     | `/sessions`                  | `ppp/active/print`                | Sessions PPPoE actives       |
| GET     | `/hotspot/connected`         | `ip/hotspot/active/print` + `ip/hotspot/host/print` | Clients hotspot connectés + nom appareil |
| GET     | `/interfaces`                | `interface/print`                 | Interfaces et trafic         |
| GET     | `/logs`                      | `log/print`                       | Journal événements           |
| POST    | `/ping`                      | `ping`                            | Ping depuis le routeur       |
| POST    | `/sessions/:id/disconnect`   | `ppp/active/remove`               | Déconnecter session PPPoE    |

---

## Architecture du projet

```
src/
├── main.ts                          # Bootstrap + Swagger setup
├── app.module.ts                    # Module racine
│
├── auth/
│   ├── auth.controller.ts           # POST /auth/login, GET /auth/me
│   ├── auth.service.ts              # Login, validation JWT, seed users
│   ├── auth.module.ts
│   ├── auth.dto.ts                  # LoginDto, SessionResponseDto
│   └── jwt.strategy.ts             # PassportJS JWT strategy
│
├── clients/
│   ├── clients.controller.ts        # CRUD + suspend/activate
│   ├── clients.service.ts           # Logique + sync RouterOS PPPoE secrets
│   ├── clients.module.ts
│   └── clients.dto.ts               # CreateClientDto, UpdateClientDto, QueryDto
│
├── payments/
│   ├── payments.controller.ts       # CRUD + dashboard
│   ├── payments.service.ts          # Logique + stats mensuelles
│   ├── payments.module.ts
│   └── payments.dto.ts              # CreatePaymentDto, PaymentState enum
│
├── plans/
│   ├── plans.controller.ts          # CRUD + sync RouterOS
│   ├── plans.service.ts             # Logique + sync PPPoE profiles
│   ├── plans.module.ts
│   └── plans.dto.ts                 # CreatePlanDto, UpdatePlanDto
│
├── monitoring/
│   ├── monitoring.controller.ts     # Lectures + actions distantes
│   ├── monitoring.service.ts        # Agrégation RouterOS + fallback seed
│   └── monitoring.module.ts
│
├── routeros/
│   ├── routeros.service.ts          # Service central RouterOS (toutes commandes)
│   └── routeros.module.ts
│
└── common/
    ├── filters/
    │   └── global-exception.filter.ts  # Gestion erreurs uniformes
    └── interceptors/
        └── response.interceptor.ts     # Envelope { success, data, timestamp }
```

---

## Format de réponse uniforme

Toutes les réponses sont enveloppées :

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

Erreurs :
```json
{
  "statusCode": 401,
  "message": "Email ou mot de passe invalide",
  "timestamp": "2025-01-01T10:00:00.000Z",
  "path": "/api/auth/login"
}
```

---

## Intégration RouterOS — Prérequis MikroTik

1. Activer l'API Winbox sur le routeur :
```
/ip service enable api
/ip service set api port=8728
```

2. Créer un utilisateur dédié (recommandé) :
```
/user add name=isp-api password=strong-password group=full
```

3. Autoriser l'IP du serveur dans le firewall si nécessaire.

---

## Migration vers base de données

Les données seed (tableaux `SEED_*` dans les services) sont conçus pour être
remplacés facilement par TypeORM/Prisma :

- Remplacer `SEED_CLIENTS` par un `Repository<Client>` TypeORM
- Les méthodes de service gardent les mêmes signatures
- L'intégration RouterOS reste inchangée

---

## Scripts disponibles

```bash
npm run start:dev    # Développement (ts-node, hot reload)
npm run build        # Compile TypeScript → dist/
npm start            # Démarrage production (depuis dist/)
```
