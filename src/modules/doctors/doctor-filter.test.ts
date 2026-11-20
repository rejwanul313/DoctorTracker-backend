import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { buildPatientFilter } from '../patients/patient-filter';
import { buildDoctorFilter } from './doctor-filter';

describe('buildDoctorFilter', () => {
  it('returns an empty filter when nothing is set', () => {
    expect(buildDoctorFilter({})).toEqual({});
  });

  it('adds equality filters and a createdAt range', () => {
    expect(
      buildDoctorFilter({
        specialization: 'Neurology',
        hospital: 'Riverside Clinic',
        from: '2026-01-01',
      }),
    ).toEqual({
      specialization: 'Neurology',
      hospital: 'Riverside Clinic',
      createdAt: { $gte: new Date('2026-01-01T00:00:00.000Z') },
    });
  });

  it('adds a search $or clause over name and email', () => {
    const filter = buildDoctorFilter({ search: 'ada' });
    expect(filter.$or).toHaveLength(3);
  });
});

describe('buildPatientFilter', () => {
  it('casts doctorId to ObjectId and filters visitDate', () => {
    const doctorId = new Types.ObjectId().toString();
    const filter = buildPatientFilter({ doctorId, condition: 'asthma', to: '2026-02-01' });
    expect(filter.doctor).toBeInstanceOf(Types.ObjectId);
    expect(String(filter.doctor)).toBe(doctorId);
    expect(filter).toMatchObject({
      condition: 'asthma',
      visitDate: { $lte: new Date('2026-02-01T23:59:59.999Z') },
    });
    expect(filter.createdAt).toBeUndefined();
  });

  it('supports status and gender filters', () => {
    expect(buildPatientFilter({ status: 'critical', gender: 'male' })).toEqual({
      status: 'critical',
      gender: 'male',
    });
  });
});
