import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../utils/api-error';
import { validate } from './validate';

function run(middleware: ReturnType<typeof validate>, req: Partial<Request>) {
  const res = { locals: {} } as Response;
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  middleware(req as Request, res, next);
  return { res, next };
}

const schemas = {
  params: z.object({ id: z.string().length(3) }),
  query: z.object({ page: z.coerce.number().default(1) }),
  body: z.object({ name: z.string().min(2) }),
};

describe('validate()', () => {
  it('writes parsed values to res.locals and calls next() with no error', () => {
    const { res, next } = run(validate(schemas), {
      params: { id: 'abc' },
      query: { page: '2', extra: 'stripped' },
      body: { name: 'Ada', role: 'hacker' },
    });

    expect(next).toHaveBeenCalledWith();
    expect(res.locals.params).toEqual({ id: 'abc' });
    expect(res.locals.query).toEqual({ page: 2 });
    expect(res.locals.body).toEqual({ name: 'Ada' }); // unknown keys stripped
  });

  it('collects issues from every part into one 400 ApiError', () => {
    const { next } = run(validate(schemas), {
      params: { id: 'toolong' },
      query: {},
      body: { name: 'A' },
    });

    const error = next.mock.calls[0]![0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((d) => d.path)).toEqual(['params.id', 'name']);
  });

  it('treats a missing body as an empty object', () => {
    const { next } = run(validate({ body: schemas.body }), {});
    expect((next.mock.calls[0]![0] as ApiError).details?.[0]?.path).toBe('name');
  });
});
