-- Domain label for bundled Accounting / Tally / GST project report template (v1.1).
INSERT INTO public.internship_domains (name)
SELECT 'Accounting, Tally & GST'
WHERE NOT EXISTS (
  SELECT 1 FROM public.internship_domains d WHERE d.name = 'Accounting, Tally & GST'
);
