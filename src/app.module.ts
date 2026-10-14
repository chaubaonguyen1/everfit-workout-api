import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { UnitsModule } from './modules/units/units.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // `.env.test` is picked up automatically when Jest sets NODE_ENV=test.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateEnv,
      load: [configuration],
    }),
    LoggerModule,
    PrismaModule,
    HealthModule,
    UnitsModule,
    ExercisesModule,
    WorkoutsModule,
  ],
})
export class AppModule {}
