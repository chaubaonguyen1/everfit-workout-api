import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { escapeLike } from '../../common/utils';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { Tx } from '../../infrastructure/prisma/transaction-runner';
import type { CatalogExercise } from './domain/exercise-catalog';

export interface ExerciseRecord {
  readonly id: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly muscleGroups: readonly string[];
}

export interface ExerciseRef {
  readonly id: string;
  /** Canonical display name (as first defined in the catalog or first logged). */
  readonly name: string;
}

const EXERCISE_SELECT = { id: true, name: true, normalizedName: true, muscleGroups: true } as const;

@Injectable()
export class ExercisesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Makes the DB mapping match the catalog exactly, atomically: catalog exercises are upserted,
   * and exercises that were removed from the catalog lose their muscle groups (they are kept,
   * since logged workouts reference them).
   */
  async syncCatalog(exercises: readonly CatalogExercise[]): Promise<void> {
    const names = exercises.map((e) => e.normalizedName);

    await this.prisma.$transaction([
      ...exercises.map(({ name, normalizedName, muscleGroups }) =>
        this.prisma.exercise.upsert({
          where: { normalizedName },
          create: { name, normalizedName, muscleGroups: [...muscleGroups] },
          update: { name, muscleGroups: [...muscleGroups] },
        }),
      ),
      this.prisma.exercise.updateMany({
        where: { normalizedName: { notIn: names }, NOT: { muscleGroups: { isEmpty: true } } },
        data: { muscleGroups: [] },
      }),
    ]);
  }

  /**
   * Returns ids for the given exercises, creating the missing ones. Race-safe without locks in
   * application code: `ON CONFLICT DO NOTHING` lets concurrent requests creating the same new
   * exercise both succeed, and the follow-up read sees whichever row won.
   * Pass exercises sorted by normalizedName so concurrent batches acquire row locks in one order.
   */
  async resolveIds(
    tx: Tx,
    exercises: readonly { name: string; normalizedName: string }[],
  ): Promise<Map<string, ExerciseRef>> {
    if (exercises.length === 0) return new Map();

    await tx.exercise.createMany({
      data: exercises.map(({ name, normalizedName }) => ({ name, normalizedName })),
      skipDuplicates: true,
    });
    const rows = await tx.exercise.findMany({
      where: { normalizedName: { in: exercises.map((e) => e.normalizedName) } },
      select: { id: true, name: true, normalizedName: true },
    });
    return new Map(rows.map((r) => [r.normalizedName, { id: r.id, name: r.name }]));
  }

  /**
   * Ids of exercises whose normalized name contains `term` and/or that train `muscleGroup`.
   * LIKE wildcards in the term are escaped; the trigram index serves the substring match.
   */
  async findIdsMatching(filter: { term?: string; muscleGroup?: string }): Promise<string[]> {
    const conditions: Prisma.Sql[] = [];
    if (filter.term) {
      conditions.push(Prisma.sql`normalized_name LIKE ${`%${escapeLike(filter.term)}%`}`);
    }
    if (filter.muscleGroup) {
      conditions.push(Prisma.sql`muscle_groups @> ARRAY[${filter.muscleGroup}]::text[]`);
    }
    if (conditions.length === 0) return [];

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM exercises WHERE ${Prisma.join(conditions, ' AND ')}`;
    return rows.map((r) => r.id);
  }

  findByNormalizedName(normalizedName: string): Promise<ExerciseRef | null> {
    return this.prisma.exercise.findUnique({
      where: { normalizedName },
      select: { id: true, name: true },
    });
  }

  findAll(): Promise<ExerciseRecord[]> {
    return this.prisma.exercise.findMany({ select: EXERCISE_SELECT, orderBy: { name: 'asc' } });
  }
}
