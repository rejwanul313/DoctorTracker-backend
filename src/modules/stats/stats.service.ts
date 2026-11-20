import {
  defaultRange,
  fillTimeseries,
  type CountByKeyDTO,
  type PatientsPerDoctorDTO,
  type StatsOverviewDTO,
  type StatsRangeQuery,
  type TimeseriesPointDTO,
  type TimeseriesQuery,
} from '@doctor-tracker/shared';
import { Doctor } from '../../models/doctor.model';
import { Patient } from '../../models/patient.model';
import { toDateRange } from '../../utils/query-helpers';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** KPI numbers. Totals use collection metadata (O(1)); range counts use the createdAt index. */
export async function getOverview(range: StatsRangeQuery): Promise<StatsOverviewDTO> {
  const createdAt = toDateRange(range.from, range.to) ?? {
    $gte: new Date(Date.now() - THIRTY_DAYS_MS),
  };

  const [totalDoctors, totalPatients, newPatients, newDoctors, criticalPatients] =
    await Promise.all([
      Doctor.estimatedDocumentCount(),
      Patient.estimatedDocumentCount(),
      Patient.countDocuments({ createdAt }),
      Doctor.countDocuments({ createdAt }),
      Patient.countDocuments({ status: 'critical' }),
    ]);

  return {
    totalDoctors,
    totalPatients,
    newPatients,
    newDoctors,
    criticalPatients,
    avgPatientsPerDoctor:
      totalDoctors === 0 ? 0 : Math.round((totalPatients / totalDoctors) * 10) / 10,
  };
}

/** Patient visits bucketed by day / week / month, with empty buckets filled with zeros. */
export async function getTimeseries(query: TimeseriesQuery): Promise<TimeseriesPointDTO[]> {
  const fallback = defaultRange(query.interval);
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : fallback.from;
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : fallback.to;

  const points = await Patient.aggregate<TimeseriesPointDTO>([
    { $match: { visitDate: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$visitDate',
            unit: query.interval,
            startOfWeek: 'monday',
            timezone: 'UTC',
          },
        },
        patients: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone: 'UTC' } },
        patients: 1,
      },
    },
  ]);

  return fillTimeseries(points, from, to, query.interval);
}

export function getConditionBreakdown(range: StatsRangeQuery): Promise<CountByKeyDTO[]> {
  const visitDate = toDateRange(range.from, range.to);
  return Patient.aggregate<CountByKeyDTO>([
    ...(visitDate ? [{ $match: { visitDate } }] : []),
    { $group: { _id: '$condition', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $project: { _id: 0, key: '$_id', count: 1 } },
  ]);
}

/** Top-N doctors by patients. Served by the `patientCount` index: no $lookup over patients. */
export function getPatientsPerDoctor(limit: number): Promise<PatientsPerDoctorDTO[]> {
  return Doctor.find({}, { name: 1, specialization: 1, patientCount: 1 })
    .sort({ patientCount: -1, _id: -1 })
    .limit(limit)
    .lean<PatientsPerDoctorDTO[]>();
}

export function getSpecializationBreakdown(): Promise<CountByKeyDTO[]> {
  return Doctor.aggregate<CountByKeyDTO>([
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $project: { _id: 0, key: '$_id', count: 1 } },
  ]);
}
