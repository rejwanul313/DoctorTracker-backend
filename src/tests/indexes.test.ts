/**
 * Query-plan regression tests: every list query the API issues must be served by an index
 * (no COLLSCAN) and must not need an in-memory SORT stage.
 */
import { listDoctorsQuerySchema, listPatientsQuerySchema } from '@doctor-tracker/shared';
import type { Model, SortOrder } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { Doctor } from '../models/doctor.model';
import { Patient } from '../models/patient.model';
import { buildDoctorFilter } from '../modules/doctors/doctor-filter';
import { addPatientToDoctor } from '../modules/doctors/doctors.service';
import { buildPatientFilter } from '../modules/patients/patient-filter';
import { buildSort } from '../utils/pagination';
import { insertDoctor, patientInput } from './helpers';

function collectStages(plan: unknown, stages: string[] = []): string[] {
  if (plan && typeof plan === 'object') {
    const node = plan as Record<string, unknown>;
    if (typeof node.stage === 'string') stages.push(node.stage);
    for (const value of Object.values(node)) collectStages(value, stages);
  }
  return stages;
}

async function winningStages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  filter: Record<string, unknown>,
  sort: Record<string, SortOrder>,
) {
  const explain = (await model
    .find(filter)
    .sort(sort)
    .limit(10)
    .explain('queryPlanner')) as unknown as {
    queryPlanner: { winningPlan: unknown };
  };
  return collectStages(explain.queryPlanner.winningPlan);
}

beforeEach(async () => {
  const doctor = await insertDoctor();
  await addPatientToDoctor(doctor._id.toString(), patientInput());
});

describe('doctor list queries use indexes', () => {
  it.each([
    ['default', {}],
    ['by specialization', { specialization: 'Cardiology' }],
    ['by hospital', { hospital: 'City General Hospital' }],
    ['by date range', { from: '2026-01-01', to: '2026-12-31' }],
    ['sorted by name', { sort: 'name', order: 'asc' }],
    ['sorted by patientCount', { sort: 'patientCount' }],
  ])('%s', async (_label, params) => {
    const q = listDoctorsQuerySchema.parse(params);
    const stages = await winningStages(Doctor, buildDoctorFilter(q), buildSort(q.sort, q.order));
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
    expect(stages).not.toContain('SORT');
  });
});

describe('patient list queries use indexes', () => {
  it.each([
    ['default', {}],
    ['by condition', { condition: 'asthma' }],
    ['by status', { status: 'critical' }],
    ['by visit date range', { from: '2026-01-01', to: '2026-02-01' }],
    ['by doctor', { doctorId: '507f1f77bcf86cd799439011' }],
    ['sorted by age', { sort: 'age', order: 'asc' }],
    ['sorted by name', { sort: 'name', order: 'asc' }],
  ])('%s', async (_label, params) => {
    const q = listPatientsQuerySchema.parse(params);
    const stages = await winningStages(Patient, buildPatientFilter(q), buildSort(q.sort, q.order));
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
    expect(stages).not.toContain('SORT');
  });

  it('search uses the text index and indexed prefix scans (no COLLSCAN)', async () => {
    const q = listPatientsQuerySchema.parse({ search: 'john' });
    const stages = await winningStages(Patient, buildPatientFilter(q), buildSort(q.sort, q.order));
    expect(stages).toContain('TEXT_MATCH');
    expect(stages).not.toContain('COLLSCAN');
  });
});
