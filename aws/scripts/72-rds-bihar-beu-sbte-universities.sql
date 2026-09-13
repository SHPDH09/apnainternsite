-- Bihar Engineering University + State Board of Technical Education, Bihar
-- with standard engineering programmes and technical internship domains.

INSERT INTO public.universities (name)
SELECT v.name
FROM (
  VALUES
    ('Bihar Engineering University'),
    ('State Board of Technical Education, Bihar')
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
  'Bihar Engineering University',
  'State Board of Technical Education, Bihar',
  'Bihar Engineering University, Patna'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.engineering_university_configs c
  WHERE c.university_id = u.id
);

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
FROM public.universities u
WHERE c.university_id = u.id
  AND u.name IN (
    'Bihar Engineering University',
    'State Board of Technical Education, Bihar',
    'Bihar Engineering University, Patna'
  )
  AND (
    c.courses IS NULL
    OR c.courses = '[]'::jsonb
    OR jsonb_array_length(c.courses) = 0
  );

-- Merge technical internship domains (same set as 65-rds-technical-internship-domains.sql)
WITH technical_domain_names(name) AS (
  VALUES
    ('Software Development'),
    ('Web Development'),
    ('Frontend Development'),
    ('Backend Development'),
    ('Full Stack Development'),
    ('Mobile App Development'),
    ('Android Development'),
    ('iOS Development'),
    ('Cross-Platform App Development'),
    ('React.js Development'),
    ('Angular Development'),
    ('Vue.js Development'),
    ('Node.js Development'),
    ('Java Development'),
    ('Python Development'),
    ('C/C++ Development'),
    ('C# / .NET Development'),
    ('PHP Development'),
    ('Laravel Development'),
    ('Java Spring Boot Development'),
    ('Flutter Development'),
    ('React Native Development'),
    ('DevOps'),
    ('Cloud Computing'),
    ('AWS Cloud'),
    ('Microsoft Azure'),
    ('Google Cloud Platform (GCP)'),
    ('Cloud Architecture'),
    ('Cybersecurity'),
    ('Ethical Hacking'),
    ('Network Security'),
    ('Information Security'),
    ('Application Security'),
    ('Penetration Testing'),
    ('Digital Forensics'),
    ('Data Science'),
    ('Data Analytics'),
    ('Data Engineering'),
    ('Big Data'),
    ('Business Intelligence'),
    ('Machine Learning'),
    ('Deep Learning'),
    ('Artificial Intelligence'),
    ('Generative AI'),
    ('Natural Language Processing (NLP)'),
    ('Computer Vision'),
    ('Robotics'),
    ('Internet of Things (IoT)'),
    ('Embedded Systems'),
    ('VLSI Design'),
    ('Semiconductor Technology'),
    ('FPGA Development'),
    ('Embedded Software'),
    ('Firmware Development'),
    ('Blockchain'),
    ('Web3 Development'),
    ('Smart Contract Development'),
    ('Cryptocurrency Technology'),
    ('Database Management'),
    ('SQL Development'),
    ('Database Administration'),
    ('PostgreSQL'),
    ('MySQL'),
    ('MongoDB'),
    ('Oracle Database'),
    ('UI/UX Design'),
    ('Product Design'),
    ('Software Testing'),
    ('Quality Assurance (QA)'),
    ('Automation Testing'),
    ('Manual Testing'),
    ('Performance Testing'),
    ('API Testing'),
    ('Game Development'),
    ('AR/VR Development'),
    ('3D Development'),
    ('Computer Graphics'),
    ('GIS & Geospatial Technology'),
    ('Network Engineering'),
    ('System Administration'),
    ('IT Infrastructure'),
    ('Technical Support / IT Support'),
    ('Site Reliability Engineering (SRE)'),
    ('Platform Engineering'),
    ('Kubernetes & Containerization'),
    ('Docker'),
    ('Linux Administration'),
    ('Enterprise Software Development'),
    ('ERP Development'),
    ('CRM Development'),
    ('API Development'),
    ('Microservices Architecture'),
    ('Software Architecture'),
    ('Solutions Architecture'),
    ('Automation & RPA'),
    ('Robotic Process Automation'),
    ('Data Visualization'),
    ('Technical Research & Development'),
    ('Computer Science Research'),
    ('Information Technology')
),
target_configs AS (
  SELECT c.id, c.domains
  FROM public.engineering_university_configs c
  JOIN public.universities u ON u.id = c.university_id
  WHERE u.name IN (
    'Bihar Engineering University',
    'State Board of Technical Education, Bihar',
    'Bihar Engineering University, Patna'
  )
),
merged AS (
  SELECT
    tc.id,
    (
      SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
      FROM (
        SELECT DISTINCT trim(both FROM x) AS name
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(tc.domains, '[]'::jsonb)) AS x
          UNION ALL
          SELECT tdn.name FROM technical_domain_names tdn
        ) raw
        WHERE trim(both FROM x) <> ''
      ) uniq
    ) AS domains
  FROM target_configs tc
)
UPDATE public.engineering_university_configs c
SET
  domains = m.domains,
  updated_at = now()
FROM merged m
WHERE c.id = m.id
  AND c.domains IS DISTINCT FROM m.domains;
