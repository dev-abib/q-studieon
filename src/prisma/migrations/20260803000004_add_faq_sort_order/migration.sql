-- =============================================================
-- Add sortOrder to faqs — display order for the app
-- All statements are idempotent.
-- =============================================================

DO $$ BEGIN
    ALTER TABLE "faqs" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "faqs_sortOrder_idx" ON "faqs"("sortOrder");
