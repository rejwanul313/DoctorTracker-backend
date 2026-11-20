import type { ListDoctorsQuery } from '@doctor-tracker/shared';
import type { FilterQuery } from 'mongoose';
import type { DoctorDoc } from '../../models/doctor.model';
import { buildSearchClause, toDateRange } from '../../utils/query-helpers';

type DoctorFilterInput = Pick<
  ListDoctorsQuery,
  'search' | 'specialization' | 'hospital' | 'from' | 'to'
>;

/** Translates validated list params into an index-backed Mongo filter. Only set params add clauses. */
export function buildDoctorFilter(query: DoctorFilterInput): FilterQuery<DoctorDoc> {
  const filter: FilterQuery<DoctorDoc> = {};

  if (query.specialization) filter.specialization = query.specialization;
  if (query.hospital) filter.hospital = query.hospital;

  const createdAt = toDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  if (query.search) Object.assign(filter, buildSearchClause(query.search, ['name', 'email']));

  return filter;
}
