import { ErrorCode } from './error-codes';

export interface ErrorDetail {
  /** Dot/bracket path to the offending input, e.g. `entries[0].sets[1].weight`. */
  readonly field?: string;
  readonly issue: string;
}

/**
 * Base error for every expected failure. It carries a code instead of an HTTP status
 * so services stay transport-agnostic; the global filter maps code → status.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: readonly ErrorDetail[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(ErrorCode.NOT_FOUND, message);
  }
}
