import { NodeEnv, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('applies defaults for optional variables', () => {
    const env = validateEnv(base);

    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      PORT: 3000,
      LOG_LEVEL: 'info',
      SLOW_QUERY_MS: 200,
    });
  });

  it('coerces numeric strings coming from process.env', () => {
    const env = validateEnv({ ...base, PORT: '8080', SLOW_QUERY_MS: '50' });

    expect(env.PORT).toBe(8080);
    expect(env.SLOW_QUERY_MS).toBe(50);
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects unknown log levels and out-of-range ports, listing every issue', () => {
    expect(() => validateEnv({ ...base, LOG_LEVEL: 'verbose', PORT: '70000' })).toThrow(
      /LOG_LEVEL[\s\S]*PORT|PORT[\s\S]*LOG_LEVEL/,
    );
  });
});
