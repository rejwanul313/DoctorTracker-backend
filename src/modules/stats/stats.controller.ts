import type {
  PatientsPerDoctorQuery,
  StatsRangeQuery,
  TimeseriesQuery,
} from '@doctor-tracker/shared';
import type { Request, Response } from 'express';
import * as service from './stats.service';

export async function overview(_req: Request, res: Response) {
  res.json({ success: true, data: await service.getOverview(res.locals.query as StatsRangeQuery) });
}

export async function timeseries(_req: Request, res: Response) {
  res.json({
    success: true,
    data: await service.getTimeseries(res.locals.query as TimeseriesQuery),
  });
}

export async function conditions(_req: Request, res: Response) {
  res.json({
    success: true,
    data: await service.getConditionBreakdown(res.locals.query as StatsRangeQuery),
  });
}

export async function patientsPerDoctor(_req: Request, res: Response) {
  const { limit } = res.locals.query as PatientsPerDoctorQuery;
  res.json({ success: true, data: await service.getPatientsPerDoctor(limit) });
}

export async function specializations(_req: Request, res: Response) {
  res.json({ success: true, data: await service.getSpecializationBreakdown() });
}
