# Doctor Tracker: Project Plan

> **Repo split (2026-11-20):** this plan was written for a single monorepo (`client/`, `server/`, `packages/shared/`). The code now lives in two repos: frontend https://github.com/rejwanul313/DoctorTracker-frontend and backend https://github.com/rejwanul313/DoctorTracker-backend, each with its own copy of the shared schemas in `src/shared/`. Paths below refer to the original layout.

> **Status (2026-11-18):** P0–P9 complete; P10 done except deployment. 42 shared + 128 server + 105 client unit/integration tests, 3 Playwright E2E tests, all green. See §14 for decisions made during implementation.

> This file is the source of truth for scope, architecture and roadmap. Update it whenever a decision changes. Tick roadmap items as phases finish.

---

## 0. Summary

Doctor Tracker is a secure admin web app for managing doctors and their patients. It has fast search, filtering and pagination, plus an analytics dashboard. It runs as two services: a **Next.js client** and a **standalone Express REST API** backed by **MongoDB**.

**Key decisions (confirmed):**

| Area           | Decision                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Topology       | Separate `client/` (Next.js) and `server/` (Express) in an npm-workspaces monorepo, plus `packages/shared` |
| UI             | Tailwind CSS + shadcn/ui, lucide icons, sonner toasts, light/dark theme                                    |
| Data fetching  | TanStack Query v5. Filters live in URL search params                                                       |
| Local UI state | Zustand (sidebar open, theme, and similar). No Redux                                                       |
| Forms          | React Hook Form + Zod (shared schemas)                                                                     |
| Charts         | Recharts                                                                                                   |
| Auth           | Auth.js (NextAuth v5) Credentials provider, with an Express-issued JWT used as a Bearer token              |

---

## 1. Spec Traceability

Every requirement from the spec is listed here with where it is implemented. Update the **Status** column as work lands.

| Spec § | Requirement                                                                                            | Implementation                                                                        | Phase  | Status           |
| ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------ | ---------------- |
| 2.1    | Only authenticated users access the portal                                                             | `client/src/middleware.ts` (Auth.js) + Express `requireAuth`                          | P1, P5 | ✅               |
| 2.1    | Secure login                                                                                           | Auth.js Credentials → `POST /auth/login`, bcrypt, rate-limit, httpOnly session cookie | P1, P5 | ✅               |
| 2.1    | Protect all routes (authn + authz)                                                                     | `requireAuth` + `requireRole('admin')` on all `/api/v1/*`                             | P1     | ✅               |
| 2.2    | Create doctor (name, specialization, hospital, phone, email)                                           | `POST /doctors` + `DoctorFormDialog`                                                  | P2, P6 | ✅               |
| 2.2    | View list of doctors                                                                                   | `GET /doctors` + `/doctors` page                                                      | P2, P6 | ✅               |
| 2.2    | Search doctors                                                                                         | `?search=` (text index) + `SearchInput`                                               | P2, P6 | ✅               |
| 2.2    | Filter doctors (date-wise + others)                                                                    | `?from&to&specialization&hospital` + filter bar                                       | P2, P6 | ✅               |
| 2.2    | Paginate doctors                                                                                       | `?page&limit` + `Pagination`                                                          | P2, P6 | ✅               |
| 2.2    | View patients for each doctor                                                                          | `GET /doctors/:id/patients` + `/doctors/[id]`                                         | P2, P6 | ✅               |
| 2.2    | Add patient under a doctor                                                                             | `POST /doctors/:id/patients` + `PatientFormDialog`                                    | P2, P6 | ✅               |
| 2.2    | Delete patient from doctor's list                                                                      | `DELETE /doctors/:id/patients/:patientId` + `ConfirmDialog`                           | P2, P6 | ✅               |
| 2.3    | Dedicated patient page: list all                                                                       | `GET /patients` + `/patients` page                                                    | P3, P7 | ✅               |
| 2.3    | Edit patient                                                                                           | `PATCH /patients/:id` + `PatientFormSheet`                                            | P3, P7 | ✅               |
| 2.3    | Delete patient                                                                                         | `DELETE /patients/:id`                                                                | P3, P7 | ✅               |
| 2.3    | Pagination / search / filter (date, condition, others)                                                 | `?page&limit&search&condition&gender&status&doctorId&from&to`                         | P3, P7 | ✅               |
| 3      | Total doctors, total patients                                                                          | `GET /stats/overview` → KPI cards                                                     | P4, P8 | ✅               |
| 3      | Patients per doctor                                                                                    | `GET /stats/patients-per-doctor` → bar chart                                          | P4, P8 | ✅               |
| 3      | Date-based statistics                                                                                  | `GET /stats/timeseries` → area chart                                                  | P4, P8 | ✅               |
| 3      | Charts / meaningful insights                                                                           | Recharts in `ChartCard`s + conditions donut + specialization bar                      | P8     | ✅               |
| 3      | Clean aggregation, optimized queries                                                                   | Aggregation pipelines, indexes, `$facet`, denormalized `patientCount`                 | P4     | ✅               |
| 4      | Modern, clean, responsive UI; smooth nav                                                               | shadcn/Tailwind, app shell, mobile drawer, skeletons, transitions                     | P5–P9  | ✅               |
| 4      | Clear nav: Dashboard / Doctors / Patients                                                              | `AppSidebar` + mobile `Sheet` nav, active state                                       | P5     | ✅               |
| 5      | Optimized search/filter/pagination queries                                                             | Compound + text indexes, `.lean()`, projections, parallel count                       | P2, P3 | ✅               |
| 5      | Proper MongoDB indexing                                                                                | Indexes declared in models (§4)                                                       | P1–P3  | ✅               |
| 5      | Avoid unnecessary re-renders                                                                           | Memoized columns/rows, URL state, `keepPreviousData`, dynamic charts                  | P6–P8  | ✅               |
| 5      | Clean folder structure, reusable components                                                            | §8 trees, `components/common`                                                         | all    | ✅               |
| 5      | API validation & error handling                                                                        | Zod `validate()`, `ApiError`, central error middleware                                | P1     | ✅               |
| 6      | Next.js client, Express server, MongoDB, REST                                                          | Topology above                                                                        | P0     | ✅               |
| 6      | Proper state management & data fetching                                                                | TanStack Query + URL params + Zustand (UI only)                                       | P5     | ✅               |
| README | Description, setup + `.env.example`, architecture, 2 technical decisions, desktop + mobile screenshots | `README.md` (§11)                                                                     | P10    | ✅               |
| Submit | Live link + repo + demo credentials                                                                    | Vercel + Render + Atlas (§3)                                                          | P10    | ☐ deploy pending |

---

## 2. System Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React UI (shadcn/Tailwind) · TanStack Query cache · URL state  │
└───────────────┬─────────────────────────────────┬───────────────┘
                │ page requests                   │ fetch /api/v1/*
                │ (session cookie)                │ Authorization: Bearer <JWT>
                ▼                                 │
┌───────────── Next.js (client/) ──────────┐      │
│ middleware.ts  → redirect if no session  │      │
│ Auth.js        → /api/auth/* (session)   │      │
│   authorize() ─────── POST /auth/login ──┼──┐   │
│ App Router pages (RSC shell + client UI) │  │   │
└──────────────────────────────────────────┘  │   │
                                              ▼   ▼
                         ┌──────────── Express (server/) ─────────────┐
                         │ helmet · cors(CLIENT_ORIGIN) · compression │
                         │ rate-limit(/auth/login) · pino logger      │
                         │ requireAuth (JWT verify) · validate(Zod)   │
                         │ routes → controllers → services            │
                         │ central error handler → envelope           │
                         └───────────────────┬────────────────────────┘
                                             │ Mongoose (lean, indexed)
                                             ▼
                                   ┌─────── MongoDB ───────┐
                                   │ users · doctors ·     │
                                   │ patients (indexes §4) │
                                   └───────────────────────┘
```

**Data flow for a typical list view (`/patients`):**

1. A URL like `?search=ali&condition=diabetes&page=2` is parsed by `useListParams`.
2. `usePatients(params)` builds a query key → `api-client` → `GET /api/v1/patients?...` with the Bearer token.
3. Express runs `requireAuth` → `validate(listPatientsQuerySchema)` → `patients.service.list()`.
4. The service builds the filter and runs `Promise.all([find().sort().skip().limit().lean(), countDocuments()])`. This uses the compound/text indexes.
5. The response comes back as `{ success, data, meta: { page, limit, total, totalPages } }` and is cached by TanStack Query. The previous page stays visible while the next one loads.

**Deployment:**

- Client → Vercel (`NEXT_PUBLIC_API_URL`, `AUTH_SECRET`, `AUTH_URL`).
- Server → Render or Railway (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`).
- Database → MongoDB Atlas (free tier, replica set, so transactions work).

---

## 3. Environment Variables

**`server/.env.example`**

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/doctor-tracker
JWT_SECRET=change-me-min-32-chars
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=http://localhost:3000
SEED_ADMIN_EMAIL=admin@doctortracker.dev
SEED_ADMIN_PASSWORD=Admin@123
```

**`client/.env.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_URL=http://localhost:3000
```

> Local transactions need a replica set. Use Atlas, or `mongod --replSet rs0` / a Docker single-node replica set. Document this in the README.

---

## 4. Data Model & Indexes

### User

| Field        | Type      | Notes                                               |
| ------------ | --------- | --------------------------------------------------- |
| name         | string    | required                                            |
| email        | string    | required, unique, lowercase                         |
| passwordHash | string    | `select: false`                                     |
| role         | `'admin'` | default `admin` (enum, so roles can be added later) |
| timestamps   |           |                                                     |

Index: `{ email: 1 }` unique.

### Doctor

| Field          | Type   | Notes                                                       |
| -------------- | ------ | ----------------------------------------------------------- |
| name           | string | required, 2–100                                             |
| specialization | string | required (from a curated list, e.g. Cardiology, Neurology…) |
| hospital       | string | required                                                    |
| phone          | string | required, validated format                                  |
| email          | string | required, unique, lowercase                                 |
| patientCount   | number | default 0, **denormalized**                                 |
| timestamps     |        | `createdAt` used for date filters                           |

Indexes:

- `{ email: 1 }` unique
- `{ createdAt: -1 }`: default sort, date range
- `{ specialization: 1, createdAt: -1 }`
- `{ hospital: 1, createdAt: -1 }`
- `{ patientCount: -1 }`: "most patients" sort and the top-N stat
- Text: `{ name: 'text', specialization: 'text', hospital: 'text', email: 'text' }` with weights (name 10, specialization 5, hospital 3, email 1)

### Patient

| Field      | Type                                    | Notes                                                                                      |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| name       | string                                  | required                                                                                   |
| age        | number                                  | 0–120                                                                                      |
| gender     | `'male' \| 'female' \| 'other'`         |                                                                                            |
| phone      | string                                  |                                                                                            |
| email      | string                                  | optional                                                                                   |
| condition  | enum                                    | e.g. `diabetes, hypertension, asthma, cardiac, orthopedic, neurological, infection, other` |
| status     | `'active' \| 'recovered' \| 'critical'` | default `active`                                                                           |
| doctor     | ObjectId → Doctor                       | required                                                                                   |
| visitDate  | Date                                    | required (date-based stats and filters)                                                    |
| notes      | string                                  | optional, max 1000                                                                         |
| timestamps |                                         |                                                                                            |

Indexes:

- `{ doctor: 1, createdAt: -1 }`: a doctor's patient list
- `{ condition: 1, visitDate: -1 }`
- `{ status: 1, visitDate: -1 }`
- `{ visitDate: -1 }`: date filter, timeseries
- `{ createdAt: -1 }`
- Text: `{ name: 'text', email: 'text', phone: 'text' }`

### Consistency rules

- **Creating** a patient → in the same transaction, `$inc: { patientCount: 1 }` on the doctor.
- **Deleting** a patient → `$inc: -1`.
- **Moving** a patient (changing `doctor` in a PATCH) → `-1` on the old doctor and `+1` on the new one.
- **Deleting a doctor** → blocked with `409 DOCTOR_HAS_PATIENTS` while `patientCount > 0`. This is the safer choice for medical data; see the decision in §10.

### Search strategy

- Searches of 3 characters or more use `$text`, sorted by `textScore` when search is the main criterion.
- Shorter searches fall back to an anchored, case-insensitive prefix regex on `name` (`^term`). This can use an index if a collation index is added. Keep that path limited to the prefix case.
- Possible upgrade: Atlas Search (§12).

---

## 5. REST API (`/api/v1`)

All routes except `/auth/login` and `/health` require `Authorization: Bearer <JWT>`.

### Envelope

```json
{ "success": true,  "data": {}, "meta": { "page": 1, "limit": 10, "total": 134, "totalPages": 14 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path": "email", "message": "Invalid email" }] } }
```

Error codes: `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` / `DUPLICATE_EMAIL` / `DOCTOR_HAS_PATIENTS` 409 · `RATE_LIMITED` 429 · `INTERNAL_ERROR` 500.

### Endpoints

| Method | Path                               | Query / Body                                                                                                        | Notes                                                                  |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/health`                          |                                                                                                                     | liveness check                                                         |
| POST   | `/auth/login`                      | `{ email, password }`                                                                                               | rate-limited (5/min/IP); returns `{ user, accessToken }`               |
| GET    | `/auth/me`                         |                                                                                                                     | current user                                                           |
| GET    | `/doctors`                         | `search, specialization, hospital, from, to, sort (createdAt\|name\|patientCount), order, page, limit`              | paginated                                                              |
| POST   | `/doctors`                         | doctor body                                                                                                         | 409 on duplicate email                                                 |
| GET    | `/doctors/:id`                     |                                                                                                                     | includes `patientCount`                                                |
| PATCH  | `/doctors/:id`                     | partial doctor                                                                                                      |                                                                        |
| DELETE | `/doctors/:id`                     |                                                                                                                     | 409 if it has patients                                                 |
| GET    | `/doctors/:id/patients`            | `search, condition, status, page, limit`                                                                            | uses `{doctor, createdAt}` index                                       |
| POST   | `/doctors/:id/patients`            | patient body (no `doctor`)                                                                                          | transaction + `$inc`                                                   |
| DELETE | `/doctors/:id/patients/:patientId` |                                                                                                                     | checks the patient belongs to this doctor                              |
| GET    | `/patients`                        | `search, condition, status, gender, doctorId, from, to, sort (visitDate\|createdAt\|name\|age), order, page, limit` | populates `doctor` name only (projection)                              |
| GET    | `/patients/:id`                    |                                                                                                                     |                                                                        |
| PATCH  | `/patients/:id`                    | partial patient (may change `doctor`)                                                                               | handles count transfer                                                 |
| DELETE | `/patients/:id`                    |                                                                                                                     | transaction + `$inc`                                                   |
| GET    | `/meta/filters`                    |                                                                                                                     | `{ specializations, hospitals, conditions }` via `distinct`; cache 60s |
| GET    | `/stats/overview`                  |                                                                                                                     | KPI numbers                                                            |
| GET    | `/stats/patients-per-doctor`       | `limit=10`                                                                                                          | top-N                                                                  |
| GET    | `/stats/timeseries`                | `from, to, interval=day\|week\|month`                                                                               | registrations + visits                                                 |
| GET    | `/stats/conditions`                | `from, to`                                                                                                          | condition distribution                                                 |
| GET    | `/stats/specializations`           |                                                                                                                     | doctors per specialization                                             |

**Validation:** `:id` must be a valid ObjectId (Zod refine). `limit` must be ≤ 100. `from` must be ≤ `to`. Unknown query keys are stripped.

---

## 6. Dashboard Spec

**Layout (desktop):**

- Row 1: 4 KPI cards.
- Row 2: timeseries (2/3 width) + conditions donut (1/3).
- Row 3: patients-per-doctor bar (1/2) + specializations bar (1/2).
- On mobile everything stacks in one column.
- A global date-range picker (presets: 7d / 30d / 90d / 12m) sits in the header and is stored in the URL.

| Widget                                                                         | Endpoint                     | Aggregation sketch                                                                                                                       | Index used             |
| ------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| KPI: Total doctors / patients / new patients (range) / avg patients per doctor | `/stats/overview`            | `estimatedDocumentCount()` ×2 + `countDocuments({createdAt in range})`; avg = patients / doctors                                         | `createdAt`            |
| Area: registrations over time                                                  | `/stats/timeseries`          | `$match visitDate range → $group { $dateTrunc: { date: '$visitDate', unit } , count } → $sort`; client fills gaps with zeros             | `visitDate`            |
| Donut: patients by condition                                                   | `/stats/conditions`          | `$match range → $group condition → $sort count desc`                                                                                     | `condition, visitDate` |
| Bar: top N patients per doctor                                                 | `/stats/patients-per-doctor` | `Doctor.find().sort({patientCount:-1}).limit(N).select('name specialization patientCount')`, with no `$lookup` thanks to denormalization | `patientCount`         |
| Bar: doctors by specialization                                                 | `/stats/specializations`     | `$group specialization → count`                                                                                                          | `specialization`       |

Optional: combine the overview queries into a single `$facet` call. Cache stats responses for 60 s on the client (`staleTime`), and invalidate them after mutations.

---

## 7. Frontend Page Map & UX

| Route                | Contents                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`             | Centered card, email/password (RHF + Zod), inline errors, loading button, demo-credentials hint                                                                                                                                          |
| `/dashboard`         | §6                                                                                                                                                                                                                                       |
| `/doctors`           | `PageHeader` (title + "Add doctor"), filter bar (search, specialization, hospital, date range, reset), `DataTable` (name, specialization, hospital, contact, patients badge, created), row click → detail, pagination + page-size select |
| `/doctors/[id]`      | Doctor profile card + stats, patients table scoped to the doctor (search, condition filter), "Add patient" dialog, delete patient with confirm                                                                                           |
| `/patients`          | Filter bar (search, condition, status, gender, doctor combobox, date range), `DataTable` (name, age/gender, condition badge, status badge, doctor link, visit date, actions), edit `Sheet`, delete `ConfirmDialog`                       |
| `not-found`, `error` | Friendly fallbacks with a link back                                                                                                                                                                                                      |

**App shell:** collapsible left sidebar (Dashboard, Doctors, Patients) with active highlight. Topbar has breadcrumbs, theme toggle, and a user menu with sign-out. Below `md` the sidebar becomes a `Sheet` drawer.

**UX checklist:**

- Skeleton loaders that match the final layout.
- Empty states with a CTA.
- Error states with retry.
- Toasts for every mutation.
- Confirmation before deletes.
- Disabled/loading submit buttons.
- Keyboard-accessible dialogs.
- Focus returns to the trigger after a dialog closes.
- Visible focus rings.
- AA color contrast.
- Tables become stacked cards below `md`.
- Sticky table header.
- Filter state survives refresh and back/forward navigation.

---

## 8. Folder Structure

```
doctor-tracker/
├─ package.json                # workspaces + root scripts
├─ README.md
├─ CLAUDE.md
├─ docs/PLAN.md
├─ .claude/skills/{feature-scaffold,api-endpoint,ui-component}/SKILL.md
├─ packages/shared/src/
│  ├─ schemas/{auth,doctor,patient,query,stats}.ts   # Zod
│  ├─ constants/{conditions,specializations}.ts
│  └─ index.ts
├─ server/
│  ├─ .env.example
│  └─ src/
│     ├─ app.ts                # express app (no listen) for tests
│     ├─ server.ts             # connect DB + listen
│     ├─ config/env.ts         # Zod-validated env
│     ├─ db/connect.ts
│     ├─ middleware/{require-auth,require-role,validate,error-handler,not-found,rate-limit}.ts
│     ├─ utils/{api-error,pagination,escape-regex,date-range}.ts
│     ├─ models/{user,doctor,patient}.model.ts
│     ├─ modules/
│     │  ├─ auth/{auth.routes,auth.controller,auth.service}.ts
│     │  ├─ doctors/{doctors.routes,doctors.controller,doctors.service}.ts
│     │  ├─ patients/{…}.ts
│     │  ├─ meta/{…}.ts
│     │  └─ stats/{…}.ts
│     ├─ routes/index.ts       # mounts /api/v1
│     ├─ scripts/seed.ts
│     └─ tests/{doctors,patients,auth,stats}.test.ts
└─ client/
   ├─ .env.example
   └─ src/
      ├─ auth.ts               # Auth.js config
      ├─ middleware.ts         # route guard
      ├─ app/
      │  ├─ layout.tsx · providers.tsx
      │  ├─ (auth)/login/page.tsx
      │  ├─ (portal)/layout.tsx          # app shell
      │  ├─ (portal)/dashboard/page.tsx
      │  ├─ (portal)/doctors/page.tsx
      │  ├─ (portal)/doctors/[id]/page.tsx
      │  ├─ (portal)/patients/page.tsx
      │  └─ api/auth/[...nextauth]/route.ts
      ├─ components/
      │  ├─ ui/                # shadcn (generated, don't edit)
      │  ├─ layout/{app-sidebar,topbar,mobile-nav,user-menu,theme-toggle}.tsx
      │  └─ common/{data-table,pagination,search-input,date-range-filter,filter-select,
      │             confirm-dialog,empty-state,error-state,page-header,stat-card,chart-card,status-badge}.tsx
      ├─ features/
      │  ├─ doctors/{api.ts,hooks.ts,columns.tsx,components/…}
      │  ├─ patients/{…}
      │  └─ dashboard/{api.ts,hooks.ts,components/{kpi-grid,timeseries-chart,conditions-chart,…}}
      ├─ hooks/{use-list-params,use-debounce}.ts
      ├─ lib/{api-client,query-keys,query-client,utils,format}.ts
      └─ stores/ui-store.ts    # Zustand: sidebar, etc.
```

---

## 9. Roadmap

Each phase ends with: `lint` + `typecheck` + `test` green, traceability rows updated, and a commit.

- [x] **P0 · Repo setup**: workspaces, TS configs, ESLint + Prettier, `concurrently` dev script, `.env.example` ×2, `.gitignore`, shared package wiring (`transpilePackages` in Next).
      _Done when:_ `npm run dev` boots both empty apps.
- [x] **P1 · Server foundation**: env validation, DB connect, app middleware stack, `ApiError`/error handler/`validate`, User model, auth module (login, me), `requireAuth`, login rate-limit, `/health`, seed script (1 admin, ~50 doctors, ~2,000 patients spread over 12 months via faker, `patientCount` computed).
      _Done when:_ you can log in with curl and protected routes return 401 without a token.
- [x] **P2 · Doctors API**: model + indexes, CRUD, list with search/filter/sort/pagination, nested patients endpoints with transactions, `/meta/filters`. Supertest coverage.
      _Done when:_ `explain()` shows IXSCAN for the main list queries.
- [x] **P3 · Patients API**: model + indexes, list/get/patch/delete, doctor transfer logic. Tests.
- [x] **P4 · Stats API**: overview, timeseries, conditions, patients-per-doctor, specializations. Tests on seeded data.
- [x] **P5 · Client foundation**: Next + Tailwind + shadcn init, theme, Auth.js config + login page, `middleware.ts`, app shell (sidebar/topbar/mobile nav), `api-client` (Bearer + 401 handling), QueryClient provider, `query-keys`, `useListParams`, common components.
- [x] **P6 · Doctors UI**: list page, filters, create dialog, detail page with patients, add/remove patient.
- [x] **P7 · Patients UI**: list page, filters, edit sheet, delete confirm.
- [x] **P8 · Dashboard**: KPI grid, 4 charts, date-range presets.
- [x] **P9 · Polish**: responsive pass at 375/768/1280, a11y pass, dark mode, skeletons, page transitions, Lighthouse ≥ 90 on performance and accessibility _(Lighthouse not yet measured)_.
- [ ] **P10 · Ship** _(done: Playwright smoke test, README, screenshots; remaining: deploy + live link)_: Playwright smoke test (login → create doctor → add patient → see it on the dashboard), README, screenshots (desktop + mobile) in `docs/screenshots/`, deploy to Vercel/Render/Atlas, demo credentials.

---

## 10. Technical Decisions (for the README)

### D1: Auth.js session in Next.js + Express-issued Bearer JWT

- **Context:** The spec requires a separate Next.js client and Express server. These are often deployed on different domains (Vercel + Render), where third-party cookies are unreliable.
- **Decision:**
  - Express owns credential checking and issues a short-lived JWT.
  - Auth.js stores that token inside its own encrypted, httpOnly, first-party session cookie and handles route protection in Next.js middleware.
  - Calls to the API send the token as a Bearer header.
- **Why:**
  - No cross-site cookies or CORS credentials are needed.
  - The API stays stateless and can be used by any client.
  - Auth.js provides hardened session handling, CSRF protection on its endpoints, and `auth()` helpers for server components.
- **Trade-offs:** Two secrets to manage. Token expiry must be kept in step with the session (handled in the `jwt` callback). Revoking a token before it expires needs a denylist, which is out of scope.

### D2: TanStack Query + URL search params instead of Redux

- **Context:** Almost all state in this app is server state (lists, details, stats) plus filter parameters.
- **Decision:**
  - TanStack Query handles caching, deduplication, background refresh, and invalidation after mutations.
  - URL search params hold filters, search, page and sort.
  - Zustand holds only the small amount of UI state (sidebar).
- **Why:**
  - Less boilerplate than Redux/RTK.
  - Built-in `keepPreviousData` and stale-while-revalidate behavior.
  - Shareable, bookmarkable views.
  - Components subscribe only to the query they use, which means fewer re-renders.
- **Trade-offs:** URL parsing needs one well-tested hook (`useListParams`). Global client state is intentionally minimal.

### Spare D3: Denormalized `patientCount` on Doctor

- **Why:** Doctor lists and the "patients per doctor" chart would otherwise need a `$lookup`/`$group` over the whole patients collection on every request. With the counter, those queries are O(page size) and the top-N stat is an index-backed sort.
- **Cost:** Writes must keep the counter in sync. They do this with `$inc` inside a transaction. A `recount` script provides a way to repair drift.

---

## 11. README Checklist (P10)

- [x] **Description:** one-paragraph elevator pitch.
- [ ] **Live demo** link + **demo credentials**.
- [x] **Setup guide:** prerequisites (Node 20+, MongoDB replica set or Atlas), clone, `npm install`, copy both `.env.example` files, `npm run seed`, `npm run dev`.
- [x] **System architecture:** the §2 diagram + data-flow paragraph.
- [x] **Technical decisions:** D1 + D2 (from §10).
- [x] **Visual evidence:** desktop + mobile screenshots of login, dashboard, doctors, doctor detail, and patients.
- [x] Features list, API summary table, folder structure, scripts, testing, and future improvements.

---

## 12. Scalability Notes & Risks

| Topic             | Now                                   | Path to scale                                                         |
| ----------------- | ------------------------------------- | --------------------------------------------------------------------- |
| Pagination        | Offset (`skip/limit`)                 | Cursor pagination on `(createdAt, _id)` for deep pages                |
| Search            | `$text` + prefix fallback             | Atlas Search (fuzzy, autocomplete)                                    |
| Stats             | Live aggregations + 60 s client cache | Server-side cache (Redis) or pre-computed daily rollups               |
| Auth              | Single admin role                     | Role/permission model already enum-based; add `requireRole` per route |
| Rate limiting     | In-memory on login                    | Redis store when running multiple instances                           |
| Counter drift     | Transactions                          | `recount` maintenance script                                          |
| Deleting a doctor | Blocked while it has patients         | Optional reassign-then-delete flow                                    |

---

## 13. Testing Strategy

Vitest is the single test runner in every workspace. `npm test` at the root runs them all.

### Backend (`server/`)

| Layer               | What                                                                                                                                                                                                     | Tools                                                   | Location                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| Unit: pure utils    | `ApiError`, pagination math, `buildDoctorFilter` / `buildPatientFilter`, sort whitelist, regex escaping, date-range helpers, env parsing                                                                 | Vitest                                                  | `src/**/*.test.ts` (co-located) |
| Unit: middleware    | `validate()` (accepts / rejects / strips), `requireAuth` (missing / invalid / expired / valid token), error handler mapping (ZodError, CastError, 11000, ApiError, unknown)                              | Vitest + mock req/res                                   | co-located                      |
| Unit: services      | Doctor/patient services against an in-memory DB: `patientCount` stays consistent on create, delete and move; delete is blocked when a doctor has patients; stats aggregations return the expected shapes | Vitest + `mongodb-memory-server` (`MongoMemoryReplSet`) | co-located                      |
| Route / integration | Every endpoint: 2xx happy path, 400 validation, 401 without token, 404, 409, pagination `meta`                                                                                                           | Supertest against `createApp()`                         | `src/tests/*.test.ts`           |

### Frontend (`client/`)

| Layer               | What                                                                                                                                                                                                                   | Tools                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Unit: utils         | `format.ts`, `query-keys.ts`, `api-client` (envelope unwrap, Bearer header, error → `ApiClientError`, 401 handling), timeseries gap fill                                                                               | Vitest                                     |
| Unit: hooks         | `useDebounce` (fake timers), `useListParams` (parse, set, reset page, defaults) with `next/navigation` mocked                                                                                                          | Vitest + `renderHook`                      |
| Unit: components    | `SearchInput` (debounce + clear), `Pagination` (disabled states, page change), `EmptyState`, `ErrorState` (retry), `ConfirmDialog` (confirm / cancel), `DataTable` (loading / empty / rows), `StatCard`, `StatusBadge` | React Testing Library + user-event + jsdom |
| Unit: forms         | `DoctorForm` / `PatientForm`: required-field errors, invalid email, submits parsed values                                                                                                                              | RTL + user-event                           |
| E2E (P10, optional) | Login → create doctor → add patient → dashboard updates                                                                                                                                                                | Playwright                                 |

**Coverage target:** ≥ 80% lines for `server/src/{utils,middleware,modules}` and `client/src/{lib,hooks,components/common}`. Report with `vitest --coverage` (v8).

---

**Risks:**

- Local MongoDB without a replica set breaks transactions. Mitigation: documented in setup, plus a Docker compose option.
- Free-tier cold starts on Render. Mitigation: mention it in the README and add a `/health` warm-up.

---

## 14. Implementation Notes (decisions made while building)

These refine or override earlier sections; the code is authoritative.

- **Express 5**: async errors reach the error handler natively (no `asyncHandler`). `validate()` writes parsed input to `res.locals.{body,query,params}` because `req.query` is read-only.
- **Indexes end with `_id`**: list sorts are `{ field, _id }` for stable pagination. `explain()` on seeded data showed an index on `{createdAt:-1}` alone still forced an in-memory SORT, so every sort index is now `{ …, field, _id }`. Guarded by `server/src/tests/indexes.test.ts`. The doctor's patient-list index is `{ doctor, visitDate, _id }` (default sort is `visitDate`, not `createdAt`).
- **Search = `$text` phrase OR anchored prefix regex.** Plain `$text` ORs words ("alice smith" matched every Alice); a quoted phrase requires the whole phrase. Prefix regexes on indexed `name`/`email` give type-ahead behavior.
- **"Dr." is display-only**: the shared doctor schema strips a leading "Dr." so names sort/search naturally; the UI renders `formatDoctorName()`.
- **Clearing optional fields**: PATCH bodies send `''` for cleared optional fields; Zod maps it to `undefined` and the service turns those keys into `$unset` (`toUpdateOperators`).
- **Timeseries gaps** are filled server-side with the shared `fillTimeseries()` (also unit-tested in `packages/shared`), so charts get one point per bucket.
- **Dates**: patient `visitDate` is a calendar date stored as UTC midnight; the UI formats it in UTC (`formatCalendarDate`) to avoid off-by-one days.
- **Dependency choices**: Zod 3.25, Next 15.5, Recharts 3, react-day-picker 9, Playwright 1.65. Open follow-ups: Zod 4 and Next 16 upgrades (clear `npm audit` advisories; see README).
