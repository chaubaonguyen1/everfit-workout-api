import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsTimeZone, Length, Max, Min } from 'class-validator';
import { SUPPORTED_WEIGHT_UNITS, WeightUnit } from '../../units/domain/weight-unit.registry';
import { IsWeightUnit } from '../../units/validators/is-weight-unit.validator';
import { DEFAULT_PAGE_SIZE } from '../domain/history-filters';

export const MAX_PAGE_SIZE = 100;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class WorkoutHistoryQuery {
  @ApiPropertyOptional({
    example: 'bench',
    description: 'Case-insensitive partial match on exercise name',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  readonly exercise?: string;

  @ApiPropertyOptional({ example: 'chest', description: 'See GET /exercises for available groups' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  readonly muscleGroup?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Inclusive. Date or ISO date-time' })
  @IsOptional()
  @IsString()
  readonly from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'A date includes that whole day; a date-time is an exclusive end',
  })
  @IsOptional()
  @IsString()
  readonly to?: string;

  @ApiPropertyOptional({
    example: 'Asia/Ho_Chi_Minh',
    description: 'For dates without an offset. Default UTC',
  })
  @IsOptional()
  @IsTimeZone()
  readonly timezone?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_WEIGHT_UNITS,
    description: 'Convert all weights to this unit. Default: each set in the unit it was logged in',
  })
  @IsOptional()
  @IsWeightUnit()
  readonly unit?: WeightUnit;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  readonly limit?: number;

  @ApiPropertyOptional({ description: '`pageInfo.nextCursor` from the previous page' })
  @IsOptional()
  @IsString()
  readonly cursor?: string;
}
