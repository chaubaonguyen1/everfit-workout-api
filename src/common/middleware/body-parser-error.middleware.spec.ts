import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, ErrorCode } from '../errors';
import { bodyParserErrorMiddleware } from './body-parser-error.middleware';

describe('bodyParserErrorMiddleware', () => {
  const run = (err: unknown) => {
    const next = jest.fn();
    bodyParserErrorMiddleware(err, {} as Request, {} as Response, next);
    return next.mock.calls[0][0];
  };

  it.each([
    ['entity.parse.failed', ErrorCode.MALFORMED_JSON],
    ['entity.too.large', ErrorCode.PAYLOAD_TOO_LARGE],
  ])('translates body-parser "%s" into a DomainError with code %s', (type, code) => {
    const forwarded = run(Object.assign(new SyntaxError('boom'), { type }));

    expect(forwarded).toBeInstanceOf(DomainError);
    expect(forwarded.code).toBe(code);
  });

  it('keeps the 4xx status of other body-parser client errors (e.g. unsupported charset → 415)', () => {
    const forwarded = run(
      Object.assign(new Error('unsupported charset "UTF-7"'), {
        type: 'charset.unsupported',
        status: 415,
      }),
    );

    expect(forwarded).toBeInstanceOf(HttpException);
    expect(forwarded.getStatus()).toBe(415);
  });

  it('forwards unrelated errors untouched', () => {
    const original = new Error('something else');

    expect(run(original)).toBe(original);
  });
});
