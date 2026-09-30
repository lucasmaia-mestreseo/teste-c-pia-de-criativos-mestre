-- Tarefas: a project (client) has tasks — e.g. "Solicitação de Banners - Atualização de
-- Campanhas" — and each piece belongs to a task with a banner number (B01, B02…).
-- File names follow the agency pattern: [Cliente] [1080x1350] [B01] Nome da tarefa.

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON public.project_tasks (project_id);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Same rule as the project itself: whoever can access the project can see and manage its tasks.
DROP POLICY IF EXISTS "Project members can view tasks" ON public.project_tasks;
CREATE POLICY "Project members can view tasks" ON public.project_tasks
  FOR SELECT TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can create tasks" ON public.project_tasks;
CREATE POLICY "Project members can create tasks" ON public.project_tasks
  FOR INSERT TO authenticated WITH CHECK (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can update tasks" ON public.project_tasks;
CREATE POLICY "Project members can update tasks" ON public.project_tasks
  FOR UPDATE TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can delete tasks" ON public.project_tasks;
CREATE POLICY "Project members can delete tasks" ON public.project_tasks
  FOR DELETE TO authenticated USING (public.user_can_access_project(auth.uid(), project_id));

-- Each piece: which task and which banner number (all formats of one banner share the number).
ALTER TABLE public.generated_creatives
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS banner_number integer;

CREATE INDEX IF NOT EXISTS generated_creatives_task_idx ON public.generated_creatives (task_id);
