-- CreateTable
CREATE TABLE `scholarship_funds` (
    `fund_id` INTEGER NOT NULL AUTO_INCREMENT,
    `fund_code` VARCHAR(50) NOT NULL,
    `fund_name_th` VARCHAR(255) NOT NULL,
    `fund_description` TEXT NULL,
    `requires_student_name` BOOLEAN NOT NULL DEFAULT false,
    `bank_name` VARCHAR(100) NOT NULL DEFAULT 'ธนาคารกรุงไทย',
    `bank_account_no` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `scholarship_funds_fund_code_key`(`fund_code`),
    PRIMARY KEY (`fund_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'FINANCE_OFFICER', 'VIEWER') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `last_failed_login_at` DATETIME(3) NULL,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_users_username_key`(`username`),
    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_sessions` (
    `session_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_sessions_token_hash_key`(`token_hash`),
    INDEX `admin_sessions_user_id_idx`(`user_id`),
    INDEX `admin_sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donations` (
    `donation_id` CHAR(36) NOT NULL,
    `reference_no` VARCHAR(30) NOT NULL,
    `fund_id` INTEGER NOT NULL,
    `student_recipient_name` VARCHAR(255) NULL,
    `student_recipient_code` VARCHAR(20) NULL,
    `donor_type` ENUM('INDIVIDUAL', 'CORPORATE') NOT NULL,
    `donor_prefix` VARCHAR(50) NOT NULL,
    `donor_name` VARCHAR(255) NOT NULL,
    `tax_id_encrypted` TEXT NOT NULL,
    `tax_id_masked` VARCHAR(20) NOT NULL,
    `tax_id_hash` CHAR(64) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `need_tax_deduction` BOOLEAN NOT NULL DEFAULT true,
    `pdpa_consent` BOOLEAN NOT NULL DEFAULT true,
    `amount` DECIMAL(12, 2) NOT NULL,
    `transfer_date` DATE NOT NULL,
    `transfer_time` TIME(0) NOT NULL,
    `slip_file_path` VARCHAR(500) NOT NULL,
    `slip_file_hash` CHAR(64) NULL,
    `verification_status` ENUM('PENDING_SLIP_CHECK', 'WAITING_TREASURY_RD', 'COMPLETED_RD', 'REJECTED') NOT NULL DEFAULT 'PENDING_SLIP_CHECK',
    `slip_verified_by` INTEGER NULL,
    `slip_verified_at` DATETIME(3) NULL,
    `rd_submitted_by` INTEGER NULL,
    `rd_submitted_at` DATETIME(3) NULL,
    `rd_confirm_email_sent_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `edonation_sla_due_date` DATE GENERATED ALWAYS AS (DATE_ADD(`transfer_date`, INTERVAL 14 DAY)) STORED,
    `edonation_export_status` ENUM('PENDING', 'EXPORTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `donations_reference_no_key`(`reference_no`),
    INDEX `idx_donations_verification_status`(`verification_status`),
    INDEX `idx_donations_transfer_date`(`transfer_date`),
    INDEX `idx_donations_tax_id_hash`(`tax_id_hash`),
    INDEX `idx_donations_slip_file_hash`(`slip_file_hash`),
    INDEX `idx_donations_edonation_export`(`edonation_export_status`, `verification_status`),
    PRIMARY KEY (`donation_id`),
    CONSTRAINT `chk_donation_positive_amount` CHECK (`amount` > 0),
    CONSTRAINT `chk_student_recipient_when_specific` CHECK (`fund_id` <> 2 OR (`student_recipient_name` IS NOT NULL AND CHAR_LENGTH(TRIM(`student_recipient_name`)) > 0))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `acknowledgement_certificates` (
    `certificate_id` CHAR(36) NOT NULL,
    `donation_id` CHAR(36) NOT NULL,
    `fiscal_year_be` SMALLINT NOT NULL,
    `running_seq` INTEGER NOT NULL,
    `document_no` VARCHAR(30) NOT NULL,
    `pdf_file_path` VARCHAR(500) NULL,
    `email_sent_status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `email_sent_at` DATETIME(3) NULL,
    `issued_by` INTEGER NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `acknowledgement_certificates_donation_id_key`(`donation_id`),
    UNIQUE INDEX `acknowledgement_certificates_document_no_key`(`document_no`),
    UNIQUE INDEX `acknowledgement_certificates_fiscal_year_be_running_seq_key`(`fiscal_year_be`, `running_seq`),
    PRIMARY KEY (`certificate_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edonation_export_batches` (
    `batch_id` INTEGER NOT NULL AUTO_INCREMENT,
    `batch_no` VARCHAR(30) NOT NULL,
    `date_from` DATE NOT NULL,
    `date_to` DATE NOT NULL,
    `total_records` INTEGER NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `exported_by` INTEGER NOT NULL,
    `exported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,

    UNIQUE INDEX `edonation_export_batches_batch_no_key`(`batch_no`),
    PRIMARY KEY (`batch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edonation_export_items` (
    `item_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` INTEGER NOT NULL,
    `donation_id` CHAR(36) NOT NULL,

    UNIQUE INDEX `edonation_export_items_batch_id_donation_id_key`(`batch_id`, `donation_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_inquiries` (
    `inquiry_id` BIGINT NOT NULL AUTO_INCREMENT,
    `reference_no` VARCHAR(30) NULL,
    `inquirer_name` VARCHAR(255) NOT NULL,
    `contact_info` VARCHAR(255) NOT NULL,
    `inquiry_type` VARCHAR(50) NOT NULL DEFAULT 'FOLLOW_UP_EDONATION',
    `message` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `resolved_by` INTEGER NULL,
    `resolved_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    PRIMARY KEY (`inquiry_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(50) NOT NULL,
    `target_table` VARCHAR(50) NOT NULL,
    `target_id` VARCHAR(64) NOT NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `landing_page_configs` (
    `config_id` INTEGER NOT NULL AUTO_INCREMENT,
    `hero_badge_text` VARCHAR(255) NOT NULL DEFAULT '🎓 กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา',
    `hero_title_line1` VARCHAR(255) NOT NULL DEFAULT 'ให้โอกาสทางการศึกษา',
    `hero_title_line2` VARCHAR(255) NOT NULL DEFAULT 'สร้างอนาคตทางการแพทย์',
    `hero_description` TEXT NOT NULL,
    `hero_image_path` VARCHAR(500) NOT NULL,
    `hero_image_caption` VARCHAR(255) NULL,
    `top_announcement_text` TEXT NOT NULL,
    `show_total_raised` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`config_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pr_news_articles` (
    `article_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL DEFAULT 'ข่าวประชาสัมพันธ์',
    `summary` TEXT NOT NULL,
    `content_html` TEXT NULL,
    `cover_image_path` VARCHAR(500) NULL,
    `published_date` DATE NOT NULL DEFAULT (curdate()),
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_by` INTEGER NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_pr_news_published`(`is_published`, `is_pinned` DESC, `published_date` DESC),
    PRIMARY KEY (`article_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `landing_carousel_slides` (
    `slide_id` INTEGER NOT NULL AUTO_INCREMENT,
    `display_order` INTEGER NOT NULL DEFAULT 1,
    `badge_tag` VARCHAR(150) NOT NULL,
    `slide_subtitle` VARCHAR(255) NOT NULL,
    `slide_caption` TEXT NOT NULL,
    `image_path` VARCHAR(500) NOT NULL,
    `cta_url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_carousel_active_order`(`is_active`, `display_order`),
    PRIMARY KEY (`slide_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_notifications` (
    `notification_id` BIGINT NOT NULL AUTO_INCREMENT,
    `donation_id` CHAR(36) NOT NULL,
    `notify_type` VARCHAR(50) NOT NULL DEFAULT 'NEW_SLIP_UPLOADED',
    `title` VARCHAR(255) NOT NULL,
    `channel_sent` VARCHAR(50) NOT NULL DEFAULT 'WEB,EMAIL',
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_by` INTEGER NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_admin_notifications_unread`(`is_read`, `created_at` DESC),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donations` ADD CONSTRAINT `donations_fund_id_fkey` FOREIGN KEY (`fund_id`) REFERENCES `scholarship_funds`(`fund_id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `donations` ADD CONSTRAINT `donations_slip_verified_by_fkey` FOREIGN KEY (`slip_verified_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donations` ADD CONSTRAINT `donations_rd_submitted_by_fkey` FOREIGN KEY (`rd_submitted_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `acknowledgement_certificates` ADD CONSTRAINT `acknowledgement_certificates_donation_id_fkey` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`donation_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `acknowledgement_certificates` ADD CONSTRAINT `acknowledgement_certificates_issued_by_fkey` FOREIGN KEY (`issued_by`) REFERENCES `admin_users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edonation_export_batches` ADD CONSTRAINT `edonation_export_batches_exported_by_fkey` FOREIGN KEY (`exported_by`) REFERENCES `admin_users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edonation_export_items` ADD CONSTRAINT `edonation_export_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `edonation_export_batches`(`batch_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edonation_export_items` ADD CONSTRAINT `edonation_export_items_donation_id_fkey` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`donation_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_inquiries` ADD CONSTRAINT `contact_inquiries_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `landing_page_configs` ADD CONSTRAINT `landing_page_configs_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pr_news_articles` ADD CONSTRAINT `pr_news_articles_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pr_news_articles` ADD CONSTRAINT `pr_news_articles_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `landing_carousel_slides` ADD CONSTRAINT `landing_carousel_slides_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_notifications` ADD CONSTRAINT `admin_notifications_donation_id_fkey` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`donation_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_notifications` ADD CONSTRAINT `admin_notifications_read_by_fkey` FOREIGN KEY (`read_by`) REFERENCES `admin_users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
