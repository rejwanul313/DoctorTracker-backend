import { CONDITIONS, GENDERS, PATIENT_STATUSES } from '@doctor-tracker/shared';
import { model, Schema, type InferSchemaType, type Types } from 'mongoose';

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    condition: { type: String, required: true, enum: CONDITIONS },
    status: { type: String, required: true, enum: PATIENT_STATUSES, default: 'active' },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    visitDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// Sort-supporting indexes end with `_id` to match the stable `{ field, _id }` sort (see doctor.model).

// A doctor's patient list (and "does this doctor have patients?")
patientSchema.index({ doctor: 1, visitDate: -1, _id: -1 });
// Condition / status filters combined with the default visitDate sort and range (ESR)
patientSchema.index({ condition: 1, visitDate: -1, _id: -1 });
patientSchema.index({ status: 1, visitDate: -1, _id: -1 });
// Default listing, date-range filter and timeseries aggregation
patientSchema.index({ visitDate: -1, _id: -1 });
// "New patients" KPI range count
patientSchema.index({ createdAt: -1, _id: -1 });
// Name / age sorts + name prefix search; email prefix search (sparse: email is optional)
patientSchema.index({ name: 1, _id: 1 });
patientSchema.index({ age: 1, _id: 1 });
patientSchema.index({ email: 1 }, { sparse: true });
// Full-word search
patientSchema.index(
  { name: 'text', email: 'text', phone: 'text' },
  { name: 'patient_text', weights: { name: 10, email: 3, phone: 1 } },
);

export type PatientDoc = InferSchemaType<typeof patientSchema> & { _id: Types.ObjectId };
export const Patient = model('Patient', patientSchema);
