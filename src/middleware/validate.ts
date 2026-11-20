import type { ApiErrorDetail } from '@doctor-tracker/shared';
import type { RequestHandler } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/api-error';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function zodIssuesToDetails(error: ZodError, prefix?: string): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path].filter((p) => p !== undefined && p !== '').join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates and parses request parts. Parsed values (with defaults, coercion and
 * unknown keys stripped) are written to `res.locals.{body,query,params}`.
 * Controllers must read from `res.locals`, never from the raw request.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    const details: ApiErrorDetail[] = [];

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        res.locals[part] = result.data;
      } else {
        details.push(...zodIssuesToDetails(result.error, part === 'body' ? undefined : part));
      }
    }

    if (details.length > 0) {
      next(ApiError.badRequest('Request validation failed', details));
      return;
    }
    next();
  };
}
