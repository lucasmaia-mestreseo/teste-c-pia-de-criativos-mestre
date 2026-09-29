-- ════════════════════════════════════════════════════════════════════
--  Redimensionar, Desdobramento, Painel de Custos e Revisão automática
--  Documentação: docs/MELHORIAS-2026-09.md
-- ════════════════════════════════════════════════════════════════════

-- 1) generated_creatives: origem, custo, briefing e revisão de cada criativo
ALTER TABLE public.generated_creatives
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'generate',
  ADD COLUMN IF NOT EXISTS parent_creative_id uuid REFERENCES public.generated_creatives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_image_url text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12, 6),
  ADD COLUMN IF NOT EXISTS briefing jsonb,
  ADD COLUMN IF NOT EXISTS generation_meta jsonb,
  ADD COLUMN IF NOT EXISTS review jsonb,
  ADD COLUMN IF NOT EXISTS review_status text;

ALTER TABLE public.generated_creatives
  DROP CONSTRAINT IF EXISTS generated_creatives_kind_check;
ALTER TABLE public.generated_creatives
  ADD CONSTRAINT generated_creatives_kind_check
  CHECK (kind IN ('generate', 'dynamic', 'resize', 'unfold', 'fix'));

ALTER TABLE public.generated_creatives
  DROP CONSTRAINT IF EXISTS generated_creatives_review_status_check;
ALTER TABLE public.generated_creatives
  ADD CONSTRAINT generated_creatives_review_status_check
  CHECK (review_status IS NULL OR review_status IN ('pending', 'approved', 'issues', 'error'));

-- Criativos da aba Dinâmica antigos eram identificados só pelo prefixo do prompt
UPDATE public.generated_creatives
  SET kind = 'dynamic'
  WHERE kind = 'generate' AND prompt ~ '^\[(conservative|innovative|radical)\]';

CREATE INDEX IF NOT EXISTS generated_creatives_project_kind_idx
  ON public.generated_creatives (project_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS generated_creatives_parent_idx
  ON public.generated_creatives (parent_creative_id);

-- 2) brand_kits: cache da análise do logo (evita uma chamada de visão por geração)
ALTER TABLE public.brand_kits
  ADD COLUMN IF NOT EXISTS logo_analysis text,
  ADD COLUMN IF NOT EXISTS logo_analysis_source text;

-- 3) ai_usage: uma linha por chamada ao OpenRouter (base do Painel de Custos)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  settings_key text,
  model text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid,
  success boolean NOT NULL DEFAULT true,
  status_code integer,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(12, 6),
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON public.ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_project_idx ON public.ai_usage (project_id, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Só administradores leem; a escrita é feita pelas Edge Functions com a service role.
DROP POLICY IF EXISTS "Admins can view ai_usage" ON public.ai_usage;
CREATE POLICY "Admins can view ai_usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));