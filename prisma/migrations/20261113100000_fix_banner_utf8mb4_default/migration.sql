-- Ensure the emoji in the default is decoded as utf8mb4 by the MySQL session.
SET NAMES utf8mb4;
ALTER TABLE `landing_page_configs`
  ALTER COLUMN `hero_badge_text`
  SET DEFAULT '🎓 กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา';
