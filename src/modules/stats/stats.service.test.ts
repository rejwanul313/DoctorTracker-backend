import { describe, expect, it } from 'vitest';
import { insertDoctor, patientInput } from '../../tests/helpers';
import { addPatientToDoctor } from '../doctors/doctors.service';
import * as stats from './stats.service';

async function seedSmall() {
  const busy = await insertDoctor({ name: 'Busy Doctor', specialization: 'Cardiology' });
  const quiet = await insertDoctor({ name: 'Quiet Doctor', specialization: 'Cardiology' });
  await insertDoctor({ name: 'Idle Doctor', specialization: 'Neurology' });

  const add = (id: string, o: Parameters<typeof patientInput>[0]) =>
    addPatientToDoctor(id, patientInput(o));
  await add(busy._id.toString(), {
    condition: 'asthma',
    visitDate: '2026-01-05',
    status: 'critical',
  });
  await add(busy._id.toString(), { condition: 'asthma', visitDate: '2026-01-20' });
  await add(busy._id.toString(), { condition: 'cardiac', visitDate: '2026-03-02' });
  await add(quiet._id.toString(), { condition: 'diabetes', visitDate: '2026-03-15' });
}

describe('stats.service', () => {
  it('overview returns totals, averages and critical count', async () => {
    await seedSmall();
    const overview = await stats.getOverview({});
    expect(overview).toMatchObject({
      totalDoctors: 3,
      totalPatients: 4,
      criticalPatients: 1,
      avgPatientsPerDoctor: 1.3,
    });
    // All records were created "now", so they fall in the default 30-day window.
    expect(overview.newPatients).toBe(4);
    expect(overview.newDoctors).toBe(3);
  });

  it('overview handles an empty database', async () => {
    expect(await stats.getOverview({})).toMatchObject({
      totalDoctors: 0,
      totalPatients: 0,
      avgPatientsPerDoctor: 0,
    });
  });

  it('timeseries buckets by month and fills empty months with zero', async () => {
    await seedSmall();
    const series = await stats.getTimeseries({
      from: '2026-01-01',
      to: '2026-04-30',
      interval: 'month',
    });
    expect(series).toEqual([
      { date: '2026-01-01', patients: 2 },
      { date: '2026-02-01', patients: 0 },
      { date: '2026-03-01', patients: 2 },
      { date: '2026-04-01', patients: 0 },
    ]);
  });

  it('timeseries buckets by Monday-based weeks', async () => {
    await seedSmall();
    const series = await stats.getTimeseries({
      from: '2026-01-05',
      to: '2026-01-25',
      interval: 'week',
    });
    expect(series).toEqual([
      { date: '2026-01-05', patients: 1 },
      { date: '2026-01-12', patients: 0 },
      { date: '2026-01-19', patients: 1 },
    ]);
  });

  it('condition breakdown is sorted by count and respects the date range', async () => {
    await seedSmall();
    expect(await stats.getConditionBreakdown({})).toEqual([
      { key: 'asthma', count: 2 },
      { key: 'cardiac', count: 1 },
      { key: 'diabetes', count: 1 },
    ]);
    expect(await stats.getConditionBreakdown({ from: '2026-03-01' })).toEqual([
      { key: 'cardiac', count: 1 },
      { key: 'diabetes', count: 1 },
    ]);
  });

  it('patients-per-doctor returns the top N using the denormalized counter', async () => {
    await seedSmall();
    const top = await stats.getPatientsPerDoctor(2);
    expect(top.map((d) => [d.name, d.patientCount])).toEqual([
      ['Busy Doctor', 3],
      ['Quiet Doctor', 1],
    ]);
  });

  it('specialization breakdown counts doctors', async () => {
    await seedSmall();
    expect(await stats.getSpecializationBreakdown()).toEqual([
      { key: 'Cardiology', count: 2 },
      { key: 'Neurology', count: 1 },
    ]);
  });
});
