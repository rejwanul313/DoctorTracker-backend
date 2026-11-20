import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../utils/api-error';
import { errorHandler, notFoundHandler, toApiError } from './error-handler';

describe('toApiError', () => {
  it('passes ApiError through unchanged', () => {
    const error = ApiError.notFound('Doctor');
    expect(toApiError(error)).toBe(error);
  });

  it('maps ZodError to 400 with details', () => {
    const result = z.object({ a: z.string() }).safeParse({});
    const apiError = toApiError(result.error);
    expect(apiError.status).toBe(400);
    expect(apiError.details?.[0]?.path).toBe('a');
  });

  it('maps CastError to 400', () => {
    const cast = new mongoose.Error.CastError('ObjectId', 'bad', '_id');
    expect(toApiError(cast)).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('maps Mongoose ValidationError to 400 with per-field details', () => {
    const doc = new (mongoose.model(
      'ErrTest',
      new mongoose.Schema({ n: { type: String, required: true } }),
    ))();
    const validationError = doc.validateSync()!;
    expect(toApiError(validationError).details).toEqual([
      { path: 'n', message: expect.any(String) },
    ]);
  });

  it('maps duplicate email to 409 DUPLICATE_EMAIL', () => {
    expect(toApiError({ code: 11000, keyPattern: { email: 1 } })).toMatchObject({
      status: 409,
      code: 'DUPLICATE_EMAIL',
    });
  });

  it('maps other duplicate keys to 409 CONFLICT', () => {
    expect(toApiError({ code: 11000, keyPattern: { slug: 1 } }).code).toBe('CONFLICT');
  });

  it('maps malformed JSON to 400', () => {
    expect(toApiError({ type: 'entity.parse.failed' }).status).toBe(400);
  });

  it('maps unknown errors to 500 INTERNAL_ERROR', () => {
    expect(toApiError(new Error('boom'))).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
});

describe('errorHandler', () => {
  function mockRes() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  it('responds with the standard error envelope', () => {
    const res = mockRes();
    errorHandler(
      ApiError.badRequest('Bad', [{ path: 'x', message: 'y' }]),
      { method: 'GET', originalUrl: '/' } as Request,
      res as unknown as Response,
      vi.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Bad', details: [{ path: 'x', message: 'y' }] },
    });
  });
});

describe('notFoundHandler', () => {
  it('forwards a 404 ApiError', () => {
    const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
    notFoundHandler({ method: 'GET', path: '/nope' } as Request, {} as Response, next);
    expect(next.mock.calls[0]![0]).toMatchObject({
      status: 404,
      message: 'Route GET /nope not found',
    });
  });
});
