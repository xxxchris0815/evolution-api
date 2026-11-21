-- Expand token columns for long Meta / Chatwoot access tokens
ALTER TABLE "Instance" ALTER COLUMN "token" TYPE TEXT;
ALTER TABLE "Chatwoot" ALTER COLUMN "token" TYPE TEXT;

-- Template sync metadata (Meta ↔ Chatwoot)
ALTER TABLE "Template" DROP CONSTRAINT IF EXISTS "Template_name_key";
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) NOT NULL DEFAULT 'meta';
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "readOnly" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "language" VARCHAR(50);
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50);
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50);
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "chatwootCannedId" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "Template_instanceId_idx" ON "Template"("instanceId");
CREATE INDEX IF NOT EXISTS "Template_instanceId_name_idx" ON "Template"("instanceId", "name");
CREATE INDEX IF NOT EXISTS "Template_source_idx" ON "Template"("source");
