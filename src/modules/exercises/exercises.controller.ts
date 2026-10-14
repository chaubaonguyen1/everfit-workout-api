import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ExerciseListResponse } from './dto/exercise.response';
import { ExercisesService } from './exercises.service';

@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  @ApiOkResponse({ type: ExerciseListResponse })
  async list(): Promise<ExerciseListResponse> {
    const exercises = await this.exercises.findAll();
    return {
      data: exercises.map(({ id, name, muscleGroups }) => ({ id, name, muscleGroups })),
      muscleGroups: this.exercises.muscleGroups,
    };
  }
}
