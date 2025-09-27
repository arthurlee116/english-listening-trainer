-- CreateIndex
CREATE INDEX "wrong_answers_list_idx" ON "practice_answers"("is_correct", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "question_type_filter_idx" ON "practice_questions"("type");

-- CreateIndex
CREATE INDEX "question_content_search_idx" ON "practice_questions"("question");

-- CreateIndex
CREATE INDEX "user_difficulty_filter_idx" ON "practice_sessions"("user_id", "difficulty");

-- CreateIndex
CREATE INDEX "user_language_filter_idx" ON "practice_sessions"("user_id", "language");

-- CreateIndex
CREATE INDEX "topic_search_idx" ON "practice_sessions"("topic");
