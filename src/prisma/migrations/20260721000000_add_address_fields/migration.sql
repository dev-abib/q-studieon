-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "entranceDegrees" DOUBLE PRECISION,
ADD COLUMN     "entranceLabel" TEXT;
