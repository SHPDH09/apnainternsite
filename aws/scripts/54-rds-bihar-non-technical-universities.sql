-- Mirror of supabase/migrations/20260912110000_bihar_non_technical_universities.sql
-- Non-technical Bihar universities for registration / Non-Eng. Management.

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
  '[]'::jsonb,
  '{}'::jsonb,
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
