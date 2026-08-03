-- Rename the current (capitalized) enum type
ALTER TYPE "userRole" RENAME TO "userRole_caps";

-- Create the new enum with lowercase snake_case values
CREATE TYPE "userRole" AS ENUM (
  'buyer',
  'seller',
  'renter',
  'real_estate_agent',
  'brokerage',
  'practitioner',
  'home_explorer',
  'homeowner',
  'investor',
  'interior_designer',
  'architect'
);

-- Migrate existing column values (map capitalized -> lowercase)
ALTER TABLE "users" ALTER COLUMN "user_role" TYPE "userRole"
USING CASE "user_role"::text
  WHEN 'Buyer' THEN 'buyer'::"userRole"
  WHEN 'Seller' THEN 'seller'::"userRole"
  WHEN 'Renter' THEN 'renter'::"userRole"
  WHEN 'RealEstateAgent' THEN 'real_estate_agent'::"userRole"
  WHEN 'Brokerage' THEN 'brokerage'::"userRole"
  WHEN 'Practitioner' THEN 'practitioner'::"userRole"
  WHEN 'HomeExplorer' THEN 'home_explorer'::"userRole"
  WHEN 'Homeowner' THEN 'homeowner'::"userRole"
  WHEN 'Investor' THEN 'investor'::"userRole"
  WHEN 'InteriorDesigner' THEN 'interior_designer'::"userRole"
  WHEN 'Architect' THEN 'architect'::"userRole"
  ELSE NULL
END;

-- Drop the old enum type
DROP TYPE "userRole_caps";
