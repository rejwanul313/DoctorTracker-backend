---
name: feature-scaffold
description: End-to-end recipe for adding a new resource or feature to Doctor Tracker across shared schema, Mongoose model, Express API, client data hooks and UI pages. Use when asked to "add a new resource", "scaffold a feature", "build the doctors/patients module", "create CRUD for X", or when starting a roadmap phase that spans both server and client.
---

> **Two repos:** `server/…` paths below mean the backend repo (DoctorTracker-backend) and `client/…` paths mean the frontend repo (DoctorTracker-frontend). Both have an identical `src/shared/`; change it in both.

# Feature Scaffold

Builds a feature in vertical slices, from the shared schema through the API to the UI. It applies the conventions in `CLAUDE.md` and the data model in `docs/PLAN.md`.

## When to use

- A new resource or entity (for example Doctors, Patients, Appointments).
- A roadmap phase that touches `src/shared`, `server/` and `client/` together.
- Not for a single endpoint (use `/api-endpoint`) or a single component (use `/ui-component`).

## Before you start

1. Read the resource's section in `docs/PLAN.md`: §4 data model, §5 endpoints, §7 page map.
2. Write down the fields, which fields are filterable or sortable, the search fields, and any relationships or denormalized counters.
3. If the plan doesn't cover something, update `docs/PLAN.md` first, then build.

## Steps

### 1. Shared contract: `src/shared/src/schemas/<feature>.ts`

- [ ] `create<Feature>Schema`: required fields, trimmed strings, lowercased emails, enums from `constants/`.
- [ ] `update<Feature>Schema` = `create…Schema.partial()`.
- [ ] `list<Feature>QuerySchema`: `page` (default 1), `limit` (default 10, max 100), `search`, every filter, `from`/`to` (coerced dates with `from <= to`), `sort` (enum whitelist), `order` (`asc|desc`).
- [ ] Export the inferred types (`z.infer`) and re-export them from `index.ts`.

### 2. Model: `src/models/<feature>.model.ts`

- [ ] Mongoose schema with `timestamps: true` and validators that mirror the Zod rules.
- [ ] **Indexes for every filter and sort combination** in the list query schema. Use compound indexes with equality fields first, then the sort field.
- [ ] A text index on the search fields, with weights.
- [ ] Sensitive fields use `select: false`.
- [ ] Relationships use refs, and are indexed.

### 3. API: follow `/api-endpoint` for each route

- [ ] `src/modules/<feature>/{<feature>.routes,.controller,.service}.ts`
- [ ] Mount the router in `src/routes/index.ts` behind `requireAuth`.
- [ ] Any write that touches a denormalized counter uses a transaction.
- [ ] Supertest cases: happy path, validation error, 401, 404, and pagination meta.

### 4. Seed: `src/scripts/seed.ts`

- [ ] Add realistic faker data, spread over the last 12 months, so the filters and charts have something to show.

### 5. Client data layer: `client/src/features/<feature>/`

- [ ] `api.ts`: typed functions that call `api-client` and return the `data`/`meta` from the envelope.
- [ ] Add to `client/src/lib/query-keys.ts`: `<feature>.all`, `.lists()`, `.list(params)`, `.detail(id)`.
- [ ] `hooks.ts`:
  - `use<Feature>s(params)` with `placeholderData: keepPreviousData`.
  - `use<Feature>(id)`.
  - `useCreate…`, `useUpdate…`, `useDelete…`. Each one invalidates the list keys, the detail key and `stats`. Delete is optimistic.

### 6. UI: follow `/ui-component`

- [ ] `columns.tsx`, defined at module level.
- [ ] A filter bar connected to `useListParams`.
- [ ] Form dialog or sheet (React Hook Form + the shared schema).
- [ ] Page in `client/src/app/(portal)/<feature>/page.tsx`, built from `PageHeader`, the filter bar, `DataTable` and `Pagination`.
- [ ] Loading, empty and error states, plus a mobile card layout.

### 7. Wire-up

- [ ] Add a nav entry in `components/layout/app-sidebar.tsx` and in the mobile nav (lucide icon, active state).
- [ ] If the feature feeds the dashboard, add a stats endpoint and widget.

### 8. Close out

- [ ] `npm run lint && npm run typecheck && npm run test` all pass.
- [ ] Manually check: create, search, filter, paginate, edit, delete. Check desktop and 375px mobile.
- [ ] Update the **Status** column in the `docs/PLAN.md` §1 traceability table and tick the roadmap phase.

## Done criteria

- All CRUD paths work through the UI. Filters survive a refresh. No console errors.
- `explain()` shows IXSCAN for the default list query and for each filter.
- No `any`, no duplicated schemas, and no fetching inside `useEffect`.
