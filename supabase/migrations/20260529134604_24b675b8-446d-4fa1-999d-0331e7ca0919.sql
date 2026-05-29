UPDATE public.projects SET name = 'Agência Mestre 2' WHERE id = 'af906054-205d-48f0-ad7f-98944e3cff10';
CREATE UNIQUE INDEX projects_name_unique_ci ON public.projects (lower(name));