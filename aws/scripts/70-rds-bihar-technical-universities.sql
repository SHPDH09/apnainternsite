-- Bihar technical / engineering universities + default programme config for Eng. Management.

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
  '["B.Tech","M.Tech","Diploma","MBA","MCA","Other"]'::jsonb,
  '{
    "B.Tech": [
      "Computer Science & Engineering",
      "Artificial Intelligence & Data Science",
      "Information Technology",
      "Electronics & Communication",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Other"
    ],
    "M.Tech": [
      "Computer Science & Engineering",
      "Artificial Intelligence & Data Science",
      "Information Technology",
      "Electronics & Communication",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Other"
    ],
    "Diploma": [
      "Computer Science & Engineering",
      "Artificial Intelligence & Data Science",
      "Information Technology",
      "Electronics & Communication",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Other"
    ],
    "MBA": ["Other"],
    "MCA": ["Other"],
    "Other": ["Other"]
  }'::jsonb,
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

-- Backfill BEU and other empty engineering configs with default programmes.
UPDATE public.engineering_university_configs c
SET
  courses = '["B.Tech","M.Tech","Diploma","MBA","MCA","Other"]'::jsonb,
  branches_by_course = '{
    "B.Tech": [
      "Computer Science & Engineering",
      "Artificial Intelligence & Data Science",
      "Information Technology",
      "Electronics & Communication",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Other"
    ],
    "M.Tech": [
      "Computer Science & Engineering",
      "Artificial Intelligence & Data Science",
      "Information Technology",
      "Electronics & Communication",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Other"
    ],
    "Diploma": [
      "Computer Science & Engineering",
      "Artificial Intelligence & Data Science",
      "Information Technology",
      "Electronics & Communication",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Other"
    ],
    "MBA": ["Other"],
    "MCA": ["Other"],
    "Other": ["Other"]
  }'::jsonb,
  updated_at = now()
WHERE c.courses IS NULL OR c.courses = '[]'::jsonb OR jsonb_array_length(c.courses) = 0;
