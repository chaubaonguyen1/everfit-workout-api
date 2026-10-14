import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../errors';

/** Transport mapping for domain error codes (kept out of `common/errors` so it stays framework-free). */
export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, HttpStatus>> = {
  [ErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ErrorCode.MALFORMED_JSON]: HttpStatus.BAD_REQUEST,
  [ErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNSUPPORTED_UNIT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_CURSOR]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_DATE_RANGE]: HttpStatus.BAD_REQUEST,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PAYLOAD_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

/**
 * Code for a framework-raised HTTP status. Unlisted statuses fall back by range so that a
 * client error (405, 415, 429…) is never reported as INTERNAL_ERROR.
 */
export function codeForHttpStatus(status: number): ErrorCode {
  const exact = STATUS_TO_CODE[status];
  if (exact) return exact;
  return status >= 400 && status < 500 ? ErrorCode.BAD_REQUEST : ErrorCode.INTERNAL_ERROR;
}
