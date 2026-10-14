import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_WEIGHT_UNITS, WeightUnit } from '../../units/domain/weight-unit.registry';
import { PERIOD_UNITS } from '../domain/period';

export class RecordSetResponse {
  @ApiProperty({ example: 3 })
  readonly reps: number;

  @ApiProperty({ example: 120, description: 'In the response `unit`' })
  readonly weight: number;
}

export class PersonalRecordResponse {
  @ApiProperty({ example: 132, description: 'Record value in the response `unit`' })
  readonly value: number;

  @ApiProperty({ example: '2026-10-10T08:00:00.000Z', description: 'First time it was achieved' })
  readonly achievedAt: string;

  @ApiProperty({ format: 'uuid' })
  readonly entryId: string;

  @ApiProperty({ type: RecordSetResponse })
  readonly set: RecordSetResponse;
}

export class PersonalRecordsSummary {
  @ApiProperty({ type: PersonalRecordResponse, nullable: true, description: 'Heaviest single set' })
  readonly maxWeight: PersonalRecordResponse | null;

  @ApiProperty({
    type: PersonalRecordResponse,
    nullable: true,
    description: 'Highest reps × weight',
  })
  readonly maxVolume: PersonalRecordResponse | null;

  @ApiProperty({
    type: PersonalRecordResponse,
    nullable: true,
    description: 'Best Epley estimate: weight × (1 + reps / 30)',
  })
  readonly bestEstimatedOneRepMax: PersonalRecordResponse | null;
}

export class ExerciseSummary {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ example: 'Bench Press' })
  readonly name: string;
}

export class RangeResponse {
  @ApiProperty({ nullable: true, type: String, example: '2026-01-01T00:00:00.000Z' })
  readonly from: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Exclusive' })
  readonly to: string | null;
}

export class PersonalRecordsResponse {
  @ApiProperty({ type: ExerciseSummary })
  readonly exercise: ExerciseSummary;

  @ApiProperty({ enum: SUPPORTED_WEIGHT_UNITS })
  readonly unit: WeightUnit;

  @ApiProperty({ type: RangeResponse })
  readonly range: RangeResponse;

  @ApiProperty({ type: PersonalRecordsSummary })
  readonly records: PersonalRecordsSummary;

  @ApiPropertyOptional({ example: 'No sets recorded for this exercise in the given range' })
  readonly message?: string;
}

export class PeriodRecordsResponse {
  @ApiProperty({ example: '2026-09-30T17:00:00.000Z' })
  readonly from: string;

  @ApiProperty({ example: '2026-10-31T17:00:00.000Z', description: 'Exclusive' })
  readonly to: string;

  @ApiProperty({ type: PersonalRecordsSummary })
  readonly records: PersonalRecordsSummary;
}

export class RecordChangeResponse {
  @ApiProperty({ example: 5, description: 'current − previous, in `unit`' })
  readonly absolute: number;

  @ApiProperty({ example: 4.2, nullable: true, type: Number, description: 'Null if previous is 0' })
  readonly percent: number | null;
}

export class RecordChangesResponse {
  @ApiProperty({ type: RecordChangeResponse, nullable: true })
  readonly maxWeight: RecordChangeResponse | null;

  @ApiProperty({ type: RecordChangeResponse, nullable: true })
  readonly maxVolume: RecordChangeResponse | null;

  @ApiProperty({ type: RecordChangeResponse, nullable: true })
  readonly bestEstimatedOneRepMax: RecordChangeResponse | null;
}

export class PersonalRecordsComparisonResponse {
  @ApiProperty({ type: ExerciseSummary })
  readonly exercise: ExerciseSummary;

  @ApiProperty({ enum: SUPPORTED_WEIGHT_UNITS })
  readonly unit: WeightUnit;

  @ApiProperty({ enum: [...PERIOD_UNITS, 'custom'] })
  readonly period: string;

  @ApiProperty({ type: PeriodRecordsResponse })
  readonly current: PeriodRecordsResponse;

  @ApiProperty({ type: PeriodRecordsResponse })
  readonly previous: PeriodRecordsResponse;

  @ApiProperty({
    type: RecordChangesResponse,
    description: 'Null per metric unless both periods have a record',
  })
  readonly change: RecordChangesResponse;

  @ApiPropertyOptional({ example: 'No sets recorded for this exercise in either period' })
  readonly message?: string;
}
