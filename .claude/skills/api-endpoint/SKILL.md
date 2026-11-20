---
name: api-endpoint
description: Conventions for adding or changing an Express REST endpoint in Doctor Tracker's backend API — routing, Zod validation, service-layer queries, paginated list/search/filter patterns, aggregations, MongoDB indexing, error envelope and Supertest tests. Use when asked to "add an endpoint", "add a filter/sort/search param", "write an aggregation/stats route", "fix an API error", or "optimize a query".
---

# API Endpoint

These are the backend conventions for this repo. They apply to every route under `/api/v1`.

## Request pipeline

```
router → requireAuth → [requireRole] → validate({ body?, query?, params? }) → controller (async; Express 5 forwards errors) → service → Mongoose
                                                                                   ↓ throw ApiError
                                                                          central error-handler → envelope
```

## Steps

1. **Contract:** add or extend the Zod schema in `src/shared/src/schemas/`. Validate `:id` params with an ObjectId refine. Use coerced numbers and dates for query strings, and strip unknown keys.
2. **Route:** add it in `modules/<feature>/<feature>.routes.ts`. Use REST verbs and plural nouns, and nest only for ownership (`/doctors/:id/patients`).
3. **Controller:** keep it thin. Read `res.locals.body|query|params` (set by `validate()`), call the service, and respond with `res.status(x).json({ success: true, data, meta? })`. Return `201` for creates and `204` (or `200` with data) for deletes. Pick one and stay consistent.
4. **Service:** all database logic goes here. It must not import Express types.
5. **Index check:** confirm that a model index supports every new filter or sort. Add one if missing. Run `Model.find(filter).sort(sort).explain('executionStats')` against seeded data and confirm IXSCAN, with `totalDocsExamined` close to `nReturned`.
6. **Tests:** add Supertest cases in `src/tests/` (mongodb-memory-server replica set):
   - 200/201 happy path
   - 400 `VALIDATION_ERROR` with `details`
   - 401 without a token
   - 404 for an unknown id
   - 409 conflicts where relevant
   - Correct pagination `meta`

## List-query pattern (search, filter, sort, paginate)

- Build `filter` only from validated params. Use one small `build<Feature>Filter(query)` helper per feature:
  - Equality filters (`specialization`, `condition`, `status`, `doctor`) are added only when present.
  - Date range: `{ createdAt|visitDate: { $gte: from, $lte: endOfDay(to) } }`.
  - Search ≥ 3 chars: `{ $text: { $search } }`. Shorter searches use an anchored prefix regex on `name` only, with user input escaped.
- `sort` comes from a whitelist map. Always add `_id` as a tiebreaker for stable pages.
- Run the queries in parallel:
  `Promise.all([Model.find(filter, projection).sort(sort).skip((page-1)*limit).limit(limit).lean(), Model.countDocuments(filter)])`
- `meta = { page, limit, total, totalPages: Math.ceil(total/limit) }`.
- To show a related name, use `.populate('doctor', 'name specialization')` with a projection. Never use a full populate, and never use `$lookup` on list endpoints.

## Aggregations (stats)

- Start with `$match` on an indexed field. Use `$group` → `$sort` → `$limit`/`$project`, and project only the fields the chart needs.
- Use `$dateTrunc` for time buckets. Return the buckets sorted; the client fills gaps.
- Use `estimatedDocumentCount()` for unfiltered totals. Use `$facet` to combine several KPIs into one round trip.
- Prefer the denormalized `Doctor.patientCount` over grouping the whole patients collection.

## Writes

- Create, delete and move-doctor operations on Patient run in `session.withTransaction()` and `$inc` the related `Doctor.patientCount`.
- Map duplicate keys (Mongo `11000`) to `409 DUPLICATE_EMAIL`. Map `CastError` to `400`.
- PATCH uses `findByIdAndUpdate(id, { $set }, { new: true, runValidators: true })`. If a nested route's resource doesn't belong to its parent, return 404.

## Errors & security

- Throw `new ApiError(status, CODE, message, details?)`. Never call `res.status(...).json` for errors inside controllers.
- In production, don't leak stack traces or Mongo internals in responses.
- Never return `passwordHash`. The login route is rate-limited. CORS allows only `CLIENT_ORIGIN`.
- Log with pino, including a request id. Never log tokens or passwords.

## Done criteria

- The schema is shared, the route is protected, and the response uses the envelope.
- The index is confirmed with `explain()`.
- Tests pass. The `docs/PLAN.md` §5 API table is updated if the contract changed.
