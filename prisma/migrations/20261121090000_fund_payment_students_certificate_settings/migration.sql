-- AlterTable
ALTER TABLE `scholarship_funds` ADD COLUMN `bank_account_name` VARCHAR(255) NULL,
    ADD COLUMN `promptpay_id` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `scholarship_students` (
    `student_id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(255) NOT NULL,
    `student_code` VARCHAR(20) NULL,
    `year_level` SMALLINT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_scholarship_students_active`(`is_active`, `full_name`),
    PRIMARY KEY (`student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_settings` (
    `setting_id` INTEGER NOT NULL,
    `org_name` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` VARCHAR(255) NOT NULL,
    `body_text` TEXT NOT NULL,
    `blessing_text` TEXT NOT NULL,
    `footer_note` TEXT NOT NULL,
    `signer_name` VARCHAR(255) NOT NULL,
    `signer_position` VARCHAR(255) NOT NULL,
    `signature_image_path` VARCHAR(500) NULL,
    `certificate_email_subject` VARCHAR(255) NOT NULL,
    `certificate_email_body` TEXT NOT NULL,
    `rd_email_subject` VARCHAR(255) NOT NULL,
    `rd_email_body` TEXT NOT NULL,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `certificate_settings` ADD CONSTRAINT `certificate_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Only one settings row is allowed.
ALTER TABLE `certificate_settings` ADD CONSTRAINT `chk_certificate_settings_singleton` CHECK (`setting_id` = 1);
