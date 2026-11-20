import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth';
import { emptyToUndefined, idParamSchema, paginationQuerySchema } from './common';
import { createDoctorSchema, listDoctorsQuerySchema, updateDoctorSchema } from './doctor';
import { createPatientSchema, listPatientsQuerySchema, updatePatientSchema } from './patient';
import { patientsPerDoctorQuerySchema, timeseriesQuerySchema } from './stats';

const validDoctor = {
  name: 'Dr. Ada Lovelace',
  specialization: 'Cardiology',
  hospital: 'City General',
  phone: '+1 555-123-4567',
  email: 'Ada@Example.com ',
};

const validPatient = {
  name: 'John Doe',
  age: '42',
  gender: 'male',
  condition: 'diabetes',
  visitDate: '2026-03-15',
};

describe('emptyToUndefined', () => {
  it.each([
    ['', undefined],
    ['   ', undefined],
    [null, undefined],
    ['x', 'x'],
    [0, 0],
  ])('maps %j to %j', (input, expected) => {
    expect(emptyToUndefined(input)).toBe(expected);
  });
});

describe('paginationQuerySchema', () => {
  it('applies defaults when nothing is provided', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it('coerces numeric strings from the query string', () => {
    expect(paginationQuerySchema.parse({ page: '3', limit: '25' })).toEqual({ page: 3, limit: 25 });
  });

  it('rejects limits above the maximum', () => {
    expect(paginationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('rejects page 0', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('idParamSchema', () => {
  it('accepts a 24-char hex ObjectId', () => {
    expect(idParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect(idParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('normalizes email', () => {
    expect(loginSchema.parse({ email: ' ADMIN@X.COM ', password: 'secret1' }).email).toBe(
      'admin@x.com',
    );
  });

  it('rejects short passwords', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '123' }).success).toBe(false);
  });
});

describe('createDoctorSchema', () => {
  it('accepts a valid doctor and normalizes email', () => {
    const parsed = createDoctorSchema.parse(validDoctor);
    expect(parsed.email).toBe('ada@example.com');
  });

  it('strips a leading "Dr." title from the name', () => {
    expect(createDoctorSchema.parse({ ...validDoctor, name: 'dr Grace Hopper' }).name).toBe(
      'Grace Hopper',
    );
    expect(createDoctorSchema.parse(validDoctor).name).toBe('Ada Lovelace');
  });

  it('rejects unknown specializations', () => {
    const result = createDoctorSchema.safeParse({ ...validDoctor, specialization: 'Magic' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid phone numbers', () => {
    expect(createDoctorSchema.safeParse({ ...validDoctor, phone: 'call me' }).success).toBe(false);
  });

  it('reports every missing required field', () => {
    const result = createDoctorSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(
        expect.arrayContaining(['name', 'specialization', 'hospital', 'phone', 'email']),
      );
    }
  });
});

describe('updateDoctorSchema', () => {
  it('accepts a partial update', () => {
    expect(updateDoctorSchema.safeParse({ hospital: 'New Hospital' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updateDoctorSchema.safeParse({}).success).toBe(false);
  });
});

describe('listDoctorsQuerySchema', () => {
  it('fills defaults and drops empty filters', () => {
    const parsed = listDoctorsQuerySchema.parse({ search: '', specialization: '', hospital: '' });
    expect(parsed).toEqual({ page: 1, limit: 10, sort: 'createdAt', order: 'desc' });
  });

  it('rejects an inverted date range', () => {
    const result = listDoctorsQuerySchema.safeParse({ from: '2026-05-01', to: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(listDoctorsQuerySchema.safeParse({ from: '01/05/2026' }).success).toBe(false);
  });

  it('rejects sort fields outside the whitelist', () => {
    expect(listDoctorsQuerySchema.safeParse({ sort: 'password' }).success).toBe(false);
  });
});

describe('createPatientSchema', () => {
  it('coerces age, defaults status and drops empty optional fields', () => {
    const parsed = createPatientSchema.parse({ ...validPatient, email: '', phone: '', notes: '' });
    expect(parsed).toMatchObject({ age: 42, status: 'active' });
    expect(parsed.email).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });

  it('rejects out-of-range ages', () => {
    expect(createPatientSchema.safeParse({ ...validPatient, age: 150 }).success).toBe(false);
  });

  it('rejects unknown conditions', () => {
    expect(createPatientSchema.safeParse({ ...validPatient, condition: 'flu' }).success).toBe(
      false,
    );
  });
});

describe('updatePatientSchema', () => {
  it('allows reassigning the doctor', () => {
    expect(updatePatientSchema.safeParse({ doctor: '507f1f77bcf86cd799439011' }).success).toBe(
      true,
    );
  });

  it('rejects an invalid doctor id', () => {
    expect(updatePatientSchema.safeParse({ doctor: 'nope' }).success).toBe(false);
  });
});

describe('listPatientsQuerySchema', () => {
  it('defaults sort to visitDate desc', () => {
    expect(listPatientsQuerySchema.parse({})).toMatchObject({ sort: 'visitDate', order: 'desc' });
  });

  it('validates doctorId', () => {
    expect(listPatientsQuerySchema.safeParse({ doctorId: 'bad' }).success).toBe(false);
  });
});

describe('stats schemas', () => {
  it('defaults the timeseries interval to month', () => {
    expect(timeseriesQuerySchema.parse({}).interval).toBe('month');
  });

  it('caps patients-per-doctor limit at 50', () => {
    expect(patientsPerDoctorQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
});
