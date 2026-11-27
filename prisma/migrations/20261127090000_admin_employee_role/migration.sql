-- Roles become ADMIN (full access) and EMPLOYEE (daily donation work only).
-- Widen the enum first so any existing FINANCE_OFFICER / VIEWER rows can be moved to EMPLOYEE.
ALTER TABLE `admin_users` MODIFY `role` ENUM('ADMIN', 'FINANCE_OFFICER', 'VIEWER', 'EMPLOYEE') NOT NULL;
UPDATE `admin_users` SET `role` = 'EMPLOYEE' WHERE `role` IN ('FINANCE_OFFICER', 'VIEWER');
ALTER TABLE `admin_users` MODIFY `role` ENUM('ADMIN', 'EMPLOYEE') NOT NULL;
