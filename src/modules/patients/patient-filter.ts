import type { ListPatientsQuery } from '@doctor-tracker/shared';
import { Types, type FilterQuery } from 'mongoose';
import type { PatientDoc } from '../../models/patient.model';
import { buildSearchClause, toDateRange } from '../../utils/query-helpers';

type PatientFilterInput = Pick<
  ListPatientsQuery,
  'search' | 'condition' | 'status' | 'gender' | 'from' | 'to'
> & { doctorId?: string };

/** Translates validated list params into an index-backed Mongo filter. Date filters apply to `visitDate`. */
export function buildPatientFilter(query: PatientFilterInput): FilterQuery<PatientDoc> {
  const filter: FilterQuery<PatientDoc> = {};

  if (query.doctorId) filter.doctor = new Types.ObjectId(query.doctorId);
  if (query.condition) filter.condition = query.condition;
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;

  const visitDate = toDateRange(query.from, query.to);
  if (visitDate) filter.visitDate = visitDate;

  if (query.search) Object.assign(filter, buildSearchClause(query.search, ['name', 'email']));

  return filter;
}
