# Doctor Tracker · Backend API

> REST API for Doctor Tracker, a secure portal for managing doctors, their patients and care analytics. Built with Express 5, MongoDB and Zod.

|                   |                                                                                 |
| ----------------- | ------------------------------------------------------------------------------- |
| **Live app**      | _add after deploy_                                                              |
| **Live API**      | _add after deploy_                                                              |
| **Frontend repo** | [DoctorTracker-frontend](https://github.com/rejwanul313/DoctorTracker-frontend) |
| **Backend repo**  | [DoctorTracker-backend](https://github.com/rejwanul313/DoctorTracker-backend)   |

Doctor Tracker gives hospital administrators one place to register doctors, assign and manage their patients, and see what's happening across the practice. Every list is searchable, filterable by date and attributes, and paginated. Every query is backed by a MongoDB index (verified by automated query-plan tests), so the portal stays fast as records grow. The dashboard turns raw records into KPIs and charts: visit trends, condition mix, patients per doctor and staff distribution. All of it sits behind authenticated, role-protected access.

This repo is the **standalone Express API**. The [Next.js frontend](https://github.com/rejwanul313/DoctorTracker-frontend) talks to it over REST (`/api/v1`) with a Bearer token.

**Stack:** Node.js 22 · Express 5 · TypeScript · MongoDB 8 + Mongoose · Zod · jsonwebtoken + bcrypt · helmet · express-rate-limit · pino · Vitest + Supertest + mongodb-memory-server

**Demo credentials** (created by the backend seed script): `admin@doctortracker.dev` / `Admin@123`

---

## Table of contents

- [Features](#features)
- [Setup guide](#setup-guide)
- [Deployment](#deployment)
- [System architecture](#system-architecture)
- [Technical decisions](#technical-decisions)
- [API reference](#api-reference)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Scalability notes & known limitations](#scalability-notes--known-limitations)

---

## Features

| Area               | What you get                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**           | `POST /auth/login` checks bcrypt hashes (constant-time, no account enumeration) and issues a short-lived HS256 JWT; `requireAuth` + `requireRole('admin')` guard every other route; login rate limit |
| **Doctors**        | CRUD, search (name, email, hospital), filters (specialization, hospital, joined date), whitelisted sorts, pagination; nested patient list/add/remove                                                 |
| **Patients**       | List with search and filters (condition, status, gender, doctor, visit date), get, update (including reassigning to another doctor), delete                                                          |
| **Stats**          | Overview KPIs, visits over time (`$dateTrunc` day/week/month buckets with gap fill), conditions breakdown, patients per doctor, doctors by specialization, all as aggregation pipelines              |
| **Data integrity** | `Doctor.patientCount` kept exact with `$inc` inside the same transaction as every patient create, delete and reassignment                                                                            |
| **Performance**    | ESR compound indexes on every filter/sort, `.lean()` + projections, parallel `find` + `countDocuments`, `explain()` tests that fail on `COLLSCAN` or in-memory `SORT`                                |
| **Hardening**      | helmet, CORS allow-list, compression, 100 kB body limit, Zod validation on body/query/params, central error handler with one JSON envelope, pino logs                                                |

---

## Setup guide

### Prerequisites

- **Node.js 22** (`.nvmrc` provided)
- **MongoDB as a replica set** (multi-document transactions keep `patientCount` consistent). Use the included Docker Compose file or a free MongoDB Atlas cluster.

### 1. Install

```bash
git clone https://github.com/rejwanul313/DoctorTracker-backend.git && cd DoctorTracker-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable        | Notes                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| `MONGODB_URI`   | Default points at the Docker replica set. For Atlas, paste your `mongodb+srv://…` URI |
| `JWT_SECRET`    | ≥ 32 random characters                                                                |
| `CLIENT_ORIGIN` | Allowed browser origin(s) of the frontend, comma-separated                            |
| `SEED_ADMIN_*`  | Credentials created by `npm run seed`                                                 |

### 3. Start MongoDB and seed demo data

```bash
npm run db:up          # docker compose: MongoDB 8 single-node replica set on :27017
npm run seed           # 1 admin, 50 doctors, 2,000 patients over the last 12 months
```

### 4. Run

```bash
npm run dev            # http://localhost:5000/api/v1  (try GET /health)
```

### Useful scripts

| Script                                        | Description                                                   |
| --------------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                                 | API with hot reload (tsx watch)                               |
| `npm run build` / `npm start`                 | Production bundle (tsup → `dist/`) and run it                 |
| `npm test` / `npm run test:coverage`          | Unit, service, route and query-plan tests (in-memory MongoDB) |
| `npm run typecheck` / `npm run lint`          | Quality gates                                                 |
| `npm run seed -- --doctors=10 --patients=200` | Custom seed size (**wipes** doctors and patients)             |
| `npm run db:up` / `npm run db:down`           | Start/stop the local MongoDB replica set (Docker)             |

---

## Deployment

The API runs on **Render** (from [`render.yaml`](render.yaml)) with **MongoDB Atlas** as the database. The [frontend](https://github.com/rejwanul313/DoctorTracker-frontend#deployment-vercel) runs on Vercel. Keep them in one area: Atlas on AWS `us-east-1`, Render `virginia` and Vercel's default `iad1`.

### 1. MongoDB Atlas

1. Create a free **M0** cluster on AWS `us-east-1`. Atlas clusters are replica sets, so transactions work.
2. **Database Access:** add a database user with a generated password.
3. **Network Access:** allow `0.0.0.0/0`, because Render's free plan has no fixed outbound IPs.
4. Copy the connection string and add the database name before the `?`:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/doctor-tracker?retryWrites=true&w=majority`
5. Seed it once from your machine. This creates the indexes, the admin user and the demo data:
   ```bash
   MONGODB_URI="mongodb+srv://…/doctor-tracker?retryWrites=true&w=majority" npm run seed
   ```

### 2. API on Render

1. In Render, choose **New → Blueprint** and select this repo. Render reads `render.yaml`, which sets the build and start commands, the health check, Node 22 and a generated `JWT_SECRET`.
2. When prompted, set `MONGODB_URI` (from step 1) and `CLIENT_ORIGIN`. If you don't know the Vercel URL yet, use `https://<project>.vercel.app` and correct it once the frontend is deployed.
3. Check `https://<service>.onrender.com/api/v1/health`. It should return `{"success":true,"data":{"status":"ok","db":"up"}}`.

> **Free-tier cold start:** Render's free plan sleeps after about 15 minutes idle, and the first request then takes 30–60 s. The frontend's login page pings `/health` as soon as it opens, so the API wakes while the user types. The **Starter** plan keeps it always on.

---

## System architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React UI (shadcn/Tailwind) · TanStack Query cache · URL state  │
└───────────────┬─────────────────────────────────┬───────────────┘
                │ pages (Auth.js session cookie)  │ fetch /api/v1/*  + Authorization: Bearer <JWT>
                ▼                                 │
┌───────────── Next.js (frontend repo) ──────────┐      │
│ middleware.ts → redirect if no session   │      │
│ Auth.js /api/auth/* (encrypted JWT cookie)│     │
│   authorize() ──── POST /auth/login ─────┼──┐   │
│ App Router: RSC shells + client views    │  │   │
└──────────────────────────────────────────┘  ▼   ▼
                         ┌──────────── Express (backend repo) ─────────────┐
                         │ helmet · CORS allow-list · compression     │
                         │ rate limits · pino logs · requireAuth/Role │
                         │ validate(Zod) → controller → service       │
                         │ central error handler → JSON envelope      │
                         └───────────────────┬────────────────────────┘
                                             │ Mongoose · lean() · projections · transactions
                                             ▼
                                   ┌──────── MongoDB ────────┐
                                   │ users · doctors ·       │
                                   │ patients (+ indexes)    │
                                   └─────────────────────────┘
          src/shared (copied in both repos): Zod schemas, constants, DTO types
```

**Request lifecycle (example: `/patients?condition=asthma&page=2`).**

1. `useListParams` parses the URL with the **shared** Zod schema. Invalid URLs fall back to defaults.
2. `usePatients(params)` builds a query key. TanStack Query dedupes requests, caches results and keeps the previous page visible during fetches.
3. `api-client` adds the Bearer token from the Auth.js session and unwraps the `{ success, data, meta }` envelope.
4. Express runs `requireAuth` → `requireRole('admin')` → `validate()` with the same Zod schema. The service builds an index-backed filter and runs `find` and `countDocuments` in parallel.
5. Mutations invalidate exactly the affected query keys (lists, detail, stats). Deletes update the UI optimistically and roll back on error.

**Data model.**

- `Doctor { name, specialization, hospital, phone, email (unique), patientCount, timestamps }`
- `Patient { name, age, gender, phone?, email?, condition, status, doctor → Doctor, visitDate, notes?, timestamps }`
- Every create, delete or reassignment of a patient updates `Doctor.patientCount` inside a transaction.

**Indexing.**

- Compound indexes follow the ESR rule (Equality → Sort → Range). Each ends with `_id` to match the stable `{ field, _id }` sort, so pages never overlap and MongoDB never sorts in memory.
- Search combines a `$text` phrase match with anchored prefix regexes on indexed fields.
- The backend's `src/tests/indexes.test.ts` asserts that every list query plan uses `IXSCAN`, with no `COLLSCAN` and no in-memory `SORT`.

The Zod schemas, constants and DTO types in `src/shared/` are identical in both repos, so the client validates forms and URL params with exactly the rules the API enforces. They are imported as `@doctor-tracker/shared` (a TypeScript path alias), so a change is copied to the other repo as-is.

---

## Technical decisions

### 1. Auth.js session + an Express-issued Bearer JWT (not cookies shared across services)

**Context.** The spec requires a separate Next.js client and a standalone Express API, which are typically deployed on different domains (e.g. Vercel + Render). A cookie-based session set by the API would be a third-party cookie from the browser's point of view. Such cookies are blocked by Safari and increasingly by Chrome, and would also need `credentials: 'include'` CORS plus CSRF defenses on the API.

**Decision.**

- Express owns the credential check: bcrypt with a constant-time compare against a dummy hash for unknown emails, and a login rate limit. It issues a short-lived HS256 JWT.
- Auth.js (Credentials provider) calls that endpoint server-side and stores the token in its own encrypted, httpOnly, first-party cookie. Next.js `middleware.ts` uses Auth.js to guard every page.
- The browser sends the token to the API as `Authorization: Bearer`, and Express verifies it statelessly (`requireAuth` → `requireRole`).

**Why.**

- No cross-site cookies and no CSRF surface on the API.
- The API stays stateless and horizontally scalable, and any client (mobile, CLI) can use it.
- Auth.js provides hardened session handling, CSRF protection on its own endpoints, and server-side `auth()` helpers.

**Trade-offs.**

- There are two secrets to manage.
- A token is valid until it expires (24 h). Revoking it sooner would need a deny-list or refresh-token rotation.
- When the API token expires, the `jwt` callback ends the session, so the user simply signs in again.

### 2. TanStack Query + URL search params instead of Redux

**Context.** About 95% of this app's state is _server state_ (paginated lists, details, aggregates). The rest is list parameters (search, filters, sort, page) and a little UI chrome.

**Decision.**

- **Server state:** TanStack Query, with a hierarchical query-key factory (`lib/query-keys.ts`).
- **List parameters:** the URL is the single source of truth, read through `useListParams` and validated by the same Zod schemas the API uses.
- **UI chrome:** Zustand, only for the sidebar collapse and the mobile drawer.

**Why.**

- Caching, request deduplication, cancellation (AbortSignal), retry policy, `keepPreviousData` pagination and targeted invalidation come for free. Redux/RTK would need much more boilerplate for the same behavior.
- URL state makes every view shareable and bookmarkable, survives refreshes and works with the back button.
- Components subscribe only to the query they render, which avoids global-store re-renders.

**Trade-offs.**

- URL parsing had to be done carefully. It lives in one well-tested hook that handles defaults, invalid input and page reset.
- There is no global "store" to inspect. React Query Devtools fills that role in development.

### Bonus: denormalized `patientCount`

Without the counter, the doctor list and the "patients per doctor" chart would each need a `$lookup`/`$group` over the entire patients collection on every request. With it, the top-N chart is an index-backed sort, and list rows cost O(page size). Writes keep the counter exact by updating it in the same transaction as the patient change, and tests cover create, delete, reassignment and rollback.

---

## API reference

Base URL: `/api/v1`. Every route except `/health` and `/auth/login` requires `Authorization: Bearer <token>`.

```
GET    /health
POST   /auth/login                       GET /auth/me
GET    /doctors?search&specialization&hospital&from&to&sort=createdAt|name|patientCount&order&page&limit
POST   /doctors                          GET|PATCH|DELETE /doctors/:id      (DELETE → 409 if the doctor has patients)
GET    /doctors/:id/patients?search&condition&status&from&to&sort&order&page&limit
POST   /doctors/:id/patients             DELETE /doctors/:id/patients/:patientId
GET    /patients?search&condition&status&gender&doctorId&from&to&sort=visitDate|createdAt|name|age&order&page&limit
GET|PATCH|DELETE /patients/:id           (PATCH may set `doctor` to reassign)
GET    /meta/filters
GET    /stats/overview?from&to           GET /stats/timeseries?from&to&interval=day|week|month
GET    /stats/conditions?from&to         GET /stats/patients-per-doctor?limit   GET /stats/specializations
```

Success responses use `{ success: true, data, meta? }`. Errors use `{ success: false, error: { code, message, details?[] } }`. Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_EMAIL`, `DOCTOR_HAS_PATIENTS`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## Testing

| Suite           | Scope                                                                                                                                                                            | Count |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `src/shared`    | Zod schemas (coercion, defaults, refinements), timeseries bucketing and gap fill                                                                                                 | 42    |
| Unit            | Utils, env parsing, `validate` / `requireAuth` / error-handler middleware, filter builders                                                                                       | 46    |
| Service + route | Services against an **in-memory MongoDB replica set** (transactions, counters, search, aggregations) and Supertest route tests (2xx/400/401/404/409, envelopes, pagination meta) | 68    |
| Query plans     | `explain()` regression tests: every list query uses an index, with no in-memory sort                                                                                             | 14    |

Line coverage is about 98% (`npm run test:coverage`). UI and end-to-end tests live in the [frontend repo](https://github.com/rejwanul313/DoctorTracker-frontend#testing).

---

## Project structure

```
src/modules/       <feature>/{routes, controller, service, schema} for auth, doctors, patients, stats, meta
src/models/        Mongoose models with their indexes (user, doctor, patient)
src/middleware/    validate (Zod), requireAuth/requireRole, rate limits, error handler
src/utils/         ApiError, pagination, query helpers (search, date ranges, update operators)
src/db/            connection + withTransaction helper
src/config/        env (validated with Zod), logger (pino)
src/shared/        Zod schemas, constants, DTO types (same as the frontend's copy)
src/tests/         global in-memory replica set, route tests, index/query-plan tests
src/scripts/       seed.ts
render.yaml        Render Blueprint · docker-compose.yml: local MongoDB replica set
```

---

## Scalability notes & known limitations

- **Pagination** is offset-based, which is ideal for numbered pages. Very deep pages would benefit from cursor pagination on `(sortField, _id)`, and the indexes already support it.
- **Search** matches whole words or phrases plus prefixes ("ali" finds "Alice"). Infix matches ("lic") would need Atlas Search with n-gram/autocomplete.
- **Stats** are live aggregations with a 60 s client cache. At large scale, precomputed daily rollups or a server-side cache (Redis) would take over.
- **Rate limiting** uses an in-memory store. Running multiple API instances needs a shared store (Redis).
- **Shared schemas** are copied in both repos. A published npm package (or returning to a monorepo) would remove the duplication.
- **Dependency advisory:** `npm audit` reports a Zod 3 advisory about oversized constrained arrays. The API has no array inputs and caps request bodies at 100 kB, and the fix requires Zod 4.
