-- =============================================================
-- Repair missing migration history
-- These tables exist in the live database and in the Prisma
-- schema but were never created by any migration. Without them
-- the shadow database replay used by `prisma migrate dev` fails.
--
-- All statements are idempotent so this migration is a no-op on
-- the live database (tables already exist there).
--
-- NOTE: collections and shared_reports are created in their
-- PRE-state (without the "type" / "share_type" columns) so the
-- already-recorded migrations 20260723000000_add_collection_type
-- and 20260730000000_add_share_type still apply on top of them
-- during a from-scratch replay.
-- =============================================================

-- Table: collections (pre-state: "type" added by add_collection_type)
CREATE TABLE IF NOT EXISTS "collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collections_userId_idx" ON "collections"("userId");

DO $$ BEGIN
    ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: report_collections (full state — no later migration touches it)
CREATE TABLE IF NOT EXISTS "report_collections" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "report_collections_reportId_collectionId_key" ON "report_collections"("reportId", "collectionId");
CREATE INDEX IF NOT EXISTS "report_collections_reportId_idx" ON "report_collections"("reportId");
CREATE INDEX IF NOT EXISTS "report_collections_collectionId_idx" ON "report_collections"("collectionId");

DO $$ BEGIN
    ALTER TABLE "report_collections" ADD CONSTRAINT "report_collections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "report_collections" ADD CONSTRAINT "report_collections_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: categories (full state)
CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "iconPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "categories_name_idx" ON "categories"("name");
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories"("slug");

-- Table: Question (full state)
CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Question_categoryId_idx" ON "Question"("categoryId");
CREATE INDEX IF NOT EXISTS "Question_createdAt_idx" ON "Question"("createdAt");

DO $$ BEGIN
    ALTER TABLE "Question" ADD CONSTRAINT "Question_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: insights (full state)
CREATE TABLE IF NOT EXISTS "insights" (
    "id" TEXT NOT NULL,
    "icon" TEXT,
    "iconPublicId" TEXT,
    "title" TEXT NOT NULL,
    "subTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "redirectLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- Table: shared_reports (pre-state: report_id NOT NULL; the share/collection/
-- comparison columns are added by add_share_type)
CREATE TABLE IF NOT EXISTS "shared_reports" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shared_reports_token_key" ON "shared_reports"("token");
CREATE INDEX IF NOT EXISTS "shared_reports_token_idx" ON "shared_reports"("token");
CREATE INDEX IF NOT EXISTS "shared_reports_reportId_idx" ON "shared_reports"("report_id");
CREATE INDEX IF NOT EXISTS "shared_reports_sharedById_idx" ON "shared_reports"("sharedById");

DO $$ BEGIN
    ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_reportId_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DynamicPage.isPublished — missing from the init migration
DO $$ BEGIN
    ALTER TABLE "DynamicPage" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
