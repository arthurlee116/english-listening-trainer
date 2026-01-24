-- CreateTable
CREATE TABLE "news_refresh_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "last_refresh_at" DATETIME,
    "is_refreshing" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
