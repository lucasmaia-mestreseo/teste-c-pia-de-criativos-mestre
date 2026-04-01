import { useState, useEffect } from 'react';
import { useAuth, type AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, Trash2, Loader2, Shield } from 'lucide-react';

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  approved: boolean;
  role: AppRole | null;
}

export default function AdminUsers() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canManageUsers = role === 'owner' || role === 'admin';

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');

    const roleMap = new Map<string, AppRole>();
    const priority: AppRole[] = ['owner', 'admin', 'manager', 'analyst'];
    (roles || []).forEach((r: any) => {
      const existing = roleMap.get(r.user_id);
      if (!existing || priority.indexOf(r.role) < priority.indexOf(existing)) {
        roleMap.set(r.user_id, r.role);
      }
    });

    setUsers(
      (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        name: p.name,
        email: p.email,
        approved: p.approved,
        role: roleMap.get(p.user_id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && canManageUsers) fetchUsers();
  }, [authLoading]);

  if (authLoading) return null;
  if (!canManageUsers) return <Navigate to="/" replace />;

  const handleApprove = async (userId: string, approved: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approved })
      .eq('user_id', userId);
    if (error) {
      toast.error('Erro ao atualizar aprovação');
      return;
    }
    // If approving and no role set, assign analyst
    if (approved) {
      const existing = users.find((u) => u.user_id === userId);
      if (!existing?.role) {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'analyst' as any });
      }
    }
    toast.success(approved ? 'Usuário aprovado!' : 'Aprovação removida');
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const target = users.find((u) => u.user_id === userId);
    if (target?.role === 'owner' && role !== 'owner') {
      toast.error('Apenas owners podem alterar outros owners');
      return;
    }
    if (newRole === 'owner' && role !== 'owner') {
      toast.error('Apenas owners podem atribuir o nível owner');
      return;
    }

    // Delete existing roles then insert new one
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
    if (error) {
      toast.error('Erro ao alterar nível');
      return;
    }
    toast.success('Nível alterado!');
    fetchUsers();
  };

  const handleRemoveUser = async (userId: string) => {
    const target = users.find((u) => u.user_id === userId);
    if (target?.role === 'owner') {
      toast.error('Não é possível remover um owner');
      return;
    }
    if (userId === user?.id) {
      toast.error('Você não pode remover a si mesmo');
      return;
    }
    // Remove approval (soft delete)
    await supabase.from('profiles').update({ approved: false }).eq('user_id', userId);
    await supabase.from('user_roles').delete().eq('user_id', userId);
    toast.success('Usuário desativado');
    fetchUsers();
  };

  const roleBadgeColor = (r: AppRole | null) => {
    switch (r) {
      case 'owner': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'admin': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'manager': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'analyst': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const roleLabel = (r: AppRole | null) => {
    switch (r) {
      case 'owner': return 'Owner';
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'analyst': return 'Analista';
      default: return 'Sem nível';
    }
  };

  const availableRoles: AppRole[] = role === 'owner'
    ? ['owner', 'admin', 'manager', 'analyst']
    : ['admin', 'manager', 'analyst'];

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-5 py-3 border-b bg-card">
        <Button size="icon" variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Gerenciar Usuários</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.user_id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                </div>

                <Badge className={`${roleBadgeColor(u.role)} border text-xs`}>
                  {roleLabel(u.role)}
                </Badge>

                <Badge variant={u.approved ? 'default' : 'secondary'} className="text-xs">
                  {u.approved ? 'Aprovado' : 'Pendente'}
                </Badge>

                <div className="flex items-center gap-1">
                  {!u.approved && (
                    <Button size="icon" variant="ghost" onClick={() => handleApprove(u.user_id, true)} title="Aprovar">
                      <Check className="h-4 w-4 text-green-400" />
                    </Button>
                  )}
                  {u.approved && (
                    <Button size="icon" variant="ghost" onClick={() => handleApprove(u.user_id, false)} title="Revogar">
                      <X className="h-4 w-4 text-orange-400" />
                    </Button>
                  )}

                  <Select
                    value={u.role || ''}
                    onValueChange={(v) => handleRoleChange(u.user_id, v as AppRole)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs bg-secondary">
                      <SelectValue placeholder="Definir nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {u.role !== 'owner' && u.user_id !== user?.id && (
                    <Button size="icon" variant="ghost" onClick={() => handleRemoveUser(u.user_id)} title="Desativar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
