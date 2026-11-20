import { CONDITIONS, SPECIALIZATIONS, type FilterOptionsDTO } from '@doctor-tracker/shared';
import { Router } from 'express';
import { Doctor } from '../../models/doctor.model';

export const metaRouter = Router();

/** Options for filter dropdowns. Hospitals come from data (DISTINCT_SCAN on the hospital index). */
metaRouter.get('/filters', async (_req, res) => {
  const hospitals = ((await Doctor.distinct('hospital')) as string[]).sort((a, b) =>
    a.localeCompare(b),
  );
  const data: FilterOptionsDTO = {
    specializations: [...SPECIALIZATIONS],
    conditions: [...CONDITIONS],
    hospitals,
  };
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ success: true, data });
});
