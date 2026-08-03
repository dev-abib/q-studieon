-- =============================================================
-- Table: faqs — FAQ management for the app
-- All statements are idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS "faqs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "imagePublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "faqs_createdAt_idx" ON "faqs"("createdAt");
CREATE INDEX IF NOT EXISTS "faqs_title_idx" ON "faqs"("title");
