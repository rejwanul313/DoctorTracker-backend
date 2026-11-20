import {
  patientsPerDoctorQuerySchema,
  statsRangeQuerySchema,
  timeseriesQuerySchema,
} from '@doctor-tracker/shared';
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './stats.controller';

export const statsRouter = Router();

statsRouter.get('/overview', validate({ query: statsRangeQuerySchema }), controller.overview);
statsRouter.get('/timeseries', validate({ query: timeseriesQuerySchema }), controller.timeseries);
statsRouter.get('/conditions', validate({ query: statsRangeQuerySchema }), controller.conditions);
statsRouter.get(
  '/patients-per-doctor',
  validate({ query: patientsPerDoctorQuerySchema }),
  controller.patientsPerDoctor,
);
statsRouter.get('/specializations', controller.specializations);
