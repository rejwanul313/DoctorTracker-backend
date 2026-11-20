import {
  idParamSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from '@doctor-tracker/shared';
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './patients.controller';

export const patientsRouter = Router();

patientsRouter.get('/', validate({ query: listPatientsQuerySchema }), controller.list);

patientsRouter
  .route('/:id')
  .get(validate({ params: idParamSchema }), controller.getOne)
  .patch(validate({ params: idParamSchema, body: updatePatientSchema }), controller.update)
  .delete(validate({ params: idParamSchema }), controller.remove);
