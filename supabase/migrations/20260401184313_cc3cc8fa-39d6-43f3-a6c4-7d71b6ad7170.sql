ALTER TABLE public.projects ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
UPDATE public.projects SET onboarding_completed = true;