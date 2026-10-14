import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { ExercisesService } from '@/modules/exercises/exercises.service';
import { createTestApp } from '../utils/test-app';

describe('Exercises (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/exercises lists catalog exercises with their muscle groups', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/exercises').expect(200);

    expect(res.body.muscleGroups).toContain('chest');
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        {
          id: expect.any(String),
          name: 'Bench Press',
          muscleGroups: ['chest', 'triceps', 'shoulders'],
        },
      ]),
    );
  });

  it('catalog sync is idempotent and restores a mapping edited directly in the DB', async () => {
    await prisma.exercise.update({
      where: { normalizedName: 'bench press' },
      data: { muscleGroups: ['legs'] },
    });

    await app.get(ExercisesService).onApplicationBootstrap();
    await app.get(ExercisesService).onApplicationBootstrap();

    const bench = await prisma.exercise.findUniqueOrThrow({
      where: { normalizedName: 'bench press' },
    });
    expect(bench.muscleGroups).toEqual(['chest', 'triceps', 'shoulders']);
    expect(await prisma.exercise.count({ where: { normalizedName: 'bench press' } })).toBe(1);
  });

  it('clears muscle groups of exercises no longer in the catalog (but keeps the exercise)', async () => {
    await prisma.exercise.upsert({
      where: { normalizedName: 'zercher squat' },
      create: { name: 'Zercher Squat', normalizedName: 'zercher squat', muscleGroups: ['quads'] },
      update: { muscleGroups: ['quads'] },
    });

    await app.get(ExercisesService).onApplicationBootstrap();

    const zercher = await prisma.exercise.findUniqueOrThrow({
      where: { normalizedName: 'zercher squat' },
    });
    expect(zercher.muscleGroups).toEqual([]);
    await prisma.exercise.delete({ where: { id: zercher.id } });
  });

  it('enforces integrity rules at the database level too (CHECK constraints)', async () => {
    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: { normalizedName: 'bench press' },
    });
    const entry = await prisma.workoutEntry.create({
      data: { userId: 'db-check', exerciseId: exercise.id, performedAt: new Date() },
    });

    await expect(
      prisma.workoutSet.create({
        data: {
          entryId: entry.id,
          setIndex: 0,
          reps: 0,
          weight: 100,
          unit: 'kg',
          weightKg: 100,
          volumeKg: 0,
          e1rmKg: 100,
          userId: 'db-check',
          exerciseId: exercise.id,
          performedAt: entry.performedAt,
        },
      }),
    ).rejects.toThrow(/workout_sets_reps_positive/);

    await prisma.workoutEntry.delete({ where: { id: entry.id } });
  });
});
