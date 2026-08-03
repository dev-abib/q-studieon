-- =============================================================
-- Align shared_reports columns with the Prisma schema.
-- The hand-written migration 20260730000000_add_share_type created
-- snake_case columns (share_type, collection_id, ...), but the
-- schema — like the rest of the database — uses camelCase
-- (shareType, collectionId, ...). These are data-preserving
-- renames (RENAME COLUMN keeps all data).
--
-- Idempotent: each step tolerates already-renamed state.
-- =============================================================

DO $$ BEGIN
    ALTER TABLE "shared_reports" RENAME COLUMN "share_type" TO "shareType";
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "shared_reports" RENAME COLUMN "collection_id" TO "collectionId";
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "shared_reports" RENAME COLUMN "comparison_report_id1" TO "comparisonReportId1";
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "shared_reports" RENAME COLUMN "comparison_report_id2" TO "comparisonReportId2";
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- report_id only exists on a from-scratch replay (shadow database);
-- the live database already uses "reportId"
DO $$ BEGIN
    ALTER TABLE "shared_reports" RENAME COLUMN "report_id" TO "reportId";
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Rename the index to the name Prisma expects for the collectionId field
DO $$ BEGIN
    ALTER INDEX "shared_reports_collection_id_idx" RENAME TO "shared_reports_collectionId_idx";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- reportId is nullable in the schema (String?)
DO $$ BEGIN
    ALTER TABLE "shared_reports" ALTER COLUMN "reportId" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;
