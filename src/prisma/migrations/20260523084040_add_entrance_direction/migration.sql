-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_userId_fkey";

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "auspiciousnessLevel" TEXT,
ADD COLUMN     "auspiciousnessSummary" TEXT,
ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "entranceDirection" JSONB,
ADD COLUMN     "entranceEnergy" JSONB,
ADD COLUMN     "familyFlowNarrative" TEXT,
ADD COLUMN     "familyFlowSummary" TEXT,
ADD COLUMN     "fengShui" JSONB,
ADD COLUMN     "finishReason" TEXT,
ADD COLUMN     "helpfulTips" JSONB,
ADD COLUMN     "indicators" JSONB,
ADD COLUMN     "lifeAspects" JSONB,
ADD COLUMN     "numerology" JSONB,
ADD COLUMN     "overallAlignmentSummary" TEXT,
ADD COLUMN     "overallScore" INTEGER,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "photos" JSONB,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "practicalRemedies" JSONB,
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "totalTokens" INTEGER,
ADD COLUMN     "vastu" JSONB,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "reports_placeId_idx" ON "reports"("placeId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
