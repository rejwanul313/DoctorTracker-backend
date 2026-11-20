import type { ListPatientsQuery, PatientDTO, UpdatePatientInput } from '@doctor-tracker/shared';
import { withTransaction } from '../../db/connect';
import { Doctor } from '../../models/doctor.model';
import { Patient } from '../../models/patient.model';
import { ApiError } from '../../utils/api-error';
import { buildSort, paginate } from '../../utils/pagination';
import { toUpdateOperators } from '../../utils/query-helpers';
import { buildPatientFilter } from './patient-filter';

/** Minimal doctor projection for patient rows: never a full populate on list endpoints. */
export const PATIENT_DOCTOR_POPULATE = { path: 'doctor', select: 'name specialization' } as const;
const PATIENT_PROJECTION = { __v: 0 } as const;

export function listPatients(query: ListPatientsQuery) {
  return paginate<PatientDTO>(Patient, {
    filter: buildPatientFilter(query),
    page: query.page,
    limit: query.limit,
    sort: buildSort(query.sort, query.order),
    projection: PATIENT_PROJECTION,
    populate: PATIENT_DOCTOR_POPULATE,
  });
}

export async function getPatient(id: string): Promise<PatientDTO> {
  const patient = await Patient.findById(id, PATIENT_PROJECTION)
    .populate(PATIENT_DOCTOR_POPULATE)
    .lean<PatientDTO>();
  if (!patient) throw ApiError.notFound('Patient');
  return patient;
}

/**
 * Updates a patient. When `doctor` changes, both doctors' counters are adjusted
 * in the same transaction so `patientCount` never drifts.
 */
export async function updatePatient(id: string, input: UpdatePatientInput): Promise<PatientDTO> {
  await withTransaction(async (session) => {
    const existing = await Patient.findById(id, { doctor: 1 }).session(session).lean();
    if (!existing) throw ApiError.notFound('Patient');

    const newDoctorId = input.doctor;
    const isReassigning = newDoctorId !== undefined && newDoctorId !== existing.doctor.toString();

    if (isReassigning) {
      const target = await Doctor.findByIdAndUpdate(
        newDoctorId,
        { $inc: { patientCount: 1 } },
        { session, projection: { _id: 1 } },
      );
      if (!target)
        throw ApiError.badRequest('Target doctor does not exist', [
          { path: 'doctor', message: 'Doctor not found' },
        ]);
      await Doctor.updateOne({ _id: existing.doctor }, { $inc: { patientCount: -1 } }, { session });
    }

    await Patient.updateOne({ _id: id }, toUpdateOperators(input), {
      session,
      runValidators: true,
    });
  });

  return getPatient(id);
}

export async function deletePatient(id: string): Promise<void> {
  await withTransaction(async (session) => {
    const deleted = await Patient.findByIdAndDelete(id, { session, projection: { doctor: 1 } });
    if (!deleted) throw ApiError.notFound('Patient');
    await Doctor.updateOne({ _id: deleted.doctor }, { $inc: { patientCount: -1 } }, { session });
  });
}
