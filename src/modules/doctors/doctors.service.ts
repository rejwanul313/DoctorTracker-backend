import {
  ERROR_CODES,
  type CreateDoctorInput,
  type CreatePatientInput,
  type DoctorDTO,
  type DoctorPatientsQuery,
  type ListDoctorsQuery,
  type PatientDTO,
  type UpdateDoctorInput,
} from '@doctor-tracker/shared';
import { withTransaction } from '../../db/connect';
import { Doctor } from '../../models/doctor.model';
import { Patient } from '../../models/patient.model';
import { ApiError } from '../../utils/api-error';
import { buildSort, paginate } from '../../utils/pagination';
import { buildPatientFilter } from '../patients/patient-filter';
import { PATIENT_DOCTOR_POPULATE } from '../patients/patients.service';
import { buildDoctorFilter } from './doctor-filter';

const DOCTOR_PROJECTION = { __v: 0 } as const;

export function listDoctors(query: ListDoctorsQuery) {
  return paginate<DoctorDTO>(Doctor, {
    filter: buildDoctorFilter(query),
    page: query.page,
    limit: query.limit,
    sort: buildSort(query.sort, query.order),
    projection: DOCTOR_PROJECTION,
  });
}

export async function getDoctor(id: string): Promise<DoctorDTO> {
  const doctor = await Doctor.findById(id, DOCTOR_PROJECTION).lean<DoctorDTO>();
  if (!doctor) throw ApiError.notFound('Doctor');
  return doctor;
}

export async function createDoctor(input: CreateDoctorInput): Promise<DoctorDTO> {
  const doctor = await Doctor.create(input);
  return getDoctor(doctor._id.toString());
}

export async function updateDoctor(id: string, input: UpdateDoctorInput): Promise<DoctorDTO> {
  const doctor = await Doctor.findByIdAndUpdate(
    id,
    { $set: input },
    { new: true, runValidators: true, projection: DOCTOR_PROJECTION },
  ).lean<DoctorDTO>();
  if (!doctor) throw ApiError.notFound('Doctor');
  return doctor;
}

/**
 * Deleting a doctor who still has patients is blocked: silently cascading
 * medical records is riskier than asking the admin to reassign or remove them first.
 */
export async function deleteDoctor(id: string): Promise<void> {
  await withTransaction(async (session) => {
    const doctor = await Doctor.findById(id, { _id: 1 }).session(session).lean();
    if (!doctor) throw ApiError.notFound('Doctor');

    const hasPatients = await Patient.exists({ doctor: id }).session(session);
    if (hasPatients) {
      throw ApiError.conflict(
        ERROR_CODES.DOCTOR_HAS_PATIENTS,
        'This doctor still has patients. Remove or reassign them first.',
      );
    }
    await Doctor.deleteOne({ _id: id }).session(session);
  });
}

async function assertDoctorExists(id: string) {
  const exists = await Doctor.exists({ _id: id });
  if (!exists) throw ApiError.notFound('Doctor');
}

export async function listDoctorPatients(doctorId: string, query: DoctorPatientsQuery) {
  await assertDoctorExists(doctorId);
  return paginate<PatientDTO>(Patient, {
    filter: buildPatientFilter({ ...query, doctorId }),
    page: query.page,
    limit: query.limit,
    sort: buildSort(query.sort, query.order),
    projection: { __v: 0 },
    populate: PATIENT_DOCTOR_POPULATE,
  });
}

/** Creates the patient and bumps the doctor's denormalized counter atomically. */
export async function addPatientToDoctor(
  doctorId: string,
  input: CreatePatientInput,
): Promise<PatientDTO> {
  const patientId = await withTransaction(async (session) => {
    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $inc: { patientCount: 1 } },
      { session, projection: { _id: 1 } },
    );
    if (!doctor) throw ApiError.notFound('Doctor');

    const [patient] = await Patient.create([{ ...input, doctor: doctorId }], { session });
    return patient!._id;
  });

  const patient = await Patient.findById(patientId, { __v: 0 })
    .populate(PATIENT_DOCTOR_POPULATE)
    .lean<PatientDTO>();
  return patient!;
}

/** Removes a patient only if it belongs to this doctor, and decrements the counter atomically. */
export async function removePatientFromDoctor(doctorId: string, patientId: string): Promise<void> {
  await withTransaction(async (session) => {
    const deleted = await Patient.findOneAndDelete(
      { _id: patientId, doctor: doctorId },
      { session },
    );
    if (!deleted) throw ApiError.notFound('Patient');
    await Doctor.updateOne({ _id: doctorId }, { $inc: { patientCount: -1 } }, { session });
  });
}
