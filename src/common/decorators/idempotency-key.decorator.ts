import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { ValidationError } from '../errors';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_\-:.]{1,128}$/;

export function parseIdempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (IDEMPOTENCY_KEY_PATTERN.test(value)) return value;
  throw new ValidationError(`Invalid ${IDEMPOTENCY_KEY_HEADER} header`, [
    {
      field: IDEMPOTENCY_KEY_HEADER,
      issue: 'must be 1-128 characters: letters, digits, "-", "_", ":" or "."',
    },
  ]);
}

/** `@IdempotencyKey() key: string | undefined` — the optional, validated `Idempotency-Key` header. */
export const IdempotencyKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined =>
    parseIdempotencyKey(ctx.switchToHttp().getRequest<Request>().header(IDEMPOTENCY_KEY_HEADER)),
);
