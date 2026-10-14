import { Prisma } from '@prisma/client';
import { DomainError, ErrorCode } from '../errors';

/** Prisma error codes that indicate a transient conflict worth retrying the transaction for. */
export const RETRYABLE_PRISMA_CODES: ReadonlySet<string> = new Set(['P2034']);

/**
 * Translates known database failures into domain errors with client-safe messages, so they
 * surface as 4xx/503 with a stable code instead of an opaque 500. Returns `undefined` for
 * anything unrecognized (the caller treats it as unexpected).
 * Prisma's own messages are never forwarded: they can contain SQL, table and column names.
 */
export function mapPrismaError(error: unknown): DomainError | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
        return new DomainError(ErrorCode.VALIDATION_ERROR, 'A value is too long for its field');
      case 'P2002':
        return new DomainError(
          ErrorCode.CONFLICT,
          'A resource with the same identity already exists',
        );
      case 'P2003':
        return new DomainError(ErrorCode.VALIDATION_ERROR, 'A referenced resource does not exist');
      case 'P2025':
        return new DomainError(ErrorCode.NOT_FOUND, 'Resource not found');
      case 'P2024':
        return new DomainError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'The database is busy, please retry shortly',
        );
      case 'P2028':
        // Transaction API error, typically the interactive transaction timing out while waiting
        // (e.g. behind a concurrent request holding the same idempotency key).
        return new DomainError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'The request could not be completed in time, please retry',
        );
      case 'P2034':
        return new DomainError(ErrorCode.CONFLICT, 'Concurrent write conflict, please retry');
      default:
        return undefined;
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'The database is unavailable');
  }

  return undefined;
}

export function isRetryablePrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_PRISMA_CODES.has(error.code)
  );
}
