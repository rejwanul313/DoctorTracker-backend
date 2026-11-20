import { beforeEach, describe, expect, it } from 'vitest';
import { addPatientToDoctor } from '../modules/doctors/doctors.service';
import { createAdmin, insertDoctor, patientInput, request } from './helpers';

let auth: Record<string, string>;

beforeEach(async () => {
  ({ auth } = await createAdmin());
  const doctor = await insertDoctor({ hospital: 'Riverside Clinic', specialization: 'Oncology' });
  await insertDoctor({ hospital: 'Metro Heart Center' });
  await addPatientToDoctor(doctor._id.toString(), patientInput({ visitDate: '2026-02-01' }));
});

describe('Stats & meta API', () => {
  it('GET /stats/overview', async () => {
    const res = await request.get('/api/v1/stats/overview').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalDoctors: 2, totalPatients: 1 });
  });

  it('GET /stats/timeseries validates the interval', async () => {
    const bad = await request.get('/api/v1/stats/timeseries?interval=year').set(auth);
    expect(bad.status).toBe(400);

    const ok = await request
      .get('/api/v1/stats/timeseries?interval=month&from=2026-01-01&to=2026-03-31')
      .set(auth);
    expect(ok.body.data).toEqual([
      { date: '2026-01-01', patients: 0 },
      { date: '2026-02-01', patients: 1 },
      { date: '2026-03-01', patients: 0 },
    ]);
  });

  it('GET /stats/conditions, /patients-per-doctor and /specializations', async () => {
    const [conditions, perDoctor, specializations] = await Promise.all([
      request.get('/api/v1/stats/conditions').set(auth),
      request.get('/api/v1/stats/patients-per-doctor?limit=1').set(auth),
      request.get('/api/v1/stats/specializations').set(auth),
    ]);
    expect(conditions.body.data).toEqual([{ key: 'diabetes', count: 1 }]);
    expect(perDoctor.body.data).toHaveLength(1);
    expect(perDoctor.body.data[0].patientCount).toBe(1);
    expect(specializations.body.data).toHaveLength(2);
  });

  it('GET /meta/filters returns sorted hospitals and the fixed option lists', async () => {
    const res = await request.get('/api/v1/meta/filters').set(auth);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=60');
    expect(res.body.data.hospitals).toEqual(['Metro Heart Center', 'Riverside Clinic']);
    expect(res.body.data.specializations).toContain('Cardiology');
    expect(res.body.data.conditions).toContain('diabetes');
  });
});
