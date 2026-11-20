import { SPECIALIZATIONS } from '@doctor-tracker/shared';
import { model, Schema, type InferSchemaType, type Types } from 'mongoose';

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    /** Denormalized count, maintained transactionally by patient writes. */
    patientCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Every sort-supporting index ends with `_id` because list queries sort with an `_id`
// tiebreaker (stable pagination). Without it MongoDB falls back to an in-memory SORT.
// Indexes are walked backwards for ascending sorts, so one direction covers both.

// Uniqueness + email-prefix search
doctorSchema.index({ email: 1 }, { unique: true });
// Default listing + date-range filter
doctorSchema.index({ createdAt: -1, _id: -1 });
// Equality → Sort → Range (ESR): equality filter first, then the default sort field
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1, _id: -1 });
// Name sort + case-insensitive prefix search
doctorSchema.index({ name: 1, _id: 1 });
// "Most patients" sort and the top-N dashboard stat
doctorSchema.index({ patientCount: -1, _id: -1 });
// Full-word search across descriptive fields
doctorSchema.index(
  { name: 'text', specialization: 'text', hospital: 'text' },
  { name: 'doctor_text', weights: { name: 10, specialization: 5, hospital: 3 } },
);

export type DoctorDoc = InferSchemaType<typeof doctorSchema> & { _id: Types.ObjectId };
export const Doctor = model('Doctor', doctorSchema);
