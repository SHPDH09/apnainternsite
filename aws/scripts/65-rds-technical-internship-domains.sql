-- Mirror of supabase/migrations/20260912130000_technical_internship_domains.sql
-- Technical internship domains for engineering / BEU registration.

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
merged AS (
  SELECT
    c.id,
    (
      SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
      FROM (
        SELECT DISTINCT trim(both FROM x) AS name
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(c.domains, '[]'::jsonb)) AS x
          UNION ALL
          SELECT tdn.name FROM technical_domain_names tdn
        ) raw
        WHERE trim(both FROM x) <> ''
      ) uniq
    ) AS domains
  FROM public.engineering_university_configs c
)
UPDATE public.engineering_university_configs c
SET
  domains = m.domains,
  updated_at = now()
FROM merged m
WHERE c.id = m.id
  AND c.domains IS DISTINCT FROM m.domains;
