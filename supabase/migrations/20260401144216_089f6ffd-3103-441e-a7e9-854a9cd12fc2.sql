
-- 1. Add active column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Add created_by column to generated_creatives
ALTER TABLE public.generated_creatives ADD COLUMN IF NOT EXISTS created_by uuid;

-- 3. Trigger to auto-owner fabioricotta@agenciamestre.com
CREATE OR REPLACE FUNCTION public.auto_owner_fabioricotta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'fabioricotta@agenciamestre.com' THEN
    NEW.approved := true;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_owner_fabioricotta
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_owner_fabioricotta();

-- 4. Allow owner/admin to update any profile (for admin user management)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users or admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_any_admin_role(auth.uid()));

-- 5. Allow owner/admin to update roles
CREATE POLICY "Owner or admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_any_admin_role(auth.uid()));
