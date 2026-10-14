/**
 * Stable, machine-readable error codes. Clients branch on `code`, never on `message`.
 * Framework-free on purpose: domain code throws these; the HTTP mapping lives in
 * `common/filters/error-http-status.ts`.
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MALFORMED_JSON = 'MALFORMED_JSON',
  BAD_REQUEST = 'BAD_REQUEST',
  UNSUPPORTED_UNIT = 'UNSUPPORTED_UNIT',
  INVALID_CURSOR = 'INVALID_CURSOR',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
