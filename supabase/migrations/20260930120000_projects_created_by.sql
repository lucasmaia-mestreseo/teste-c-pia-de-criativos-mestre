-- "Meus projetos": who created each project.
-- Every project stays visible to everyone (nothing changes in the policies);
-- this only lets the app separate "Meus projetos" from "Todos os projetos".
-- Existing projects keep created_by = NULL and show up only under "Todos".

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS projects_created_by_idx ON public.projects (created_by);
