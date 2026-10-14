import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
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

@Injectable()
export class WorkoutsRepository {
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
