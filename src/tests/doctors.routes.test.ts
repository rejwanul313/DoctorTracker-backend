import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAdmin, doctorInput, insertDoctor, patientInput, request } from './helpers';

let auth: Record<string, string>;

beforeEach(async () => {
  ({ auth } = await createAdmin());
});

describe('Doctors API', () => {
  describe('POST /doctors', () => {
    it('creates a doctor (201) and strips the Dr. title', async () => {
      const res = await request
        .post('/api/v1/doctors')
        .set(auth)
        .send(doctorInput({ name: 'Dr. Jane Doe' }));

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ name: 'Jane Doe', patientCount: 0 });
      expect(res.body.data._id).toMatch(/^[a-f\d]{24}$/);
    });

    it('returns 409 DUPLICATE_EMAIL for an existing email', async () => {
      await request
        .post('/api/v1/doctors')
        .set(auth)
        .send(doctorInput({ email: 'dup@x.com' }));
      const res = await request
        .post('/api/v1/doctors')
        .set(auth)
        .send(doctorInput({ email: 'DUP@x.com' }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    });

    it('returns 400 with field details for invalid input', async () => {
      const res = await request
        .post('/api/v1/doctors')
        .set(auth)
        .send({ name: 'A', specialization: 'Magic', email: 'bad' });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
        expect.arrayContaining(['name', 'specialization', 'hospital', 'phone', 'email']),
      );
    });
  });

  describe('GET /doctors', () => {
    it('returns a paginated list with meta', async () => {
      await Promise.all(Array.from({ length: 3 }, () => insertDoctor()));
      const res = await request.get('/api/v1/doctors?limit=2&page=1').set(auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it('filters by specialization and search via query string', async () => {
      await insertDoctor({ name: 'Grace Hopper', specialization: 'Neurology' });
      await insertDoctor({ name: 'Grace Kelly', specialization: 'Oncology' });
      const res = await request
        .get('/api/v1/doctors')
        .query({ search: 'grace', specialization: 'Neurology' })
        .set(auth);
      expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(['Grace Hopper']);
    });

    it('rejects invalid query params', async () => {
      const res = await request.get('/api/v1/doctors?limit=500&sort=password').set(auth);
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual([
        'query.limit',
        'query.sort',
      ]);
    });
  });

  describe('GET/PATCH/DELETE /doctors/:id', () => {
    it('returns 400 for a malformed id and 404 for an unknown one', async () => {
      expect((await request.get('/api/v1/doctors/abc').set(auth)).status).toBe(400);
      expect((await request.get(`/api/v1/doctors/${new Types.ObjectId()}`).set(auth)).status).toBe(
        404,
      );
    });

    it('updates a doctor', async () => {
      const doctor = await insertDoctor();
      const res = await request
        .patch(`/api/v1/doctors/${doctor._id}`)
        .set(auth)
        .send({ hospital: 'Lakeside Medical Institute' });
      expect(res.status).toBe(200);
      expect(res.body.data.hospital).toBe('Lakeside Medical Institute');
    });

    it('rejects an empty update', async () => {
      const doctor = await insertDoctor();
      const res = await request.patch(`/api/v1/doctors/${doctor._id}`).set(auth).send({});
      expect(res.status).toBe(400);
    });

    it('deletes a doctor without patients (204)', async () => {
      const doctor = await insertDoctor();
      expect((await request.delete(`/api/v1/doctors/${doctor._id}`).set(auth)).status).toBe(204);
      expect((await request.get(`/api/v1/doctors/${doctor._id}`).set(auth)).status).toBe(404);
    });
  });

  describe('nested patients', () => {
    it('adds, lists and removes a patient, keeping patientCount in sync', async () => {
      const doctor = await insertDoctor();
      const base = `/api/v1/doctors/${doctor._id}`;

      const created = await request.post(`${base}/patients`).set(auth).send(patientInput());
      expect(created.status).toBe(201);
      expect(created.body.data.doctor.name).toBe(doctor.name);

      const list = await request.get(`${base}/patients`).set(auth);
      expect(list.body.meta.total).toBe(1);
      expect((await request.get(base).set(auth)).body.data.patientCount).toBe(1);

      const blocked = await request.delete(base).set(auth);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('DOCTOR_HAS_PATIENTS');

      const removed = await request.delete(`${base}/patients/${created.body.data._id}`).set(auth);
      expect(removed.status).toBe(204);
      expect((await request.get(base).set(auth)).body.data.patientCount).toBe(0);
    });

    it('returns 404 when adding a patient to an unknown doctor', async () => {
      const res = await request
        .post(`/api/v1/doctors/${new Types.ObjectId()}/patients`)
        .set(auth)
        .send(patientInput());
      expect(res.status).toBe(404);
    });
  });
});
