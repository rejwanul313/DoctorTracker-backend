import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { addPatientToDoctor } from '../modules/doctors/doctors.service';
import { createAdmin, insertDoctor, patientInput, request } from './helpers';

let auth: Record<string, string>;

beforeEach(async () => {
  ({ auth } = await createAdmin());
});

async function seedPatient(overrides: Parameters<typeof patientInput>[0] = {}) {
  const doctor = await insertDoctor();
  const patient = await addPatientToDoctor(doctor._id.toString(), patientInput(overrides));
  return { doctor, patient };
}

describe('Patients API', () => {
  it('GET /patients lists with filters, pagination and populated doctor', async () => {
    await seedPatient({ name: 'Ann Critical', status: 'critical', condition: 'cardiac' });
    await seedPatient({ name: 'Ben Active', status: 'active', condition: 'cardiac' });

    const res = await request
      .get('/api/v1/patients')
      .query({ status: 'critical', condition: 'cardiac', limit: 5 })
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(['Ann Critical']);
    expect(res.body.data[0].doctor).toEqual(
      expect.objectContaining({ name: expect.any(String), specialization: expect.any(String) }),
    );
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5, total: 1 });
  });

  it('GET /patients ignores empty filter values from the UI', async () => {
    await seedPatient();
    const res = await request
      .get('/api/v1/patients?search=&condition=&status=&from=&to=')
      .set(auth);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });

  it('GET /patients rejects an inverted date range', async () => {
    const res = await request.get('/api/v1/patients?from=2026-05-01&to=2026-01-01').set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('query.to');
  });

  it('GET /patients/:id returns one patient or 404', async () => {
    const { patient } = await seedPatient({ name: 'Single Patient' });
    const ok = await request.get(`/api/v1/patients/${patient._id}`).set(auth);
    expect(ok.body.data.name).toBe('Single Patient');
    const missing = await request.get(`/api/v1/patients/${new Types.ObjectId()}`).set(auth);
    expect(missing.status).toBe(404);
  });

  it('PATCH /patients/:id updates and clears optional fields', async () => {
    const { patient } = await seedPatient({ email: 'old@x.com' });
    const res = await request
      .patch(`/api/v1/patients/${patient._id}`)
      .set(auth)
      .send({ status: 'recovered', email: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('recovered');
    expect(res.body.data).not.toHaveProperty('email');
  });

  it('PATCH /patients/:id validates input', async () => {
    const { patient } = await seedPatient();
    const res = await request
      .patch(`/api/v1/patients/${patient._id}`)
      .set(auth)
      .send({ age: 300, doctor: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['age', 'doctor']),
    );
  });

  it('DELETE /patients/:id removes the patient and decrements the count', async () => {
    const { doctor, patient } = await seedPatient();
    expect((await request.delete(`/api/v1/patients/${patient._id}`).set(auth)).status).toBe(204);
    const doctorRes = await request.get(`/api/v1/doctors/${doctor._id}`).set(auth);
    expect(doctorRes.body.data.patientCount).toBe(0);
  });
});
