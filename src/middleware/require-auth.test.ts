import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { signAccessToken } from '../modules/auth/auth.service';
import { ApiError } from '../utils/api-error';
import { requireAuth, requireRole } from './require-auth';

function callRequireAuth(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = { locals: {} } as Response;
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  requireAuth(req, res, next);
  return { res, next, error: next.mock.calls[0]?.[0] as ApiError | undefined };
}

describe('requireAuth', () => {
  it('rejects requests without a bearer token', () => {
    expect(callRequireAuth().error?.status).toBe(401);
    expect(callRequireAuth('Basic abc').error?.status).toBe(401);
  });

  it('rejects tokens signed with another secret', () => {
    const forged = jwt.sign({ role: 'admin' }, 'another-secret-another-secret-12345', {
      subject: 'u1',
    });
    const { error } = callRequireAuth(`Bearer ${forged}`);
    expect(error?.message).toBe('Invalid token');
  });

  it('rejects expired tokens with a specific message', () => {
    const expired = jwt.sign(
      { role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_SECRET,
      {
        subject: 'u1',
      },
    );
    expect(callRequireAuth(`Bearer ${expired}`).error?.message).toMatch(/expired/i);
  });

  it('rejects tokens with an unknown role', () => {
    const token = jwt.sign({ role: 'superuser' }, env.JWT_SECRET, { subject: 'u1' });
    expect(callRequireAuth(`Bearer ${token}`).error?.status).toBe(401);
  });

  it('accepts a valid token and exposes the user', () => {
    const { token } = signAccessToken({ id: 'user-1', role: 'admin' });
    const { res, next } = callRequireAuth(`Bearer ${token}`);
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.user).toEqual({ id: 'user-1', role: 'admin' });
  });
});

describe('requireRole', () => {
  const run = (user?: Response['locals']['user']) => {
    const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
    requireRole('admin')({} as Request, { locals: { user } } as unknown as Response, next);
    return next.mock.calls[0]?.[0] as ApiError | undefined;
  };

  it('allows matching roles', () => {
    expect(run({ id: '1', role: 'admin' })).toBeUndefined();
  });

  it('returns 401 when unauthenticated', () => {
    expect(run(undefined)?.status).toBe(401);
  });

  it('returns 403 for other roles', () => {
    expect(run({ id: '1', role: 'viewer' as never })?.status).toBe(403);
  });
});
