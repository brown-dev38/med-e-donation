-- Store the supplementary character as a CHAR() expression: information_schema
-- metadata uses utf8mb3 and otherwise reports an incorrect '?' default to Prisma.
ALTER TABLE `landing_page_configs`
  ALTER COLUMN `hero_badge_text`
  SET DEFAULT (concat(char(240,159,142,147 using utf8mb4), ' กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา'));
