import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_WEIGHT_UNITS, WeightUnit } from '../../units/domain/weight-unit.registry';
import { IsWeightUnit } from '../../units/validators/is-weight-unit.validator';

export const MAX_ENTRIES_PER_REQUEST = 100;
export const MAX_SETS_PER_ENTRY = 50;
export const MAX_REPS = 1_000;
/** In the set's own unit; generous upper bound that also keeps volume within column precision. */
export const MAX_WEIGHT = 2_000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class WorkoutSetDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: MAX_REPS })
  @IsInt()
  @Min(1)
  @Max(MAX_REPS)
  readonly reps: number;

  @ApiProperty({ example: 100, minimum: 0, maximum: MAX_WEIGHT, description: 'Up to 3 decimals' })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_WEIGHT)
  readonly weight: number;

  @ApiProperty({ enum: SUPPORTED_WEIGHT_UNITS, example: 'kg' })
  @IsWeightUnit()
  readonly unit: WeightUnit;
}

export class WorkoutEntryDto {
  @ApiProperty({
    example: '2026-10-14T07:30:00+07:00',
    description:
      'ISO-8601 date-time with offset, or a date / local date-time interpreted in `timezone`',
  })
  @IsString()
  @IsNotEmpty()
  readonly date: string;

  @ApiProperty({ example: 'Bench Press', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  readonly exerciseName: string;

  @ApiProperty({ type: [WorkoutSetDto], minItems: 1, maxItems: MAX_SETS_PER_ENTRY })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SETS_PER_ENTRY)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDto)
  readonly sets: WorkoutSetDto[];
}

export class CreateWorkoutsDto {
  @ApiPropertyOptional({
    example: 'Asia/Ho_Chi_Minh',
    description: 'IANA time zone for dates without an offset. Defaults to UTC.',
  })
  @IsOptional()
  @IsTimeZone()
  readonly timezone?: string;

  @ApiProperty({ type: [WorkoutEntryDto], minItems: 1, maxItems: MAX_ENTRIES_PER_REQUEST })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENTRIES_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => WorkoutEntryDto)
  readonly entries: WorkoutEntryDto[];
}
