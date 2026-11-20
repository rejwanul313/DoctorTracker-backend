import { loginSchema } from '@doctor-tracker/shared';
import { Router } from 'express';
import { loginRateLimiter } from '../../middleware/rate-limit';
import { requireAuth } from '../../middleware/require-auth';
import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), controller.login);
authRouter.get('/me', requireAuth, controller.me);
