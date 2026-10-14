-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "muscle_groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_entries" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "exercise_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "set_index" SMALLINT NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DECIMAL(10,3) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "weight_kg" DECIMAL(14,6) NOT NULL,
    "volume_kg" DECIMAL(16,6) NOT NULL,
    "e1rm_kg" DECIMAL(14,6) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "exercise_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_normalized_name_key" ON "exercises"("normalized_name");

-- CreateIndex
CREATE INDEX "exercises_normalized_name_trgm_idx" ON "exercises" USING GIN ("normalized_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "exercises_muscle_groups_idx" ON "exercises" USING GIN ("muscle_groups");

-- CreateIndex
CREATE INDEX "workout_entries_user_id_performed_at_id_idx" ON "workout_entries"("user_id", "performed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "workout_entries_user_id_exercise_id_performed_at_id_idx" ON "workout_entries"("user_id", "exercise_id", "performed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "workout_sets_pr_weight_idx" ON "workout_sets"("user_id", "exercise_id", "weight_kg" DESC, "performed_at");

-- CreateIndex
CREATE INDEX "workout_sets_pr_volume_idx" ON "workout_sets"("user_id", "exercise_id", "volume_kg" DESC, "performed_at");

-- CreateIndex
CREATE INDEX "workout_sets_pr_e1rm_idx" ON "workout_sets"("user_id", "exercise_id", "e1rm_kg" DESC, "performed_at");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_entry_id_set_index_key" ON "workout_sets"("entry_id", "set_index");

-- AddForeignKey
ALTER TABLE "workout_entries" ADD CONSTRAINT "workout_entries_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "workout_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: integrity rules Prisma cannot express. The API validates the same rules at the
-- boundary; these constraints are the last line of defence against bad writes from any path.
-- ---------------------------------------------------------------------------

-- Prisma lists are non-null in the client type, but the generated column is nullable.
ALTER TABLE "exercises" ALTER COLUMN "muscle_groups" SET NOT NULL;

ALTER TABLE "exercises"
  ADD CONSTRAINT "exercises_normalized_name_not_blank" CHECK (length(btrim("normalized_name")) > 0);

ALTER TABLE "workout_sets"
  ADD CONSTRAINT "workout_sets_reps_positive"        CHECK ("reps" > 0),
  ADD CONSTRAINT "workout_sets_weight_non_negative"  CHECK ("weight" >= 0),
  ADD CONSTRAINT "workout_sets_weight_kg_non_negative" CHECK ("weight_kg" >= 0),
  ADD CONSTRAINT "workout_sets_volume_kg_non_negative" CHECK ("volume_kg" >= 0),
  ADD CONSTRAINT "workout_sets_e1rm_kg_non_negative" CHECK ("e1rm_kg" >= 0),
  ADD CONSTRAINT "workout_sets_set_index_non_negative" CHECK ("set_index" >= 0);
