import { HttpException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DomainError, ErrorCode } from '../errors';

/** Shape of errors raised by Express' body-parser (http-errors with a `type` and `status`). */
interface BodyParserError {
  readonly type: string;
  readonly status?: number;
  readonly message: string;
}

const BODY_PARSER_ERRORS: Readonly<Record<string, { code: ErrorCode; message: string }>> = {
  'entity.parse.failed': {
    code: ErrorCode.MALFORMED_JSON,
    message: 'Request body is not valid JSON',
  },
  'entity.too.large': { code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Request body is too large' },
};

/**
 * Express error middleware registered right after the JSON body parser.
 *
 * Why: Nest's router maps every `SyntaxError` to a generic `BadRequestException`, dropping the
 * body-parser `type`, so the global filter could not tell "malformed JSON" from other 400s.
 * Translating here, before Nest sees the error, keeps a precise error code. Other body-parser
 * client errors (unsupported charset/encoding, aborted request) keep their own 4xx status
 * instead of surfacing as 500s.
 */
export function bodyParserErrorMiddleware(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!isBodyParserError(err)) return next(err);

  const mapped = BODY_PARSER_ERRORS[err.type];
  if (mapped) return next(new DomainError(mapped.code, mapped.message));

  const isClientError = err.status !== undefined && err.status >= 400 && err.status < 500;
  next(isClientError ? new HttpException(err.message, err.status as number) : err);
}

function isBodyParserError(value: unknown): value is BodyParserError {
  return typeof value === 'object' && value !== null && 'type' in value;
}
