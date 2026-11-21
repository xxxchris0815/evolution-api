-- Expand token columns for long Meta / Chatwoot access tokens
ALTER TABLE `Instance` MODIFY `token` TEXT NULL;
ALTER TABLE `Chatwoot` MODIFY `token` TEXT NULL;

-- Allow same template name with different languages / instances
ALTER TABLE `Template` DROP INDEX `Template_name_key`;

ALTER TABLE `Template` ADD COLUMN `source` VARCHAR(50) NOT NULL DEFAULT 'meta';
ALTER TABLE `Template` ADD COLUMN `readOnly` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Template` ADD COLUMN `language` VARCHAR(50) NULL;
ALTER TABLE `Template` ADD COLUMN `status` VARCHAR(50) NULL;
ALTER TABLE `Template` ADD COLUMN `category` VARCHAR(50) NULL;
ALTER TABLE `Template` ADD COLUMN `chatwootCannedId` VARCHAR(100) NULL;

CREATE INDEX `Template_instanceId_idx` ON `Template`(`instanceId`);
CREATE INDEX `Template_instanceId_name_idx` ON `Template`(`instanceId`, `name`);
CREATE INDEX `Template_source_idx` ON `Template`(`source`);
