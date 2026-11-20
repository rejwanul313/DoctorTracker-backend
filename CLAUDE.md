# Doctor Tracker · Backend

Standalone Express REST API (`/api/v1`) for Doctor Tracker, an admin portal for doctors, patients and analytics. The Next.js frontend lives in a separate repo (https://github.com/rejwanul313/DoctorTracker-frontend) and talks to this API **only over REST** with a Bearer JWT. **Scope, data model, API and roadmap: [docs/PLAN.md](docs/PLAN.md).**

## Repo layout

```
src/modules/<feature>/   routes, controller, service, schema
src/models/              Mongoose models + indexes
src/middleware/          validate, requireAuth/requireRole, rate limit, error handler
src/shared/              Zod schemas + constants + DTO types, imported as `@doctor-tracker/shared`
src/tests/               route + query-plan tests (in-memory MongoDB replica set)
docs/PLAN.md             Project plan, phases, traceability
.claude/skills/          Project skills (see below)
```

**`src/shared/` is duplicated in the frontend repo.** When you change a schema, constant or DTO type, make the identical change there too, or validation drifts between client and API.

## Commands

| Command                                           | Purpose                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `npm install`                                     | Install dependencies                                             |
| `npm run dev`                                     | API with hot reload on :5000                                     |
| `npm run build` / `npm start`                     | tsup bundle → `dist/`, run it                                    |
| `npm run db:up` / `npm run db:down`               | Start/stop local MongoDB replica set (Docker)                    |
| `npm run seed`                                    | Seed admin user + demo doctors/patients (wipes doctors/patients) |
| `npm run lint` / `npm run typecheck` / `npm test` | Quality gates; run all three before declaring a task done        |

Env: `.env.example` → `.env`. Never commit real `.env*` files. Node comes from nvm (`.nvmrc` = 22). Tests download a MongoDB binary on first run (mongodb-memory-server). Deploy: Render via `render.yaml`.

## Tech stack (locked; ask before adding libraries)

- **Client:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query v5, Zustand (UI-only state), React Hook Form + Zod, Recharts, Auth.js (NextAuth v5), lucide-react, sonner (toasts).
- **Server:** Node.js, Express, TypeScript, Mongoose, Zod, jsonwebtoken, bcrypt, helmet, cors, express-rate-limit, compression, pino.
- **DB:** MongoDB (Atlas in production).
- **Tests:** Vitest everywhere.
  - **Server:** unit tests for utils, filter builders and services, plus Supertest route tests against `mongodb-memory-server` (replica set).
  - **Client:** unit tests with React Testing Library + jsdom + user-event for hooks, utils, common components and forms.
  - See the testing strategy in `docs/PLAN.md` §13.

## Testing rules

- Every new util, service, hook or common component ships with a co-located test (`*.test.ts(x)` next to the file, or in `src/tests/` for route tests).
- Test behavior, not implementation. On the client, query by role or label, not by class name.
- Mock at the boundary: on the client, mock `fetch`/`api-client` and `next/navigation`. On the server, use the in-memory MongoDB instead of mocking Mongoose.
- A task isn't done until `npm test` is green.

## Auth model

1. The `/login` form calls Auth.js Credentials `authorize()`, which calls Express `POST /api/v1/auth/login`.
2. Express checks the bcrypt hash and returns `{ user, accessToken }`. The token is a JWT signed with `JWT_SECRET` and has a short expiry.
3. Auth.js stores `accessToken` in its encrypted JWT session cookie, using the `jwt`/`session` callbacks.
4. The client API wrapper (`client/src/lib/api-client.ts`) attaches `Authorization: Bearer <accessToken>` to every request.
5. Express `requireAuth` middleware verifies the token on **every** route except `/auth/login` and `/health`.
6. `client/src/middleware.ts` redirects unauthenticated users to `/login` for every route except `/login` and `/api/auth/*`.
7. A 401 from the API signs the user out and redirects to `/login`.

## Backend rules

- **Organize by feature module:** `src/modules/<feature>/{<feature>.routes,.controller,.service,.schema}.ts`. Controllers stay thin. Business logic and queries go in services.
- **Validate every input** (body, query, params) with Zod through the `validate()` middleware. Reuse schemas from `src/shared`.
- **Errors:** throw `ApiError(status, code, message)`. Express 5 forwards rejected async handlers automatically, so no `asyncHandler` wrapper is needed. Only the central error middleware formats responses.
- **Validated input:** the `validate()` middleware writes parsed data to `res.locals.body/query/params`. In Express 5, `req.query` is read-only.
- **Response envelope:** `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? } }`.
- **Read queries:** use `.lean()` plus an explicit projection. Never return `passwordHash`.
- **List queries:** use `Promise.all([find().sort().skip().limit(), countDocuments()])`. Default `limit` is 10 and the maximum is 100. Sort fields come from a whitelist.
- **Indexes:** every field used in filters or sorts must have an index declared in the model. Verify with `explain()` that the query plan uses IXSCAN.
- **Doctor.patientCount:** this count is denormalized. Update it with `$inc` inside the same transaction whenever a patient is created, deleted, or moved to another doctor.
- **Dashboard stats:** compute them with aggregation pipelines in `modules/stats`. Never compute them in JS over full collections.

## Naming & style

- kebab-case filenames. PascalCase components. Hooks start with `use`. Zod schemas are named `<thing>Schema`, with types from `z.infer`.
- No `any`. Prefer `unknown` plus narrowing. Use absolute imports via `@/`.
- Write small, focused components. Extract anything reused twice into `components/common`.

## Skills

Use these when the task matches:

- `/api-endpoint`: add or change an Express endpoint, list query, or aggregation.
- `/feature-scaffold`: add a whole new resource (schema → model → API); the UI half happens in the frontend repo.

## Don'ts

- Don't add Redux or other global data stores.
- Don't run unindexed `$regex` scans or `$where`.
- Don't use `$lookup` on list endpoints when a denormalized field exists.
- Don't hardcode API URLs. Use `NEXT_PUBLIC_API_URL`.
- Don't commit secrets or `.env` files.
- Don't skip validation on "internal" routes.
- When you finish a phase, tick it in the roadmap in `docs/PLAN.md`.
