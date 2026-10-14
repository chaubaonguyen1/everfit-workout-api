-- DropIndex
DROP INDEX "workout_sets_pr_e1rm_idx";

-- DropIndex
DROP INDEX "workout_sets_pr_volume_idx";

-- DropIndex
DROP INDEX "workout_sets_pr_weight_idx";

-- AlterTable
ALTER TABLE "exercises" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "workout_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "workout_sets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- CreateIndex
CREATE INDEX "workout_sets_pr_weight_idx" ON "workout_sets"("user_id", "exercise_id", "weight_kg" DESC, "performed_at", "id");

-- CreateIndex
CREATE INDEX "workout_sets_pr_volume_idx" ON "workout_sets"("user_id", "exercise_id", "volume_kg" DESC, "performed_at", "id");

-- CreateIndex
CREATE INDEX "workout_sets_pr_e1rm_idx" ON "workout_sets"("user_id", "exercise_id", "e1rm_kg" DESC, "performed_at", "id");
