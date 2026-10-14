import { Prisma } from '@prisma/client';
import { ErrorCode } from '../errors';
import { isRetryablePrismaError, mapPrismaError } from './prisma-error.helper';

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('SELECT secret FROM "internal_table"', {
    code,
    clientVersion: 'test',
  });

describe('mapPrismaError', () => {
  it.each([
    ['P2000', ErrorCode.VALIDATION_ERROR],
    ['P2028', ErrorCode.SERVICE_UNAVAILABLE],
    ['P2002', ErrorCode.CONFLICT],
    ['P2003', ErrorCode.VALIDATION_ERROR],
    ['P2025', ErrorCode.NOT_FOUND],
    ['P2024', ErrorCode.SERVICE_UNAVAILABLE],
    ['P2034', ErrorCode.CONFLICT],
  ])('maps %s to %s', (code, expected) => {
    expect(mapPrismaError(known(code))?.code).toBe(expected);
  });

  it('never forwards the raw Prisma message (may contain SQL / table names)', () => {
    expect(mapPrismaError(known('P2002'))?.message).not.toMatch(/internal_table|SELECT/);
  });

  it('maps "cannot reach database" to SERVICE_UNAVAILABLE', () => {
    const error = new Prisma.PrismaClientInitializationError("Can't reach database", 'test');

    expect(mapPrismaError(error)?.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('returns undefined for unknown codes and non-Prisma errors', () => {
    expect(mapPrismaError(known('P9999'))).toBeUndefined();
    expect(mapPrismaError(new Error('boom'))).toBeUndefined();
  });
});

describe('isRetryablePrismaError', () => {
  it('is true only for transaction write conflicts / deadlocks', () => {
    expect(isRetryablePrismaError(known('P2034'))).toBe(true);
    expect(isRetryablePrismaError(known('P2002'))).toBe(false);
    expect(isRetryablePrismaError(new Error('x'))).toBe(false);
  });
});
