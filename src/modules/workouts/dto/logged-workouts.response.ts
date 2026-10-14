import { ApiProperty } from '@nestjs/swagger';
import { SUPPORTED_WEIGHT_UNITS, WeightUnit } from '../../units/domain/weight-unit.registry';

export class LoggedSetResponse {
  @ApiProperty({ example: 0 })
  readonly setIndex: number;

  @ApiProperty({ example: 5 })
  readonly reps: number;

  @ApiProperty({ example: 225, description: 'As logged, in `unit`' })
  readonly weight: number;

  @ApiProperty({ enum: SUPPORTED_WEIGHT_UNITS, example: 'lb' })
  readonly unit: WeightUnit;

  @ApiProperty({ example: 102.06, description: 'Normalized weight in kg (rounded to 2 decimals)' })
  readonly weightKg: number;

  @ApiProperty({ example: 510.29, description: 'reps × weight, in kg' })
  readonly volumeKg: number;

  @ApiProperty({ example: 119.07, description: 'Epley: weight × (1 + reps / 30), in kg' })
  readonly estimatedOneRepMaxKg: number;
}

export class LoggedEntryResponse {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly exerciseId: string;

  @ApiProperty({ example: 'Bench Press' })
  readonly exerciseName: string;

  @ApiProperty({ example: '2026-10-14T00:30:00.000Z', description: 'UTC' })
  readonly performedAt: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh', nullable: true, type: String })
  readonly timezone: string | null;

  @ApiProperty({ type: [LoggedSetResponse] })
  readonly sets: LoggedSetResponse[];
}

export class LoggedWorkoutsResponse {
  @ApiProperty({ type: [LoggedEntryResponse] })
  readonly data: LoggedEntryResponse[];
}
