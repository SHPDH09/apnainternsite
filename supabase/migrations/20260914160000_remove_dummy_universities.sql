-- Mirror of aws/scripts/76-rds-remove-dummy-universities.sql
-- Remove dummy / test universities (keep real Bihar Engineering University entries).

DELETE FROM public.engineering_university_configs c
USING public.universities u
WHERE c.university_id = u.id
  AND u.name IN ('BEU', 'duplicate test uni', 'Duplicate Test Uni', 'test LNMU');

DELETE FROM public.non_engineering_university_configs c
USING public.universities u
WHERE c.university_id = u.id
  AND u.name IN ('BEU', 'duplicate test uni', 'Duplicate Test Uni', 'test LNMU');

DELETE FROM public.colleges c
USING public.universities u
WHERE c.university_id = u.id
  AND u.name IN ('BEU', 'duplicate test uni', 'Duplicate Test Uni', 'test LNMU');

DELETE FROM public.universities
WHERE name IN ('BEU', 'duplicate test uni', 'Duplicate Test Uni', 'test LNMU');
