import type {
  CreateDoctorInput,
  CreatePatientInput,
  DoctorPatientsQuery,
  ListDoctorsQuery,
  UpdateDoctorInput,
} from '@doctor-tracker/shared';
import type { Request, Response } from 'express';
import * as service from './doctors.service';

type IdParams = { id: string };
type DoctorPatientParams = { id: string; patientId: string };

export async function list(_req: Request, res: Response) {
  const { data, meta } = await service.listDoctors(res.locals.query as ListDoctorsQuery);
  res.json({ success: true, data, meta });
}

export async function getOne(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  res.json({ success: true, data: await service.getDoctor(id) });
}

export async function create(_req: Request, res: Response) {
  const data = await service.createDoctor(res.locals.body as CreateDoctorInput);
  res.status(201).json({ success: true, data });
}

export async function update(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  const data = await service.updateDoctor(id, res.locals.body as UpdateDoctorInput);
  res.json({ success: true, data });
}

export async function remove(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  await service.deleteDoctor(id);
  res.status(204).end();
}

export async function listPatients(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  const { data, meta } = await service.listDoctorPatients(
    id,
    res.locals.query as DoctorPatientsQuery,
  );
  res.json({ success: true, data, meta });
}

export async function addPatient(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  const data = await service.addPatientToDoctor(id, res.locals.body as CreatePatientInput);
  res.status(201).json({ success: true, data });
}

export async function removePatient(_req: Request, res: Response) {
  const { id, patientId } = res.locals.params as DoctorPatientParams;
  await service.removePatientFromDoctor(id, patientId);
  res.status(204).end();
}
