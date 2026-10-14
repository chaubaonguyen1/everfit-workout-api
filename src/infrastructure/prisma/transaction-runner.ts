import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isRetryablePrismaError } from '../../common/helpers/prisma-error.helper';
import { PrismaService } from './prisma.service';

/** Client to pass to repositories so their queries join the surrounding transaction. */
export type Tx = Prisma.TransactionClient;

export interface TransactionOptions {
  /** Extra attempts after a write conflict / deadlock (P2034). */
  readonly retries?: number;
  readonly timeoutMs?: number;
}

/**
 * Unit of work for services: runs a callback in one interactive transaction and retries it on
 * transient write conflicts. Services depend on this instead of PrismaService, so they never
 * build queries themselves — repositories receive the `tx` client.
 */
@Injectable()
export class TransactionRunner {
  private readonly logger = new Logger(TransactionRunner.name);

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(work: (tx: Tx) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    const { retries = 2, timeoutMs = 10_000 } = options;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, { timeout: timeoutMs, maxWait: 5_000 });
      } catch (error) {
        if (attempt >= retries || !isRetryablePrismaError(error)) throw error;
        this.logger.warn({ attempt: attempt + 1 }, 'Retrying transaction after write conflict');
      }
    }
  }
}
