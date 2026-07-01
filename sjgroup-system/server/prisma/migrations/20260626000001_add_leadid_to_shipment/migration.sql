-- Add leadId to shipments for linking to Project Satuan
ALTER TABLE `shipments` ADD COLUMN IF NOT EXISTS `leadId` VARCHAR(191) NULL;
