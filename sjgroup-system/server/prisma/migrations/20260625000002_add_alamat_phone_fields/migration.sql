-- Add alamat to lead table
ALTER TABLE `lead` ADD COLUMN IF NOT EXISTS `alamat` TEXT NULL;

-- Add phone and alamat to Project table
ALTER TABLE `Project` ADD COLUMN IF NOT EXISTS `phone` VARCHAR(191) NULL;
ALTER TABLE `Project` ADD COLUMN IF NOT EXISTS `alamat` TEXT NULL;
