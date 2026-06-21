-- AlterTable
ALTER TABLE `content_requests` ADD COLUMN `attachments` JSON NOT NULL,
    ADD COLUMN `contentType` VARCHAR(191) NOT NULL DEFAULT 'foto',
    ADD COLUMN `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    ADD COLUMN `revisionNotes` TEXT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'baru';

-- CreateTable
CREATE TABLE `media_assets` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_data` (
    `id` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `platform` JSON NOT NULL,
    `format` VARCHAR(191) NOT NULL,
    `caption` TEXT NULL,
    `voiceOverScript` TEXT NULL,
    `hashtag` TEXT NULL,
    `files` JSON NOT NULL,
    `driveLink` VARCHAR(191) NULL,
    `productionStatus` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `uploadDate` DATETIME(3) NULL,
    `pic` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `content_data_seq_key`(`seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
