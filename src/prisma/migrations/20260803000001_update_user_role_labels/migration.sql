-- Rename the old enum type (lowercase snake_case values)
ALTER TYPE "userRole" RENAME TO "userRole_old";

-- Create the new enum with capitalized labels
CREATE TYPE "userRole" AS ENUM (
  'Buyer',
  'Seller',
  'Renter',
  'RealEstateAgent',
  'Brokerage',
  'Practitioner',
  'HomeExplorer',
  'Homeowner',
  'Investor',
  'InteriorDesigner',
  'Architect'
);

-- Migrate existing column values (map old lowercase -> new capitalized)
ALTER TABLE "users" ALTER COLUMN "user_role" TYPE "userRole"
USING CASE "user_role"::text
  WHEN 'buyer' THEN 'Buyer'::"userRole"
  WHEN 'seller' THEN 'Seller'::"userRole"
  WHEN 'renter' THEN 'Renter'::"userRole"
  WHEN 'real_estate_agent' THEN 'RealEstateAgent'::"userRole"
  WHEN 'brokerage' THEN 'Brokerage'::"userRole"
  WHEN 'practitioner' THEN 'Practitioner'::"userRole"
  WHEN 'home_explorer' THEN 'HomeExplorer'::"userRole"
  WHEN 'homeowner' THEN 'Homeowner'::"userRole"
  WHEN 'investor' THEN 'Investor'::"userRole"
  WHEN 'interior_designer' THEN 'InteriorDesigner'::"userRole"
  WHEN 'architect' THEN 'Architect'::"userRole"
  ELSE NULL
END;

-- Drop the old enum type
DROP TYPE "userRole_old";
