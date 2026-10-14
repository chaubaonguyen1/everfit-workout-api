import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsTimeZone, Length } from 'class-validator';
import { SUPPORTED_WEIGHT_UNITS, WeightUnit } from '../../units/domain/weight-unit.registry';
import { IsWeightUnit } from '../../units/validators/is-weight-unit.validator';
import { PERIOD_UNITS, PeriodUnit } from '../domain/period';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PersonalRecordsQuery {
  @ApiProperty({
    example: 'Bench Press',
    description: 'Exact exercise name (case/space-insensitive)',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  readonly exercise: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Inclusive. Date or ISO date-time' })
  @IsOptional()
  @IsString()
  readonly from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'A date includes that whole day' })
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

  @ApiPropertyOptional({ enum: SUPPORTED_WEIGHT_UNITS, default: 'kg' })
  @IsOptional()
  @IsWeightUnit()
  readonly unit?: WeightUnit;
}

export class ComparePersonalRecordsQuery {
  @ApiProperty({ example: 'Bench Press' })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  readonly exercise: string;

  @ApiPropertyOptional({ enum: PERIOD_UNITS, description: 'Calendar period vs the one before it' })
  @IsOptional()
  @IsIn(PERIOD_UNITS)
  readonly period?: PeriodUnit;

  @ApiPropertyOptional({
    example: '2026-10-14',
    description: 'A date in the current period. Default: now',
  })
  @IsOptional()
  @IsString()
  readonly referenceDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Explicit ranges (all four, instead of `period`)',
  })
  @IsOptional()
  @IsString()
  readonly currentFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-14' })
  @IsOptional()
  @IsString()
  readonly currentTo?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  readonly previousFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-14' })
  @IsOptional()
  @IsString()
  readonly previousTo?: string;

  @ApiPropertyOptional({
    example: 'Asia/Ho_Chi_Minh',
    description: 'Period boundaries are local midnights. Default UTC',
  })
  @IsOptional()
  @IsTimeZone()
  readonly timezone?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_WEIGHT_UNITS, default: 'kg' })
  @IsOptional()
  @IsWeightUnit()
  readonly unit?: WeightUnit;
}
