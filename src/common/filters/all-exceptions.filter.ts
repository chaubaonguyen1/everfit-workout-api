import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, ErrorCode, ErrorDetail } from '../errors';
import { ERROR_HTTP_STATUS, codeForHttpStatus } from './error-http-status';

export interface ErrorResponseBody {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: readonly ErrorDetail[];
  };
  readonly requestId?: string;
}

interface NormalizedError {
  readonly status: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details: readonly ErrorDetail[];
}

/**
 * Single place that turns any thrown value into the public error contract:
 * `{ error: { code, message, details? }, requestId }`.
 * Unexpected errors are logged with stack and returned as an opaque 500 (no internals leaked).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();

    const normalized = this.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, method: request.method, url: request.url },
        'Unhandled error while processing request',
      );
    }

    const body: ErrorResponseBody = {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details.length > 0 && { details: normalized.details }),
      },
      requestId: request.id,
    };

    response.status(normalized.status).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof DomainError) {
      return {
        status: ERROR_HTTP_STATUS[exception.code],
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: codeForHttpStatus(status),
        message: exception.message,
        details: [],
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: [],
    };
  }
}
