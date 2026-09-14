-- Production reminder: notification publish + contact/popup tables.
-- Safe to re-run; applies idempotent definitions from repo SQL files.
--
-- On RDS, run in order:
--   1. supabase/hotfix_internship_mode_filtering.sql  (notification RPCs + target_modes)
--   2. supabase/migrations/20260605120000_notification_management.sql
--   3. supabase/site_popups.sql
--   4. supabase/site_contacts.sql
--
-- Or: node aws/scripts/apply-rds-gap-fill.mjs

SELECT 'Run supabase/hotfix_internship_mode_filtering.sql on RDS for notification publish RPCs' AS notice;
