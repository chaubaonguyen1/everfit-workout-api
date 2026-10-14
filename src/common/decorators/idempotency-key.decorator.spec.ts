import { ValidationError } from '../errors';
import { parseIdempotencyKey } from './idempotency-key.decorator';

describe('parseIdempotencyKey', () => {
  it('is optional', () => {
    expect(parseIdempotencyKey(undefined)).toBeUndefined();
  });

  it.each(['a', '0b1f6c3e-8a2d-4f7e-9c1a-2b3c4d5e6f70', 'client:42.retry_1'])(
    'accepts %p',
    (key) => {
      expect(parseIdempotencyKey(key)).toBe(key);
    },
  );

  it.each(['', 'has space', 'x'.repeat(129), 'quote"s'])('rejects %p', (key) => {
    expect(() => parseIdempotencyKey(key)).toThrow(ValidationError);
  });
});
