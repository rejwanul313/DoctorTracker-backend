import { USER_ROLES, type UserRole } from '@doctor-tracker/shared';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: UserRole;
}

function isAccessTokenPayload(payload: string | jwt.JwtPayload): payload is AccessTokenPayload {
  return (
    typeof payload === 'object' &&
    typeof payload.sub === 'string' &&
    USER_ROLES.includes(payload.role as UserRole)
  );
}

/** Verifies `Authorization: Bearer <jwt>` and exposes the caller as `res.locals.user`. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized());
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!isAccessTokenPayload(payload)) throw new Error('Malformed token payload');
    res.locals.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError;
    next(
      ApiError.unauthorized(expired ? 'Session expired, please sign in again' : 'Invalid token'),
    );
  }
};

/** Authorization guard. Must run after `requireAuth`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.user;
    if (!user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(user.role)) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
}
