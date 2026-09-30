import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Permission =
  | 'create_project'
  | 'delete_project'
  | 'edit_project'
  | 'generate_creative'
  | 'delete_creative'
  | 'download_creative'
  | 'manage_brand_kit'
  | 'manage_swipe_files'
  | 'favorite_creative';

export const PERMISSION_LABELS: Record<Permission, string> = {
  create_project: 'Criar projetos',
  delete_project: 'Excluir projetos',
  edit_project: 'Editar projetos',
  generate_creative: 'Gerar criativos',
  delete_creative: 'Excluir criativos',
  download_creative: 'Fazer download',
  manage_brand_kit: 'Editar Brand Kit',
  manage_swipe_files: 'Gerenciar Swipe Files',
  favorite_creative: 'Favoritar criativos',
};

export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

export function usePermissions() {
  const { role, user } = useAuth();

  const { data: rolePermissions } = useQuery({
    queryKey: ['role-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      // role_permissions is readable only by admins (RLS); everyone else asks for their own
      if (role === 'owner' || role === 'admin') {
        const { data } = await supabase
          .from('role_permissions')
          .select('permission, enabled')
          .eq('role', role);
        return data || [];
      }
      const { data, error } = await supabase.functions.invoke('my-permissions', { body: {} });
      if (error) return [];
      return ((data as { permissions?: { permission: string; enabled: boolean }[] })?.permissions) || [];
    },
    enabled: !!role,
  });

  const { data: projectAccess } = useQuery({
    queryKey: ['user-project-access', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_project_access')
        .select('project_id')
        .eq('user_id', user.id);
      // null means no restrictions (access to all)
      return data && data.length > 0 ? data.map((d) => d.project_id) : null;
    },
    enabled: !!user,
  });

  const can = (permission: Permission): boolean => {
    // Owner always can do everything
    if (role === 'owner') return true;
    if (!rolePermissions) return false;
    const entry = rolePermissions.find((rp) => rp.permission === permission);
    return entry?.enabled ?? false;
  };

  const canAccessProject = (projectId: string): boolean => {
    // Owner/admin always have full access
    if (role === 'owner' || role === 'admin') return true;
    // No restrictions set = access to all
    if (projectAccess === null || projectAccess === undefined) return true;
    return projectAccess.includes(projectId);
  };

  return { can, canAccessProject, projectAccess, rolePermissions };
}
