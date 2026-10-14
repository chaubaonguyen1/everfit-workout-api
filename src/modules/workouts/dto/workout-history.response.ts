import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_WEIGHT_UNITS, WeightUnit } from '../../units/domain/weight-unit.registry';

export class HistorySetResponse {
  @ApiProperty({ example: 0 })
  readonly setIndex: number;

  @ApiProperty({ example: 5 })
  readonly reps: number;

  @ApiProperty({ example: 220.46, description: 'In `unit` (rounded to 2 decimals)' })
  readonly weight: number;

  @ApiProperty({ enum: SUPPORTED_WEIGHT_UNITS, example: 'lb' })
  readonly unit: WeightUnit;

  @ApiProperty({ example: 1102.31, description: 'reps × weight, in `unit`' })
  readonly volume: number;

  @ApiProperty({ example: 257.2, description: 'Epley estimate, in `unit`' })
  readonly estimatedOneRepMax: number;
}

export class HistoryEntryResponse {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly exerciseId: string;

  @ApiProperty({ example: 'Bench Press' })
  readonly exerciseName: string;

  @ApiProperty({ example: ['chest', 'triceps'], type: [String] })
  readonly muscleGroups: readonly string[];

  @ApiProperty({ example: '2026-10-14T00:30:00.000Z' })
  readonly performedAt: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh', nullable: true, type: String })
  readonly timezone: string | null;

  @ApiProperty({ type: [HistorySetResponse] })
  readonly sets: HistorySetResponse[];
}

export class PageInfo {
  @ApiProperty({ example: 20 })
  readonly limit: number;

  @ApiProperty({ example: true })
  readonly hasMore: boolean;

  @ApiProperty({ nullable: true, type: String, description: 'Pass as `cursor` for the next page' })
  readonly nextCursor: string | null;
}

export class WorkoutHistoryResponse {
  @ApiProperty({ type: [HistoryEntryResponse] })
  readonly data: HistoryEntryResponse[];

  @ApiProperty({ type: PageInfo })
  readonly pageInfo: PageInfo;

  @ApiPropertyOptional({ example: 'No workouts found for the given filters' })
  readonly message?: string;
}
