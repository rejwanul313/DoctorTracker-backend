import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/require-auth';
import { authRouter } from '../modules/auth/auth.routes';
import { doctorsRouter } from '../modules/doctors/doctors.routes';
import { metaRouter } from '../modules/meta/meta.routes';
import { patientsRouter } from '../modules/patients/patients.routes';
import { statsRouter } from '../modules/stats/stats.routes';

export const apiRouter = Router();

// --- Public ---
apiRouter.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' },
  });
});
apiRouter.use('/auth', authRouter);

// --- Protected: everything below requires an authenticated admin ---
apiRouter.use(requireAuth, requireRole('admin'));
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/meta', metaRouter);
apiRouter.use('/stats', statsRouter);
