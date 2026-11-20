import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const base = {
  MONGODB_URI: 'mongodb://localhost/test',
  JWT_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(base);
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 5000, JWT_EXPIRES_IN: '1d' });
    expect(env.CLIENT_ORIGIN).toEqual(['http://localhost:3000']);
  });

  it('splits comma-separated client origins', () => {
    const env = parseEnv({ ...base, CLIENT_ORIGIN: 'http://a.com, https://b.com ,' });
    expect(env.CLIENT_ORIGIN).toEqual(['http://a.com', 'https://b.com']);
  });

  it('rejects a short JWT secret with a readable message', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('requires MONGODB_URI', () => {
    expect(() => parseEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(/MONGODB_URI/);
  });
});
