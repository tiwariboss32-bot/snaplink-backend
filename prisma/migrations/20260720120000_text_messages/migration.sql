-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "image_url" DROP NOT NULL;
ALTER TABLE "messages" ADD COLUMN "text" TEXT;
