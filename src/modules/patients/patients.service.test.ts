import { listPatientsQuerySchema } from '@doctor-tracker/shared';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Doctor } from '../../models/doctor.model';
import { Patient } from '../../models/patient.model';
import { insertDoctor, patientInput } from '../../tests/helpers';
import { addPatientToDoctor } from '../doctors/doctors.service';
import * as service from './patients.service';

const listQuery = (q: Record<string, unknown> = {}) => listPatientsQuerySchema.parse(q);
const countOf = async (id: Types.ObjectId) => (await Doctor.findById(id))!.patientCount;

describe('patients.service', () => {
  describe('listPatients', () => {
    it('filters by condition, status and visitDate range and populates the doctor name', async () => {
      const doctor = await insertDoctor({ name: 'Gregory House' });
      const id = doctor._id.toString();
      await addPatientToDoctor(
        id,
        patientInput({
          name: 'Match',
          condition: 'asthma',
          status: 'critical',
          visitDate: '2026-02-10',
        }),
      );
      await addPatientToDoctor(
        id,
        patientInput({ condition: 'asthma', status: 'active', visitDate: '2026-02-10' }),
      );
      await addPatientToDoctor(
        id,
        patientInput({ condition: 'asthma', status: 'critical', visitDate: '2026-05-01' }),
      );
      await addPatientToDoctor(
        id,
        patientInput({ condition: 'diabetes', status: 'critical', visitDate: '2026-02-10' }),
      );

      const result = await service.listPatients(
        listQuery({
          condition: 'asthma',
          status: 'critical',
          from: '2026-02-01',
          to: '2026-02-28',
        }),
      );
      expect(result.data.map((p) => p.name)).toEqual(['Match']);
      expect(result.data[0]!.doctor).toMatchObject({ name: 'Gregory House' });
    });

    it('filters by doctorId', async () => {
      const a = await insertDoctor();
      const b = await insertDoctor();
      await addPatientToDoctor(a._id.toString(), patientInput());
      await addPatientToDoctor(b._id.toString(), patientInput());

      const result = await service.listPatients(listQuery({ doctorId: a._id.toString() }));
      expect(result.meta.total).toBe(1);
    });

    it('sorts by visitDate desc by default', async () => {
      const doctor = await insertDoctor();
      const id = doctor._id.toString();
      await addPatientToDoctor(id, patientInput({ name: 'Older', visitDate: '2026-01-01' }));
      await addPatientToDoctor(id, patientInput({ name: 'Newer', visitDate: '2026-06-01' }));

      const result = await service.listPatients(listQuery());
      expect(result.data.map((p) => p.name)).toEqual(['Newer', 'Older']);
    });
  });

  describe('updatePatient', () => {
    it('updates fields without touching counters', async () => {
      const doctor = await insertDoctor();
      const patient = await addPatientToDoctor(doctor._id.toString(), patientInput());

      const updated = await service.updatePatient(patient._id.toString(), { status: 'recovered' });
      expect(updated.status).toBe('recovered');
      expect(await countOf(doctor._id)).toBe(1);
    });

    it('does not reset status to its default on a partial update', async () => {
      const doctor = await insertDoctor();
      const patient = await addPatientToDoctor(
        doctor._id.toString(),
        patientInput({ status: 'critical' }),
      );

      const updated = await service.updatePatient(patient._id.toString(), { age: 50 });
      expect(updated).toMatchObject({ age: 50, status: 'critical' });
    });

    it('clears an optional field that resolved to undefined', async () => {
      const doctor = await insertDoctor();
      const patient = await addPatientToDoctor(
        doctor._id.toString(),
        patientInput({ email: 'p@x.com' }),
      );

      await service.updatePatient(patient._id.toString(), { email: undefined });
      const stored = await Patient.findById(patient._id).lean();
      expect(stored).not.toHaveProperty('email');
    });

    it('moves the patient between doctors and transfers the count', async () => {
      const from = await insertDoctor();
      const to = await insertDoctor({ name: 'Target Doctor' });
      const patient = await addPatientToDoctor(from._id.toString(), patientInput());

      const updated = await service.updatePatient(patient._id.toString(), {
        doctor: to._id.toString(),
      });
      expect(updated.doctor).toMatchObject({ name: 'Target Doctor' });
      expect(await countOf(from._id)).toBe(0);
      expect(await countOf(to._id)).toBe(1);
    });

    it('rejects reassignment to a missing doctor and leaves counts unchanged', async () => {
      const doctor = await insertDoctor();
      const patient = await addPatientToDoctor(doctor._id.toString(), patientInput());

      await expect(
        service.updatePatient(patient._id.toString(), { doctor: new Types.ObjectId().toString() }),
      ).rejects.toMatchObject({ status: 400 });
      expect(await countOf(doctor._id)).toBe(1);
    });

    it('throws 404 for an unknown patient', async () => {
      await expect(
        service.updatePatient(new Types.ObjectId().toString(), { age: 1 }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('deletePatient', () => {
    it('deletes and decrements the doctor count', async () => {
      const doctor = await insertDoctor();
      const patient = await addPatientToDoctor(doctor._id.toString(), patientInput());

      await service.deletePatient(patient._id.toString());
      expect(await Patient.countDocuments()).toBe(0);
      expect(await countOf(doctor._id)).toBe(0);
    });

    it('throws 404 for an unknown patient', async () => {
      await expect(service.deletePatient(new Types.ObjectId().toString())).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
