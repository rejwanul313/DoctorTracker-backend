import type { CreateDoctorInput, CreatePatientInput } from '@doctor-tracker/shared';
import supertest from 'supertest';
import { createApp } from '../app';
import { Doctor } from '../models/doctor.model';
import { User } from '../models/user.model';
import { hashPassword, signAccessToken } from '../modules/auth/auth.service';

export const app = createApp();
export const request = supertest(app);

export const ADMIN_PASSWORD = 'Admin@123';

export async function createAdmin(email = 'admin@test.dev') {
  const user = await User.create({
    name: 'Test Admin',
    email,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    role: 'admin',
  });
  const { token } = signAccessToken({ id: user._id.toString(), role: 'admin' });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

let sequence = 0;

export function doctorInput(overrides: Partial<CreateDoctorInput> = {}): CreateDoctorInput {
  sequence += 1;
  return {
    name: `Test Doctor ${sequence}`,
    specialization: 'Cardiology',
    hospital: 'City General Hospital',
    phone: '+1 555-000-0000',
    email: `doctor${sequence}@test.dev`,
    ...overrides,
  };
}

export function patientInput(overrides: Partial<CreatePatientInput> = {}): CreatePatientInput {
  sequence += 1;
  return {
    name: `Patient ${sequence}`,
    age: 40,
    gender: 'female',
    condition: 'diabetes',
    status: 'active',
    visitDate: '2026-03-15',
    ...overrides,
  };
}

export async function insertDoctor(overrides: Partial<CreateDoctorInput> = {}) {
  return Doctor.create(doctorInput(overrides));
}
