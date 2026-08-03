-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "userRole" AS ENUM ('buyer', 'seller', 'renter', 'real_estate_agent', 'brokerage', 'practitioner', 'home_explorer', 'homeowner', 'investor', 'interior_designer', 'architect');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add user_role column (idempotent)
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "user_role" "userRole";
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
