/*
  Warnings:

  - You are about to drop the column `notes` on the `after_sales` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `after_sales` table. All the data in the column will be lost.
  - You are about to drop the column `warrantyDurationMonths` on the `after_sales` table. All the data in the column will be lost.
  - You are about to drop the column `warrantyEndDate` on the `after_sales` table. All the data in the column will be lost.
  - You are about to drop the column `warrantyStartDate` on the `after_sales` table. All the data in the column will be lost.
  - Added the required column `complaintType` to the `after_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `machineName` to the `after_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `picAftersales` to the `after_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priority` to the `after_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reportDate` to the `after_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ticketStatus` to the `after_sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `warrantyStatus` to the `after_sales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `after_sales` DROP COLUMN `notes`,
    DROP COLUMN `projectId`,
    DROP COLUMN `warrantyDurationMonths`,
    DROP COLUMN `warrantyEndDate`,
    DROP COLUMN `warrantyStartDate`,
    ADD COLUMN `complaintType` VARCHAR(191) NOT NULL,
    ADD COLUMN `customerName` VARCHAR(191) NULL,
    ADD COLUMN `handlingDeadline` DATETIME(3) NULL,
    ADD COLUMN `installationDate` DATETIME(3) NULL,
    ADD COLUMN `machineName` VARCHAR(191) NOT NULL,
    ADD COLUMN `mediaUrl` VARCHAR(191) NULL,
    ADD COLUMN `picAftersales` VARCHAR(191) NOT NULL,
    ADD COLUMN `priority` VARCHAR(191) NOT NULL,
    ADD COLUMN `problemDescription` TEXT NULL,
    ADD COLUMN `purchaseDate` DATETIME(3) NULL,
    ADD COLUMN `reportDate` DATETIME(3) NOT NULL,
    ADD COLUMN `technicianAssigned` VARCHAR(191) NULL,
    ADD COLUMN `ticketStatus` VARCHAR(191) NOT NULL,
    ADD COLUMN `warrantyPeriod` VARCHAR(191) NULL,
    ADD COLUMN `warrantyStatus` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `project` ADD COLUMN `meetingNotes` JSON NOT NULL;
