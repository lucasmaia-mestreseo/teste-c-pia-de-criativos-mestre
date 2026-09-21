
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'analyst');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create template_prompts table
CREATE TABLE public.template_prompts (
  id text PRIMARY KEY,
  prompt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.template_prompts ENABLE ROW LEVEL SECURITY;

-- 5. Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Create is_approved security definer function
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND approved = true
  )
$$;

-- 7. Create has_any_admin_role helper (owner or admin)
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- 8. Create has_project_access helper (owner, admin, manager)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin', 'manager')
  )
$$;

-- 9. Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Trigger for updated_at on template_prompts
CREATE TRIGGER update_template_prompts_updated_at
  BEFORE UPDATE ON public.template_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS POLICIES ============

-- profiles: authenticated can read all, update own
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- user_roles: authenticated can read, owner/admin can insert/delete
CREATE POLICY "Authenticated users can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner or admin can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Owner or admin can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- template_prompts: authenticated can read, owner can update
CREATE POLICY "Authenticated users can view template prompts"
  ON public.template_prompts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner can update template prompts"
  ON public.template_prompts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert template prompts"
  ON public.template_prompts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============ UPDATE EXISTING TABLE POLICIES ============

-- Drop old permissive policies on projects
DROP POLICY IF EXISTS "Anyone can create projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can update projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;

-- projects: authenticated+approved can read; owner/admin/manager can create/update; owner/admin can delete
CREATE POLICY "Approved users can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Owner admin manager can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid()));

CREATE POLICY "Owner admin manager can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid()));

CREATE POLICY "Owner admin can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- Drop old permissive policies on swipe_files
DROP POLICY IF EXISTS "Anyone can create swipe_files" ON public.swipe_files;
DROP POLICY IF EXISTS "Anyone can delete swipe_files" ON public.swipe_files;
DROP POLICY IF EXISTS "Anyone can update swipe_files" ON public.swipe_files;
DROP POLICY IF EXISTS "Anyone can view swipe_files" ON public.swipe_files;

CREATE POLICY "Approved users can view swipe_files"
  ON public.swipe_files FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Owner admin manager can create swipe_files"
  ON public.swipe_files FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid()));

CREATE POLICY "Owner admin manager can update swipe_files"
  ON public.swipe_files FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid()));

CREATE POLICY "Owner admin manager can delete swipe_files"
  ON public.swipe_files FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid()));

-- Drop old permissive policies on brand_kits
DROP POLICY IF EXISTS "Anyone can create brand_kits" ON public.brand_kits;
DROP POLICY IF EXISTS "Anyone can delete brand_kits" ON public.brand_kits;
DROP POLICY IF EXISTS "Anyone can update brand_kits" ON public.brand_kits;
DROP POLICY IF EXISTS "Anyone can view brand_kits" ON public.brand_kits;

CREATE POLICY "Approved users can view brand_kits"
  ON public.brand_kits FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Owner admin manager can create brand_kits"
  ON public.brand_kits FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid()));

CREATE POLICY "Owner admin manager can update brand_kits"
  ON public.brand_kits FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid()));

CREATE POLICY "Owner admin manager can delete brand_kits"
  ON public.brand_kits FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid()));

-- Drop old permissive policies on generated_creatives
DROP POLICY IF EXISTS "Anyone can create generated_creatives" ON public.generated_creatives;
DROP POLICY IF EXISTS "Anyone can delete generated_creatives" ON public.generated_creatives;
DROP POLICY IF EXISTS "Anyone can view generated_creatives" ON public.generated_creatives;

CREATE POLICY "Approved users can view generated_creatives"
  ON public.generated_creatives FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Approved users can create generated_creatives"
  ON public.generated_creatives FOR INSERT TO authenticated
  WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Owner admin manager can delete generated_creatives"
  ON public.generated_creatives FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid()));
