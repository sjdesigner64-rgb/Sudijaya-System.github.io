-- Add estimatedCost and payments to Lead (Project Satuan)
ALTER TABLE `Lead` ADD COLUMN IF NOT EXISTS `estimatedCost` DOUBLE NULL;
ALTER TABLE `Lead` ADD COLUMN IF NOT EXISTS `payments` JSON NOT NULL DEFAULT (JSON_ARRAY());
