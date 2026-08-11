-- AlterTable
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "metaWebhookPassthrough" BOOLEAN NOT NULL DEFAULT false;
