import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../infrastructure/prisma/transaction-runner';
import { ExercisesService } from '../exercises/exercises.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { resolveHistoryFilters } from './domain/history-filters';
import { distinctExercises, prepareEntries } from './domain/prepare-entries';
import { CreateWorkoutsDto } from './dto/create-workouts.dto';
import { LoggedWorkoutsResponse } from './dto/logged-workouts.response';
import { WorkoutHistoryQuery } from './dto/workout-history.query';
import { WorkoutHistoryResponse } from './dto/workout-history.response';
import { toLoggedWorkoutsResponse, toWorkoutHistoryResponse } from './workouts.mapper';
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
   * A page of the user's workout history, newest first. Exercise filters (name / muscle group)
   * are resolved to exercise ids first, against the small exercises table, so the entries query
   * stays a single index-ordered scan of the user's rows.
   */
  async getHistory(userId: string, query: WorkoutHistoryQuery): Promise<WorkoutHistoryResponse> {
    const filters = resolveHistoryFilters(query, this.exercises.muscleGroups);
    const page = { limit: filters.limit, unit: query.unit, cursorScope: filters.cursorScope };

    let exerciseIds: string[] | undefined;
    if (filters.exerciseTerm || filters.muscleGroup) {
      exerciseIds = await this.exercises.findIdsMatching(userId, {
        term: filters.exerciseTerm,
        muscleGroup: filters.muscleGroup,
      });
      if (exerciseIds.length === 0) {
        return toWorkoutHistoryResponse({ ...page, rows: [], sets: [] });
      }
    }

    const rows = await this.repository.findHistoryPage(userId, {
      exerciseIds,
      from: filters.from,
      to: filters.to,
      cursor: filters.cursor,
      take: filters.limit + 1,
    });
    const sets = await this.repository.findSetsForEntries(
      rows.slice(0, filters.limit).map((r) => r.id),
    );
    return toWorkoutHistoryResponse({ ...page, rows, sets });
  }

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
    // Stored as sent: the runtime's "canonical" ids are legacy CLDR names (Asia/Saigon for
    // Asia/Ho_Chi_Minh), which would surprise clients; every spelling resolves identically.
    const timeZone = dto.timezone;
    const prepared = prepareEntries(dto.entries, { timeZone, now: new Date() });
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
        timeZone ?? null,
        prepared,
        exercises,
      );
      const response = toLoggedWorkoutsResponse(created);

      if (idempotencyKey) await this.idempotency.complete(tx, userId, idempotencyKey, response);
      return { response, replayed: false };
    });
  }
}
