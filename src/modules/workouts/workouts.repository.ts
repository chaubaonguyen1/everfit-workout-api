import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { KeysetCursor } from '../../common/utils';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { Tx } from '../../infrastructure/prisma/transaction-runner';
import type { ExerciseRef } from '../exercises/exercises.repository';
import type { PreparedEntry, PreparedSet } from './domain/prepare-entries';

export interface CreatedEntry {
  readonly id: string;
  readonly exercise: ExerciseRef;
  readonly performedAt: Date;
  readonly timezone: string | null;
  readonly sets: readonly PreparedSet[];
}

export interface HistoryPageQuery {
  readonly exerciseIds?: readonly string[];
  readonly from?: Date;
  readonly to?: Date;
  readonly cursor?: KeysetCursor;
  /** Rows to fetch (callers ask for limit + 1 to detect a next page). */
  readonly take: number;
}

export interface HistoryEntryRow {
  readonly id: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly muscleGroups: string[];
  readonly performedAt: Date;
  readonly timezone: string | null;
}

export interface HistorySetRow {
  readonly entryId: string;
  readonly setIndex: number;
  readonly reps: number;
  readonly weight: number;
  readonly unit: string;
  readonly weightKg: number;
  readonly volumeKg: number;
  readonly e1rmKg: number;
}

@Injectable()
export class WorkoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page of a user's entries, newest first, by keyset on (performed_at, id).
   * The row-value comparison `(performed_at, id) < (…)` lets Postgres seek directly into
   * `workout_entries(user_id, performed_at DESC, id DESC)`, so page N costs the same as page 1
   * (unlike OFFSET) — important at 50k+ entries per user.
   * Instants are passed as ISO strings cast to timestamptz so the session time zone can't skew them.
   */
  findHistoryPage(userId: string, query: HistoryPageQuery): Promise<HistoryEntryRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`e.user_id = ${userId}`];
    if (query.exerciseIds) {
      conditions.push(Prisma.sql`e.exercise_id = ANY(${[...query.exerciseIds]}::uuid[])`);
    }
    if (query.from) {
      conditions.push(Prisma.sql`e.performed_at >= ${query.from.toISOString()}::timestamptz`);
    }
    if (query.to) {
      conditions.push(Prisma.sql`e.performed_at < ${query.to.toISOString()}::timestamptz`);
    }
    if (query.cursor) {
      conditions.push(
        Prisma.sql`(e.performed_at, e.id) < (${query.cursor.performedAt.toISOString()}::timestamptz, ${query.cursor.id}::uuid)`,
      );
    }

    return this.prisma.$queryRaw<HistoryEntryRow[]>`
      SELECT e.id,
             e.exercise_id   AS "exerciseId",
             x.name          AS "exerciseName",
             x.muscle_groups AS "muscleGroups",
             e.performed_at  AS "performedAt",
             e.timezone
        FROM workout_entries e
        JOIN exercises x ON x.id = e.exercise_id
       WHERE ${Prisma.join(conditions, ' AND ')}
       ORDER BY e.performed_at DESC, e.id DESC
       LIMIT ${query.take}`;
  }

  /** Sets of the given entries, in set order (served by the unique (entry_id, set_index) index). */
  async findSetsForEntries(entryIds: readonly string[]): Promise<HistorySetRow[]> {
    if (entryIds.length === 0) return [];
    const rows = await this.prisma.workoutSet.findMany({
      where: { entryId: { in: [...entryIds] } },
      orderBy: [{ entryId: 'asc' }, { setIndex: 'asc' }],
      select: {
        entryId: true,
        setIndex: true,
        reps: true,
        weight: true,
        unit: true,
        weightKg: true,
        volumeKg: true,
        e1rmKg: true,
      },
    });
    // Decimal → number at the repository boundary; values fit comfortably in a double.
    return rows.map((r) => ({
      ...r,
      weight: r.weight.toNumber(),
      weightKg: r.weightKg.toNumber(),
      volumeKg: r.volumeKg.toNumber(),
      e1rmKg: r.e1rmKg.toNumber(),
    }));
  }

  /**
   * Inserts a whole batch with two statements (entries, then sets) regardless of its size.
   * Entry ids are generated here so sets can reference them without a round-trip per entry.
   */
  async insertBatch(
    tx: Tx,
    userId: string,
    timezone: string | null,
    entries: readonly PreparedEntry[],
    exercises: ReadonlyMap<string, ExerciseRef>,
  ): Promise<CreatedEntry[]> {
    const created: CreatedEntry[] = entries.map((entry) => ({
      id: randomUUID(),
      exercise: exerciseFor(entry, exercises),
      performedAt: entry.performedAt,
      timezone,
      sets: entry.sets,
    }));

    await tx.workoutEntry.createMany({
      data: created.map((e) => ({
        id: e.id,
        userId,
        exerciseId: e.exercise.id,
        performedAt: e.performedAt,
        timezone,
      })),
    });

    await tx.workoutSet.createMany({
      data: created.flatMap((e) =>
        e.sets.map((s) => ({
          entryId: e.id,
          setIndex: s.setIndex,
          reps: s.reps,
          weight: s.weight,
          unit: s.unit,
          weightKg: s.weightKg,
          volumeKg: s.volumeKg,
          e1rmKg: s.estimatedOneRepMaxKg,
          userId,
          exerciseId: e.exercise.id,
          performedAt: e.performedAt,
        })),
      ),
    });

    return created;
  }
}

function exerciseFor(
  entry: PreparedEntry,
  exercises: ReadonlyMap<string, ExerciseRef>,
): ExerciseRef {
  const exercise = exercises.get(entry.exercise.normalizedName);
  // resolveIds creates every missing exercise in the same transaction, so this is a bug guard.
  if (!exercise) throw new Error(`Exercise "${entry.exercise.normalizedName}" was not resolved`);
  return exercise;
}
