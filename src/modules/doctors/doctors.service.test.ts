import { listDoctorsQuerySchema, doctorPatientsQuerySchema } from '@doctor-tracker/shared';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Doctor } from '../../models/doctor.model';
import { Patient } from '../../models/patient.model';
import { insertDoctor, patientInput } from '../../tests/helpers';
import * as service from './doctors.service';

const listQuery = (q: Record<string, unknown> = {}) => listDoctorsQuerySchema.parse(q);

describe('doctors.service', () => {
  describe('listDoctors', () => {
    it('paginates with accurate meta', async () => {
      await Promise.all(Array.from({ length: 12 }, () => insertDoctor()));
      const page2 = await service.listDoctors(listQuery({ page: 2, limit: 5 }));
      expect(page2.data).toHaveLength(5);
      expect(page2.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    });

    it('finds doctors by name prefix (partial word) and by full word via $text', async () => {
      await insertDoctor({ name: 'Alice Smith', hospital: 'Riverside Clinic' });
      await insertDoctor({ name: 'Bob Smithers', hospital: 'Metro Heart Center' });
      await insertDoctor({ name: 'Alice Jones', hospital: 'Metro Heart Center' });

      const names = async (search: string) =>
        (await service.listDoctors(listQuery({ search, sort: 'name', order: 'asc' }))).data.map(
          (d) => d.name,
        );

      expect(await names('ali')).toEqual(['Alice Jones', 'Alice Smith']); // prefix
      expect(await names('riverside')).toEqual(['Alice Smith']); // full word in hospital
      expect(await names('smith')).toEqual(['Alice Smith']); // full word, not "Smithers"
      expect(await names('alice smith')).toEqual(['Alice Smith']); // phrase, not every Alice
      expect(await names('metro heart')).toEqual(['Alice Jones', 'Bob Smithers']);
    });

    it('treats regex metacharacters in search literally', async () => {
      await insertDoctor({ name: 'Plain Name' });
      const result = await service.listDoctors(listQuery({ search: '.*' }));
      expect(result.meta.total).toBe(0);
    });

    it('filters by specialization and sorts by name', async () => {
      await insertDoctor({ name: 'Zed Last', specialization: 'Neurology' });
      await insertDoctor({ name: 'Amy First', specialization: 'Neurology' });
      await insertDoctor({ name: 'Other Person', specialization: 'Oncology' });

      const result = await service.listDoctors(
        listQuery({ specialization: 'Neurology', sort: 'name', order: 'asc' }),
      );
      expect(result.data.map((d) => d.name)).toEqual(['Amy First', 'Zed Last']);
    });

    it('filters by createdAt date range', async () => {
      const old = await insertDoctor();
      await Doctor.collection.updateOne(
        { _id: old._id },
        { $set: { createdAt: new Date('2025-01-15T10:00:00Z') } },
      );
      await insertDoctor();

      const result = await service.listDoctors(listQuery({ from: '2025-01-01', to: '2025-01-31' }));
      expect(result.data.map((d) => String(d._id))).toEqual([old._id.toString()]);
    });

    it('never exposes __v', async () => {
      await insertDoctor();
      const { data } = await service.listDoctors(listQuery());
      expect(data[0]).not.toHaveProperty('__v');
    });
  });

  describe('getDoctor', () => {
    it('throws 404 for an unknown id', async () => {
      await expect(service.getDoctor(new Types.ObjectId().toString())).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('updateDoctor', () => {
    it('updates fields and returns the new document', async () => {
      const doctor = await insertDoctor();
      const updated = await service.updateDoctor(doctor._id.toString(), { hospital: 'New Place' });
      expect(updated.hospital).toBe('New Place');
    });
  });

  describe('patients under a doctor', () => {
    it('adding a patient increments patientCount atomically', async () => {
      const doctor = await insertDoctor();
      const patient = await service.addPatientToDoctor(doctor._id.toString(), patientInput());

      expect(patient.doctor).toMatchObject({
        name: doctor.name,
        specialization: doctor.specialization,
      });
      expect((await Doctor.findById(doctor._id))!.patientCount).toBe(1);
    });

    it('adding to a missing doctor creates nothing (transaction rolls back)', async () => {
      await expect(
        service.addPatientToDoctor(new Types.ObjectId().toString(), patientInput()),
      ).rejects.toMatchObject({ status: 404 });
      expect(await Patient.countDocuments()).toBe(0);
    });

    it('lists only that doctor’s patients', async () => {
      const a = await insertDoctor();
      const b = await insertDoctor();
      await service.addPatientToDoctor(a._id.toString(), patientInput({ name: 'Mine' }));
      await service.addPatientToDoctor(b._id.toString(), patientInput({ name: 'Theirs' }));

      const result = await service.listDoctorPatients(
        a._id.toString(),
        doctorPatientsQuerySchema.parse({}),
      );
      expect(result.data.map((p) => p.name)).toEqual(['Mine']);
    });

    it('removing a patient decrements patientCount', async () => {
      const doctor = await insertDoctor();
      const patient = await service.addPatientToDoctor(doctor._id.toString(), patientInput());
      await service.removePatientFromDoctor(doctor._id.toString(), patient._id.toString());

      expect(await Patient.countDocuments()).toBe(0);
      expect((await Doctor.findById(doctor._id))!.patientCount).toBe(0);
    });

    it('refuses to remove a patient through the wrong doctor', async () => {
      const owner = await insertDoctor();
      const other = await insertDoctor();
      const patient = await service.addPatientToDoctor(owner._id.toString(), patientInput());

      await expect(
        service.removePatientFromDoctor(other._id.toString(), patient._id.toString()),
      ).rejects.toMatchObject({ status: 404 });
      expect(await Patient.countDocuments()).toBe(1);
      expect((await Doctor.findById(other._id))!.patientCount).toBe(0);
    });
  });

  describe('deleteDoctor', () => {
    it('is blocked while the doctor has patients', async () => {
      const doctor = await insertDoctor();
      await service.addPatientToDoctor(doctor._id.toString(), patientInput());

      await expect(service.deleteDoctor(doctor._id.toString())).rejects.toMatchObject({
        status: 409,
        code: 'DOCTOR_HAS_PATIENTS',
      });
      expect(await Doctor.exists({ _id: doctor._id })).toBeTruthy();
    });

    it('deletes a doctor without patients', async () => {
      const doctor = await insertDoctor();
      await service.deleteDoctor(doctor._id.toString());
      expect(await Doctor.exists({ _id: doctor._id })).toBeNull();
    });
  });
});
