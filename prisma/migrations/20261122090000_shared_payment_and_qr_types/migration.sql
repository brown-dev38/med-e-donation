-- AlterTable
ALTER TABLE `scholarship_funds` ADD COLUMN `bank_code` VARCHAR(3) NULL,
    ADD COLUMN `payment_mode` ENUM('SHARED', 'OWN') NOT NULL DEFAULT 'OWN',
    ADD COLUMN `qr_type` ENUM('NONE', 'PROMPTPAY', 'BANK_ACCOUNT') NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE `payment_settings` (
    `setting_id` INTEGER NOT NULL,
    `bank_name` VARCHAR(100) NOT NULL,
    `bank_code` VARCHAR(3) NULL,
    `bank_account_no` VARCHAR(50) NOT NULL,
    `bank_account_name` VARCHAR(255) NULL,
    `qr_type` ENUM('NONE', 'PROMPTPAY', 'BANK_ACCOUNT') NOT NULL DEFAULT 'NONE',
    `promptpay_id` VARCHAR(20) NULL,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_settings` ADD CONSTRAINT `payment_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Only one shared payment row is allowed.
ALTER TABLE `payment_settings` ADD CONSTRAINT `chk_payment_settings_singleton` CHECK (`setting_id` = 1);

-- Funds that already had a PromptPay ID keep showing their PromptPay QR.
UPDATE `scholarship_funds` SET `qr_type` = 'PROMPTPAY' WHERE `promptpay_id` IS NOT NULL AND `promptpay_id` <> '';
