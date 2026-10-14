import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, ErrorCode } from '../../common/errors';
import { stableStringify } from '../../common/utils';
import type { Tx } from '../../infrastructure/prisma/transaction-runner';
import { IdempotencyRepository } from './idempotency.repository';

export type IdempotencyClaim<T> =
  { readonly kind: 'claimed' } | { readonly kind: 'replay'; readonly response: T };

/**
 * Exactly-once semantics for retried writes: the first request with a key does the work and
 * stores its response in the same transaction; retries with the same body get that response
 * back, retries with a different body are rejected.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly repository: IdempotencyRepository) {}

  fingerprint(body: unknown): string {
    return createHash('sha256').update(stableStringify(body)).digest('hex');
  }

  async claim<T>(
    tx: Tx,
    userId: string,
    key: string,
    requestHash: string,
  ): Promise<IdempotencyClaim<T>> {
    if (await this.repository.tryClaim(tx, userId, key, requestHash)) return { kind: 'claimed' };

    const existing = await this.repository.find(tx, userId, key);
    if (!existing || existing.responseBody === null) {
      // Not reachable with the claim-then-commit flow; kept as a safe failure mode.
      throw new DomainError(
        ErrorCode.CONFLICT,
        'A request with this Idempotency-Key is in progress',
      );
    }
    if (existing.requestHash !== requestHash) {
      throw new DomainError(
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
        'This Idempotency-Key was already used with a different request body',
      );
    }
    return { kind: 'replay', response: existing.responseBody as T };
  }

  complete(tx: Tx, userId: string, key: string, response: object): Promise<void> {
    return this.repository.saveResponse(tx, userId, key, response as Prisma.InputJsonValue);
  }
}
