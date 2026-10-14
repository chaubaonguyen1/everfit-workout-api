import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { ExerciseCatalog, parseExerciseCatalog } from './domain/exercise-catalog';
import { ExerciseRecord, ExercisesRepository } from './exercises.repository';

@Injectable()
export class ExercisesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExercisesService.name);
  private catalog: ExerciseCatalog = { muscleGroups: [], exercises: [] };

  constructor(
    private readonly repository: ExercisesRepository,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Loads config/exercise-catalog.json and syncs it into the DB before traffic is served. */
  async onApplicationBootstrap(): Promise<void> {
    const path = resolve(this.config.get('catalog.path', { infer: true }));
    this.catalog = parseExerciseCatalog(JSON.parse(await readFile(path, 'utf8')));
    await this.repository.syncCatalog(this.catalog.exercises);

    this.logger.log(
      { path, exercises: this.catalog.exercises.length },
      'Exercise catalog synchronized',
    );
  }

  get muscleGroups(): readonly string[] {
    return this.catalog.muscleGroups;
  }

  findAll(): Promise<ExerciseRecord[]> {
    return this.repository.findAll();
  }
}
