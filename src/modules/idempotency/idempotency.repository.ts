import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Tx } from '../../infrastructure/prisma/transaction-runner';

export interface StoredIdempotencyKey {
  readonly requestHash: string;
  readonly responseBody: Prisma.JsonValue | null;
}

@Injectable()
export class IdempotencyRepository {
  /**
   * `INSERT … ON CONFLICT DO NOTHING`. If another transaction holds an uncommitted row for the
   * same key, Postgres blocks here until it commits (→ returns false) or rolls back (→ inserts).
   * @returns true when this transaction now owns the key.
   */
  async tryClaim(tx: Tx, userId: string, key: string, requestHash: string): Promise<boolean> {
    const { count } = await tx.idempotencyKey.createMany({
      data: [{ userId, key, requestHash }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  find(tx: Tx, userId: string, key: string): Promise<StoredIdempotencyKey | null> {
    return tx.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
      select: { requestHash: true, responseBody: true },
    });
  }

  async saveResponse(
    tx: Tx,
    userId: string,
    key: string,
    responseBody: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.idempotencyKey.update({
      where: { userId_key: { userId, key } },
      data: { responseBody },
    });
  }
}
