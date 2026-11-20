import type { ListPatientsQuery, UpdatePatientInput } from '@doctor-tracker/shared';
import type { Request, Response } from 'express';
import * as service from './patients.service';

type IdParams = { id: string };

export async function list(_req: Request, res: Response) {
  const { data, meta } = await service.listPatients(res.locals.query as ListPatientsQuery);
  res.json({ success: true, data, meta });
}

export async function getOne(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  res.json({ success: true, data: await service.getPatient(id) });
}

export async function update(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  const data = await service.updatePatient(id, res.locals.body as UpdatePatientInput);
  res.json({ success: true, data });
}

export async function remove(_req: Request, res: Response) {
  const { id } = res.locals.params as IdParams;
  await service.deletePatient(id);
  res.status(204).end();
}
