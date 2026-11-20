import { z } from 'zod';
import { PAGINATION } from '../constants';

/** Treat '', null and whitespace-only strings (common in query strings / forms) as "not provided". */
export const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

/** Optional field that tolerates empty strings from URLs and HTML forms. */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date as `YYYY-MM-DD` (kept as a string so it round-trips through URLs). */
export const dateStringSchema = z
  .string()
  .regex(DATE_RE, 'Use YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date');

export const searchSchema = optional(z.string().trim().max(100));

export const paginationQuerySchema = z.object({
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  ),
});

export const dateRangeQuerySchema = z.object({
  from: optional(dateStringSchema),
  to: optional(dateStringSchema),
});

export const orderSchema = z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('desc'));

/** Shared refinement: `from` must not be after `to`. ISO date strings compare lexicographically. */
export const refineDateRange = <T extends { from?: string; to?: string }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: '"to" must be on or after "from"',
    });
  }
};

export const idParamSchema = z.object({ id: objectIdSchema });

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
