import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DateRange } from '../../common/utils';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toWeightUnit } from '../units/domain/weight-unit.registry';
import type { StoredSet } from '../workouts/domain/present-set';

export type RecordMetric = 'weight' | 'volume' | 'e1rm';

export interface RecordSetRow extends StoredSet {
  readonly entryId: string;
  readonly setIndex: number;
  readonly performedAt: Date;
}

export type RecordRows = Partial<Record<RecordMetric, RecordSetRow>>;

interface RawRecordRow extends Omit<RecordSetRow, 'unit'> {
  readonly metric: RecordMetric;
  readonly unit: string;
}

/** Order for each record: best value, then the FIRST time it was achieved, then id (total order). */
const ORDER_BY: Readonly<Record<RecordMetric, Prisma.Sql>> = {
  weight: Prisma.sql`s.weight_kg DESC, s.performed_at ASC, s.id ASC`,
  volume: Prisma.sql`s.volume_kg DESC, s.performed_at ASC, s.id ASC`,
  e1rm: Prisma.sql`s.e1rm_kg DESC, s.performed_at ASC, s.id ASC`,
};

@Injectable()
export class PersonalRecordsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The record-holding set for each metric, in one round trip. Each branch is
   * `ORDER BY <metric> DESC, performed_at, id LIMIT 1`, matching the
   * `workout_sets_pr_<metric>_idx` indexes exactly, so an all-time PR reads a single index entry
   * no matter how many sets the user has. Metrics were computed at write time, so nothing is
   * aggregated here.
   */
  async findRecords(userId: string, exerciseId: string, range: DateRange): Promise<RecordRows> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.user_id = ${userId}`,
      Prisma.sql`s.exercise_id = ${exerciseId}::uuid`,
    ];
    if (range.from) {
      conditions.push(Prisma.sql`s.performed_at >= ${range.from.toISOString()}::timestamptz`);
    }
    if (range.to) {
      conditions.push(Prisma.sql`s.performed_at < ${range.to.toISOString()}::timestamptz`);
    }
    const where = Prisma.join(conditions, ' AND ');

    const branch = (metric: RecordMetric) => Prisma.sql`(
      SELECT ${metric}::text      AS metric,
             s.entry_id          AS "entryId",
             s.set_index::int    AS "setIndex",
             s.reps,
             s.weight::float8    AS weight,
             s.unit,
             s.weight_kg::float8 AS "weightKg",
             s.volume_kg::float8 AS "volumeKg",
             s.e1rm_kg::float8   AS "e1rmKg",
             s.performed_at      AS "performedAt"
        FROM workout_sets s
       WHERE ${where}
       ORDER BY ${ORDER_BY[metric]}
       LIMIT 1)`;

    const rows = await this.prisma.$queryRaw<RawRecordRow[]>`
      ${branch('weight')} UNION ALL ${branch('volume')} UNION ALL ${branch('e1rm')}`;

    return Object.fromEntries(
      rows.map(({ metric, unit, ...row }) => [metric, { ...row, unit: toWeightUnit(unit) }]),
    );
  }
}
