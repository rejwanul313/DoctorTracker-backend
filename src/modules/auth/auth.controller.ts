import type { LoginInput } from '@doctor-tracker/shared';
import type { Request, Response } from 'express';
import * as authService from './auth.service';

export async function login(_req: Request, res: Response) {
  const data = await authService.login(res.locals.body as LoginInput);
  res.json({ success: true, data });
}

export async function me(_req: Request, res: Response) {
  const data = await authService.getCurrentUser(res.locals.user!.id);
  res.json({ success: true, data });
}
