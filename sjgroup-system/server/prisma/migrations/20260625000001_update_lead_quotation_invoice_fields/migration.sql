-- Drop status from lead, add new tracking fields
ALTER TABLE `lead` DROP COLUMN IF EXISTS `status`;
ALTER TABLE `lead` ADD COLUMN IF NOT EXISTS `phone` VARCHAR(191) NULL;
ALTER TABLE `lead` ADD COLUMN IF NOT EXISTS `tanggal` DATETIME(3) NULL;
ALTER TABLE `lead` ADD COLUMN IF NOT EXISTS `lokasi` VARCHAR(191) NULL;
ALTER TABLE `lead` ADD COLUMN IF NOT EXISTS `dpPelunasan` VARCHAR(191) NULL DEFAULT 'belum_dp';
ALTER TABLE `lead` ADD COLUMN IF NOT EXISTS `pengiriman` VARCHAR(191) NULL DEFAULT 'belum';

-- Add missing fields to quotation
ALTER TABLE `Quotation` ADD COLUMN IF NOT EXISTS `fileUrl` VARCHAR(191) NULL;
ALTER TABLE `Quotation` ADD COLUMN IF NOT EXISTS `customerName` VARCHAR(191) NULL;
ALTER TABLE `Quotation` ADD COLUMN IF NOT EXISTS `machineName` VARCHAR(191) NULL;
ALTER TABLE `Quotation` ADD COLUMN IF NOT EXISTS `picSales` VARCHAR(191) NULL;
ALTER TABLE `Quotation` ADD COLUMN IF NOT EXISTS `lokasi` VARCHAR(191) NULL;
ALTER TABLE `Quotation` ADD COLUMN IF NOT EXISTS `tanggal` DATETIME(3) NULL;

-- Add picSales to invoice
ALTER TABLE `Invoice` ADD COLUMN IF NOT EXISTS `picSales` VARCHAR(191) NULL;

-- Add assignedAdmin to requests_bom (if not yet applied)
ALTER TABLE `requests_bom` ADD COLUMN IF NOT EXISTS `assignedAdmin` VARCHAR(191) NULL;
