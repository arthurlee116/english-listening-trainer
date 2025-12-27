-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "full_text" TEXT,
    "category" TEXT,
    "published_at" DATETIME NOT NULL,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_topics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "brief_summary" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    CONSTRAINT "daily_topics_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pre_generated_transcripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic_id" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "word_count" INTEGER NOT NULL,
    "transcript" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pre_generated_transcripts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "daily_topics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "news_articles_fetched_at_idx" ON "news_articles"("fetched_at");

-- CreateIndex
CREATE INDEX "news_articles_expires_at_idx" ON "news_articles"("expires_at");

-- CreateIndex
CREATE INDEX "news_articles_source_published_at_idx" ON "news_articles"("source", "published_at");

-- CreateIndex
CREATE INDEX "daily_topics_difficulty_expires_at_idx" ON "daily_topics"("difficulty", "expires_at");

-- CreateIndex
CREATE INDEX "daily_topics_generated_at_idx" ON "daily_topics"("generated_at");

-- CreateIndex
CREATE INDEX "daily_topics_expires_at_idx" ON "daily_topics"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "pre_generated_transcripts_topic_id_duration_key" ON "pre_generated_transcripts"("topic_id", "duration");
