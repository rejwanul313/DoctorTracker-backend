import {
  createDoctorSchema,
  createPatientSchema,
  doctorPatientParamsSchema,
  doctorPatientsQuerySchema,
  idParamSchema,
  listDoctorsQuerySchema,
  updateDoctorSchema,
} from '@doctor-tracker/shared';
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './doctors.controller';

export const doctorsRouter = Router();

doctorsRouter
  .route('/')
  .get(validate({ query: listDoctorsQuerySchema }), controller.list)
  .post(validate({ body: createDoctorSchema }), controller.create);

doctorsRouter
  .route('/:id')
  .get(validate({ params: idParamSchema }), controller.getOne)
  .patch(validate({ params: idParamSchema, body: updateDoctorSchema }), controller.update)
  .delete(validate({ params: idParamSchema }), controller.remove);

doctorsRouter
  .route('/:id/patients')
  .get(
    validate({ params: idParamSchema, query: doctorPatientsQuerySchema }),
    controller.listPatients,
  )
  .post(validate({ params: idParamSchema, body: createPatientSchema }), controller.addPatient);

doctorsRouter.delete(
  '/:id/patients/:patientId',
  validate({ params: doctorPatientParamsSchema }),
  controller.removePatient,
);
