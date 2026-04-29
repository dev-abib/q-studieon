/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google', 'apple', 'guest');

-- CreateEnum
CREATE TYPE "subscriptionStatus" AS ENUM ('free', 'trailing', 'active', 'past_due', 'cancelled', 'incomplete');

-- CreateEnum
CREATE TYPE "bilingCycle" AS ENUM ('monthly', 'yearly');

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "isPaid" BOOLEAN DEFAULT false,
    "profilePictureURL" TEXT,
    "profilePicturePublicId" TEXT,
    "password" TEXT,
    "refereshToken" TEXT,
    "resetToken" TEXT,
    "isOtpVerified" BOOLEAN DEFAULT false,
    "otp" TEXT,
    "otpAttempts" INTEGER DEFAULT 0,
    "otpExpires" TIMESTAMP(3),
    "isGuest" BOOLEAN,
    "guestExpiresAt" TIMESTAMP(3),
    "authProvider" "AuthProvider" DEFAULT 'local',
    "planKey" TEXT,
    "billingCycle" "bilingCycle" DEFAULT 'monthly',
    "status" "subscriptionStatus" DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
