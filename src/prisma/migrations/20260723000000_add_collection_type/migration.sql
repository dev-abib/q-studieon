-- CreateEnum (idempotent — skip if already exists from previous partial run)
DO $$ BEGIN
    CREATE TYPE "CollectionType" AS ENUM ('remote', 'onsite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add type column (idempotent — skip if already exists from previous partial run)
DO $$ BEGIN
    ALTER TABLE "collections" ADD COLUMN "type" "CollectionType" NOT NULL DEFAULT 'remote';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Drop old unique constraints (try both naming conventions for safety)
DO $$ BEGIN
    ALTER TABLE "collections" DROP CONSTRAINT "collections_userId_name_key";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "collections" DROP CONSTRAINT "collections_user_id_name_key";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_name_type_key" UNIQUE ("userId", "name", "type");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "collections_type_idx" ON "collections"("type");
