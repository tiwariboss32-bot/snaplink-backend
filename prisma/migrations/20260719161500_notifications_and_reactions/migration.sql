-- AlterTable
ALTER TABLE "users" ADD COLUMN "notifications_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "reaction" TEXT;
