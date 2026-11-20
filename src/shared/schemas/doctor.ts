import { z } from 'zod';
import { SPECIALIZATIONS } from '../constants';
import {
  dateRangeQuerySchema,
  optional,
  orderSchema,
  paginationQuerySchema,
  refineDateRange,
  searchSchema,
} from './common';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number');

/** "Dr." is a display concern: strip it so names sort/search naturally ("ali" finds "Alice"). */
export const stripDoctorTitle = (name: string) => name.replace(/^dr\.?\s+/i, '').trim();

export const doctorSchema = z.object({
  name: z
    .string()
    .trim()
    .transform(stripDoctorTitle)
    .pipe(z.string().min(2, 'Name is too short').max(100)),
  specialization: z.enum(SPECIALIZATIONS, {
    errorMap: () => ({ message: 'Select a specialization' }),
  }),
  hospital: z.string().trim().min(2, 'Hospital is too short').max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const createDoctorSchema = doctorSchema;

export const updateDoctorSchema = doctorSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const DOCTOR_SORT_FIELDS = ['createdAt', 'name', 'patientCount'] as const;

export const listDoctorsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    search: searchSchema,
    specialization: optional(z.enum(SPECIALIZATIONS)),
    hospital: optional(z.string().trim().max(120)),
    sort: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.enum(DOCTOR_SORT_FIELDS).default('createdAt'),
    ),
    order: orderSchema,
  })
  .superRefine(refineDateRange);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type DoctorSortField = (typeof DOCTOR_SORT_FIELDS)[number];
