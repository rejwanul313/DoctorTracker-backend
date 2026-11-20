import { z } from 'zod';
import { CONDITIONS, GENDERS, PATIENT_STATUSES } from '../constants';
import {
  dateRangeQuerySchema,
  dateStringSchema,
  objectIdSchema,
  optional,
  orderSchema,
  paginationQuerySchema,
  refineDateRange,
  searchSchema,
} from './common';
import { phoneSchema } from './doctor';

const sortPreprocess = (v: unknown) => (v === '' || v == null ? undefined : v);

/** Fields an admin fills in for a patient (doctor is supplied by the route or explicitly on update). */
export const patientSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  age: z.coerce
    .number({ invalid_type_error: 'Age must be a number' })
    .int('Age must be a whole number')
    .min(0, 'Age must be 0 or more')
    .max(120, 'Age must be 120 or less'),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Select a gender' }) }),
  phone: optional(phoneSchema),
  email: optional(z.string().trim().toLowerCase().email('Enter a valid email')),
  condition: z.enum(CONDITIONS, { errorMap: () => ({ message: 'Select a condition' }) }),
  status: z.enum(PATIENT_STATUSES).default('active'),
  visitDate: dateStringSchema,
  notes: optional(z.string().trim().max(1000, 'Notes must be 1000 characters or fewer')),
});

/** Body for POST /doctors/:id/patients */
export const createPatientSchema = patientSchema;

/** Body for PATCH /patients/:id. `doctor` lets an admin reassign the patient. */
export const updatePatientSchema = patientSchema
  .partial()
  .extend({ doctor: objectIdSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const PATIENT_SORT_FIELDS = ['visitDate', 'createdAt', 'name', 'age'] as const;

const patientFilters = {
  search: searchSchema,
  condition: optional(z.enum(CONDITIONS)),
  status: optional(z.enum(PATIENT_STATUSES)),
  gender: optional(z.enum(GENDERS)),
  sort: z.preprocess(sortPreprocess, z.enum(PATIENT_SORT_FIELDS).default('visitDate')),
  order: orderSchema,
};

/** Query for GET /patients */
export const listPatientsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({ ...patientFilters, doctorId: optional(objectIdSchema) })
  .superRefine(refineDateRange);

/** Query for GET /doctors/:id/patients */
export const doctorPatientsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend(patientFilters)
  .superRefine(refineDateRange);

export const doctorPatientParamsSchema = z.object({
  id: objectIdSchema,
  patientId: objectIdSchema,
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreatePatientFormValues = z.input<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type DoctorPatientsQuery = z.infer<typeof doctorPatientsQuerySchema>;
export type PatientSortField = (typeof PATIENT_SORT_FIELDS)[number];
