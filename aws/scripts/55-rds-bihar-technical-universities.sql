-- Mirror of supabase/migrations/20260912120000_bihar_technical_universities.sql
-- Technical / engineering Bihar universities for registration / Eng. Management.

INSERT INTO public.universities (name)
SELECT v.name
FROM (
  VALUES
    ('Aryabhatta Knowledge University, Patna'),
    ('Bihar Agricultural University, Sabour'),
    ('Bihar Animal Sciences University, Patna'),
    ('Bihar Engineering University, Patna')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.universities u WHERE u.name = v.name
);

INSERT INTO public.engineering_university_configs (
  university_id,
  courses,
  branches_by_course,
  domains,
  is_active
)
SELECT
  u.id,
  '[]'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  true
FROM public.universities u
WHERE u.name IN (
  'Aryabhatta Knowledge University, Patna',
  'Bihar Agricultural University, Sabour',
  'Bihar Animal Sciences University, Patna',
  'Bihar Engineering University, Patna'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.engineering_university_configs c
  WHERE c.university_id = u.id
);
