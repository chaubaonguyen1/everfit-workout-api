import { ApiProperty } from '@nestjs/swagger';

export class ExerciseResponse {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ example: 'Bench Press' })
  readonly name: string;

  @ApiProperty({ example: ['chest', 'triceps', 'shoulders'], type: [String] })
  readonly muscleGroups: readonly string[];
}

export class ExerciseListResponse {
  @ApiProperty({ type: [ExerciseResponse] })
  readonly data: readonly ExerciseResponse[];

  @ApiProperty({ description: 'All muscle groups usable in filters', type: [String] })
  readonly muscleGroups: readonly string[];
}
