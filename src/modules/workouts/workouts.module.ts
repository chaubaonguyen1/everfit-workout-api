import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { UnitsModule } from '../units/units.module';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsRepository } from './workouts.repository';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [ExercisesModule, IdempotencyModule, UnitsModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, WorkoutsRepository],
})
export class WorkoutsModule {}
