-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "exercise_data" TEXT,
    "difficulty" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "topic" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "accuracy" REAL,
    "score" INTEGER,
    "duration" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT,
    "correct_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "transcript_snapshot" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "practice_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question_id" TEXT NOT NULL,
    "user_answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "attempted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ai_analysis" TEXT,
    "ai_analysis_generated_at" DATETIME,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "needs_analysis" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "practice_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "practice_questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isAdmin_idx" ON "users"("isAdmin");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "practice_sessions_user_id_created_at_idx" ON "practice_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "practice_sessions_created_at_idx" ON "practice_sessions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "practice_sessions_difficulty_created_at_idx" ON "practice_sessions"("difficulty", "created_at");

-- CreateIndex
CREATE INDEX "practice_sessions_language_created_at_idx" ON "practice_sessions"("language", "created_at");

-- CreateIndex
CREATE INDEX "practice_sessions_accuracy_idx" ON "practice_sessions"("accuracy");

-- CreateIndex
CREATE INDEX "practice_sessions_user_id_difficulty_created_at_idx" ON "practice_sessions"("user_id", "difficulty", "created_at");

-- CreateIndex
CREATE INDEX "practice_questions_session_id_index_idx" ON "practice_questions"("session_id", "index");

-- CreateIndex
CREATE INDEX "practice_questions_type_created_at_idx" ON "practice_questions"("type", "created_at");

-- CreateIndex
CREATE INDEX "practice_answers_question_id_idx" ON "practice_answers"("question_id");

-- CreateIndex
CREATE INDEX "practice_answers_is_correct_attempted_at_idx" ON "practice_answers"("is_correct", "attempted_at");

-- CreateIndex
CREATE INDEX "practice_answers_needs_analysis_is_correct_idx" ON "practice_answers"("needs_analysis", "is_correct");

-- CreateIndex
CREATE INDEX "practice_answers_ai_analysis_generated_at_idx" ON "practice_answers"("ai_analysis_generated_at");
