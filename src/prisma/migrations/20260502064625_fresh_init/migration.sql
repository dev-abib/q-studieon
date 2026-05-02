/*
  Warnings:

  - You are about to drop the column `refereshToken` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "role" AS ENUM ('user', 'admin', 'super_admin');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "refereshToken",
ADD COLUMN     "blockedUntil" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "role" "role" NOT NULL DEFAULT 'user',
ADD COLUMN     "termsAndConditions" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
