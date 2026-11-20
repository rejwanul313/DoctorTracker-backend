import { z } from 'zod';
import { STATS_INTERVALS } from '../constants';
import { dateRangeQuerySchema, emptyToUndefined, refineDateRange } from './common';

export const statsRangeQuerySchema = dateRangeQuerySchema.superRefine(refineDateRange);

export const timeseriesQuerySchema = dateRangeQuerySchema
  .extend({
    interval: z.preprocess(emptyToUndefined, z.enum(STATS_INTERVALS).default('month')),
  })
  .superRefine(refineDateRange);

export const patientsPerDoctorQuerySchema = z.object({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
});

export type StatsRangeQuery = z.infer<typeof statsRangeQuerySchema>;
export type TimeseriesQuery = z.infer<typeof timeseriesQuerySchema>;
export type PatientsPerDoctorQuery = z.infer<typeof patientsPerDoctorQuerySchema>;
