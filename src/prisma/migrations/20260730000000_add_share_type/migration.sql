-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "ShareType" AS ENUM ('report', 'collection', 'comparison');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add share_type column with default (idempotent)
DO $$ BEGIN
    ALTER TABLE "shared_reports" ADD COLUMN "share_type" "ShareType" NOT NULL DEFAULT 'report';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Make report_id nullable
DO $$ BEGIN
    ALTER TABLE "shared_reports" ALTER COLUMN "report_id" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

-- Add collection_id column (idempotent)
DO $$ BEGIN
    ALTER TABLE "shared_reports" ADD COLUMN "collection_id" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add comparison_report_id1 column (idempotent)
DO $$ BEGIN
    ALTER TABLE "shared_reports" ADD COLUMN "comparison_report_id1" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add comparison_report_id2 column (idempotent)
DO $$ BEGIN
    ALTER TABLE "shared_reports" ADD COLUMN "comparison_report_id2" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "shared_reports_collection_id_idx" ON "shared_reports"("collection_id");
