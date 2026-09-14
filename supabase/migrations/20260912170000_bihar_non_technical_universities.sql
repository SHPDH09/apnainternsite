-- Mirror of aws/scripts/69-rds-bihar-non-technical-universities.sql

INSERT INTO public.universities (name)
SELECT v.name
FROM (
  VALUES
    ('B.R.A. Bihar University, Muzaffarpur'),
    ('B.N. Mandal University, Madhepura'),
    ('Jai Prakash University, Chapra'),
    ('K.S.D. Sanskrit University, Darbhanga'),
    ('L.N. Mithila University, Darbhanga'),
    ('Magadh University, Bodh Gaya'),
    ('MMH Arabic & Persian University, Patna'),
    ('Nalanda Open University'),
    ('Patna University, Patna'),
    ('T.M. Bhagalpur University, Bhagalpur'),
    ('Veer Kunwar Singh University, Ara'),
    ('Patliputra University, Patna'),
    ('Munger University, Munger'),
    ('Purnea University, Purnea')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.universities u WHERE u.name = v.name
);

INSERT INTO public.non_engineering_university_configs (
  university_id,
  courses,
  branches_by_course,
  domains,
  is_active
)
SELECT
  u.id,
  '["B.A.","B.Sc","B.Com","M.A.","M.Sc","M.Com","Other"]'::jsonb,
  '{
    "B.A.": ["Other"],
    "B.Sc": ["Other"],
    "B.Com": ["Other"],
    "M.A.": ["Other"],
    "M.Sc": ["Other"],
    "M.Com": ["Other"],
    "Other": ["Other"]
  }'::jsonb,
  '[]'::jsonb,
  true
FROM public.universities u
WHERE u.name IN (
  'B.R.A. Bihar University, Muzaffarpur',
  'B.N. Mandal University, Madhepura',
  'Jai Prakash University, Chapra',
  'K.S.D. Sanskrit University, Darbhanga',
  'L.N. Mithila University, Darbhanga',
  'Magadh University, Bodh Gaya',
  'MMH Arabic & Persian University, Patna',
  'Nalanda Open University',
  'Patna University, Patna',
  'T.M. Bhagalpur University, Bhagalpur',
  'Veer Kunwar Singh University, Ara',
  'Patliputra University, Patna',
  'Munger University, Munger',
  'Purnea University, Purnea'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.non_engineering_university_configs c
  WHERE c.university_id = u.id
);

UPDATE public.non_engineering_university_configs c
SET
  courses = '["B.A.","B.Sc","B.Com","M.A.","M.Sc","M.Com","Other"]'::jsonb,
  branches_by_course = '{
    "B.A.": ["Other"],
    "B.Sc": ["Other"],
    "B.Com": ["Other"],
    "M.A.": ["Other"],
    "M.Sc": ["Other"],
    "M.Com": ["Other"],
    "Other": ["Other"]
  }'::jsonb,
  updated_at = now()
WHERE (c.courses IS NULL OR c.courses = '[]'::jsonb OR jsonb_array_length(c.courses) = 0)
  AND EXISTS (
    SELECT 1 FROM public.universities u
    WHERE u.id = c.university_id
      AND u.name IN (
        'B.R.A. Bihar University, Muzaffarpur',
        'B.N. Mandal University, Madhepura',
        'Jai Prakash University, Chapra',
        'K.S.D. Sanskrit University, Darbhanga',
        'L.N. Mithila University, Darbhanga',
        'Magadh University, Bodh Gaya',
        'MMH Arabic & Persian University, Patna',
        'Nalanda Open University',
        'Patna University, Patna',
        'T.M. Bhagalpur University, Bhagalpur',
        'Veer Kunwar Singh University, Ara',
        'Patliputra University, Patna',
        'Munger University, Munger',
        'Purnea University, Purnea'
      )
  );
