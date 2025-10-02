-- AlterTable
ALTER TABLE "practice_questions" ADD COLUMN "focus_areas" TEXT;

-- CreateIndex
CREATE INDEX "focus_areas_filter_idx" ON "practice_questions"("focus_areas");
