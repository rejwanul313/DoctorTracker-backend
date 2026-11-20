import { ERROR_CODES, type ApiErrorBody } from '@doctor-tracker/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/api-error';
import { zodIssuesToDetails } from './validate';

interface MongoServerErrorLike {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoServerErrorLike {
  return (
    typeof error === 'object' && error !== null && (error as MongoServerErrorLike).code === 11000
  );
}

/** Normalizes any thrown value into an ApiError so the response shape is always the same. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.badRequest('Validation failed', zodIssuesToDetails(error));
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${error.path}"`, [
      { path: error.path, message: 'Invalid value' },
    ]);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest(
      'Validation failed',
      Object.values(error.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  }

  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? 'field';
    return field === 'email'
      ? ApiError.conflict(ERROR_CODES.DUPLICATE_EMAIL, 'A record with this email already exists')
      : ApiError.conflict(ERROR_CODES.CONFLICT, `Duplicate value for "${field}"`);
  }

  // Malformed JSON body from express.json()
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { type?: string }).type === 'entity.parse.failed'
  ) {
    return ApiError.badRequest('Malformed JSON body');
  }

  return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong');
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const apiError = toApiError(error);

  if (apiError.status >= 500) {
    logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Unhandled error');
  }

  const body: ApiErrorBody = {
    success: false,
    error: {
      code: apiError.code,
      // Never leak internals for unexpected errors in production.
      message:
        apiError.status >= 500 && !isProduction && error instanceof Error
          ? error.message
          : apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  };
  res.status(apiError.status).json(body);
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, ERROR_CODES.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
};
