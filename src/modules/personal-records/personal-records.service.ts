import { Injectable } from '@nestjs/common';
import { ErrorDetail, ValidationError } from '../../common/errors';
import { DEFAULT_TIME_ZONE, assertRangeOrder, parseDateRange } from '../../common/utils';
import { ExercisesService } from '../exercises/exercises.service';
import { CANONICAL_WEIGHT_UNIT } from '../units/domain/weight-unit.registry';
import { resolveComparisonPeriods } from './domain/comparison';
import { ComparePersonalRecordsQuery, PersonalRecordsQuery } from './dto/personal-records.query';
import {
  PersonalRecordsComparisonResponse,
  PersonalRecordsResponse,
} from './dto/personal-records.response';
import { toComparisonResponse, toPersonalRecordsResponse } from './personal-records.mapper';
import { PersonalRecordsRepository } from './personal-records.repository';

@Injectable()
export class PersonalRecordsService {
  constructor(
    private readonly repository: PersonalRecordsRepository,
    private readonly exercises: ExercisesService,
  ) {}

  /** Max weight, max volume and best Epley 1RM for one exercise, optionally within a range. */
  async getRecords(userId: string, query: PersonalRecordsQuery): Promise<PersonalRecordsResponse> {
    const problems: ErrorDetail[] = [];
    const range = parseDateRange(query, query.timezone ?? DEFAULT_TIME_ZONE, problems);
    if (problems.length > 0) throw new ValidationError('Invalid query parameters', problems);
    assertRangeOrder(range);

    const exercise = await this.exercises.getByName(query.exercise);
    const rows = await this.repository.findRecords(userId, exercise.id, range);
    return toPersonalRecordsResponse(exercise, range, rows, query.unit ?? CANONICAL_WEIGHT_UNIT);
  }

  /** Records in the current period vs the previous one ("this month vs last month"). */
  async compare(
    userId: string,
    query: ComparePersonalRecordsQuery,
  ): Promise<PersonalRecordsComparisonResponse> {
    const periods = resolveComparisonPeriods(query, new Date());
    const exercise = await this.exercises.getByName(query.exercise);

    const [current, previous] = await Promise.all([
      this.repository.findRecords(userId, exercise.id, periods.current),
      this.repository.findRecords(userId, exercise.id, periods.previous),
    ]);
    return toComparisonResponse(
      exercise,
      periods,
      current,
      previous,
      query.unit ?? CANONICAL_WEIGHT_UNIT,
    );
  }
}
