import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, createAdmin, request } from './helpers';

describe('GET /api/v1/health', () => {
  it('is public and reports DB status', async () => {
    const res = await request.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', db: 'up' });
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns a token and the user (without password hash) for valid credentials', async () => {
    await createAdmin('admin@test.dev');
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'ADMIN@test.dev', password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: 'admin@test.dev', role: 'admin' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.expiresAt).toBeGreaterThan(Date.now());
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    await createAdmin('admin@test.dev');
    const wrongPassword = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.dev', password: 'wrong-password' });
    const unknownEmail = await request
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.dev', password: 'wrong-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('validates the body', async () => {
    const res = await request.post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user', async () => {
    const { auth } = await createAdmin();
    const res = await request.get('/api/v1/auth/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@test.dev');
  });

  it('requires a token', async () => {
    const res = await request.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  });
});

describe('protected routes', () => {
  it.each([
    '/api/v1/doctors',
    '/api/v1/patients',
    '/api/v1/stats/overview',
    '/api/v1/meta/filters',
  ])('%s returns 401 without a token', async (path) => {
    expect((await request.get(path)).status).toBe(401);
  });

  it('unknown routes return a 404 envelope', async () => {
    const { auth } = await createAdmin();
    const res = await request.get('/api/v1/nope').set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
