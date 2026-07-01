-- Add PDF upload fields to shipments
ALTER TABLE `shipments` ADD COLUMN IF NOT EXISTS `addressPdfUrl` VARCHAR(191) NULL;
ALTER TABLE `shipments` ADD COLUMN IF NOT EXISTS `suratJalanUrl` VARCHAR(191) NULL;
