import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../infrastructure/prisma/transaction-runner';
import { ExercisesService } from '../exercises/exercises.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { distinctExercises, prepareEntries } from './domain/prepare-entries';
import { CreateWorkoutsDto } from './dto/create-workouts.dto';
import { LoggedWorkoutsResponse } from './dto/logged-workouts.response';
import { toLoggedWorkoutsResponse } from './workouts.mapper';
import { WorkoutsRepository } from './workouts.repository';

export interface LogWorkoutsResult {
  readonly response: LoggedWorkoutsResponse;
  /** True when the response was replayed from a previous request with the same Idempotency-Key. */
  readonly replayed: boolean;
}

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: WorkoutsRepository,
    private readonly exercises: ExercisesService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Logs a batch of entries atomically: either every entry and set is stored, or none is.
   * With an idempotency key, the key is claimed in the same transaction, so a retry (even a
   * concurrent one) returns the original response instead of creating duplicates.
   */
  async logWorkouts(
    userId: string,
    dto: CreateWorkoutsDto,
    idempotencyKey?: string,
  ): Promise<LogWorkoutsResult> {
    // Pure validation/normalization first: invalid batches never open a transaction.
    const prepared = prepareEntries(dto.entries, { timeZone: dto.timezone, now: new Date() });
    const requestHash = idempotencyKey ? this.idempotency.fingerprint(dto) : undefined;

    return this.transactions.run(async (tx) => {
      if (idempotencyKey && requestHash) {
        const claim = await this.idempotency.claim<LoggedWorkoutsResponse>(
          tx,
          userId,
          idempotencyKey,
          requestHash,
        );
        if (claim.kind === 'replay') return { response: claim.response, replayed: true };
      }

      const exercises = await this.exercises.resolveIds(tx, distinctExercises(prepared));
      const created = await this.repository.insertBatch(
        tx,
        userId,
        dto.timezone ?? null,
        prepared,
        exercises,
      );
      const response = toLoggedWorkoutsResponse(created);

      if (idempotencyKey) await this.idempotency.complete(tx, userId, idempotencyKey, response);
      return { response, replayed: false };
    });
  }
}
