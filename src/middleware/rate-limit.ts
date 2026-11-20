import { ERROR_CODES, type ApiErrorBody } from '@doctor-tracker/shared';
import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const rateLimitedBody: ApiErrorBody = {
  success: false,
  error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many attempts, please try again later' },
};

/** Brute-force protection for the login endpoint: 10 attempts / 15 min / IP. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isTest,
  message: rateLimitedBody,
});

/** Coarse global limiter for the whole API. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  message: rateLimitedBody,
});
