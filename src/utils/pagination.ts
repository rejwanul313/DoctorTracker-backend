import type { PaginationMeta } from '@doctor-tracker/shared';
import type { Model, PopulateOptions, SortOrder } from 'mongoose';

// Mongoose's Model generics don't compose well across models; results are typed via `R` instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;

export function getSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Builds a stable sort: the requested field plus `_id` as a tiebreaker so pages never overlap. */
export function buildSort(field: string, order: 'asc' | 'desc'): Record<string, SortOrder> {
  const direction: SortOrder = order === 'asc' ? 1 : -1;
  return field === '_id' ? { _id: direction } : { [field]: direction, _id: direction };
}

interface PaginateOptions {
  filter: Record<string, unknown>;
  page: number;
  limit: number;
  sort: Record<string, SortOrder>;
  projection?: Record<string, 0 | 1>;
  populate?: PopulateOptions;
}

/**
 * Runs the page query and the count in parallel. Both hit the same indexes,
 * and `.lean()` skips hydration for plain JSON-ready objects.
 */
export async function paginate<R>(
  model: AnyModel,
  options: PaginateOptions,
): Promise<{ data: R[]; meta: PaginationMeta }> {
  const { filter, page, limit, sort, projection, populate } = options;

  let query = model.find(filter, projection).sort(sort).skip(getSkip(page, limit)).limit(limit);
  if (populate) query = query.populate(populate);

  const [data, total] = await Promise.all([query.lean<R[]>().exec(), model.countDocuments(filter)]);
  return { data, meta: buildMeta(page, limit, total) };
}
