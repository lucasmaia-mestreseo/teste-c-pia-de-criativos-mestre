import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth, type AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, X, Trash2, Loader2, Shield, Plus, Power, PowerOff,
  Save, Pencil, BarChart3, FileCode, FolderOpen, Users, Upload, ImageIcon,
  Mail, AlertCircle, Search, Star, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// ─── Types ───

interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
}

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  approved: boolean;
  role: AppRole | null;
  email_confirmed: boolean;
  has_profile: boolean;
}

interface ProjectRow {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  creative_count: number;
  swipe_count: number;
}

interface UsageRow {
  user_id: string;
  name: string;
  email: string;
  count: number;
  downloads: number;
  favorites: number;
}

interface PromptRow {
  id: string;
  prompt: string;
  style_prompt: string;
  base_image_url: string | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  hero: 'Hero',
  'problem-solution': 'Problema → Solução',
  'main-benefit': 'Benefício Principal',
  'list-ad': 'Lista (List Ad)',
  authority: 'Autoridade',
  demonstration: 'Demonstração',
  'direct-offer': 'Oferta Direta',
  'context-extraction': 'Extração de Contexto (URL)',
  'voice-analysis': 'Análise de Tom de Voz',
  'dynamic-conservative': 'Geração Dinâmica — Conservador',
  'dynamic-innovative': 'Geração Dinâmica — Inovador',
  'dynamic-radical': 'Geração Dinâmica — Fora da Caixa',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrador',
  manager: 'Gerente',
  analyst: 'Analista',
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

type Section = 'projects' | 'users' | 'usage' | 'prompts' | 'formats';

const SIDEBAR_ITEMS: { id: Section; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
  { id: 'projects', label: 'Projetos', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'users', label: 'Usuários', icon: <Users className="h-4 w-4" /> },
  { id: 'usage', label: 'Uso do Sistema', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'formats', label: 'Formatos', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'prompts', label: 'Prompts', icon: <FileCode className="h-4 w-4" />, ownerOnly: true },
];

export default function AdminPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>('projects');

  const canManageUsers = role === 'owner' || role === 'admin';

  if (authLoading) return null;
  if (!canManageUsers) return <Navigate to="/" replace />;

  const visibleItems = SIDEBAR_ITEMS.filter((i) => !i.ownerOnly || role === 'owner');

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-5 py-3 border-b bg-card">
        <Button size="icon" variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Administração</h1>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 min-h-[calc(100vh-57px)] border-r bg-card/50 p-3 space-y-1 shrink-0">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all text-left border border-transparent',
                activeSection === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:border-primary/50 hover:text-primary'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">
          {activeSection === 'projects' && <ProjectsTab />}
          {activeSection === 'users' && <UsersTab currentUser={user} currentRole={role} />}
          {activeSection === 'usage' && <UsageTab />}
          {activeSection === 'formats' && <FormatsTab />}
          {activeSection === 'prompts' && role === 'owner' && <PromptsTab userId={user?.id} />}
        </main>
      </div>
    </div>
  );
}

// ─── Projects Tab ───

function ProjectsTab() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const fetchProjects = async () => {
    const { data: projs } = await supabase.from('projects').select('id, name, active, created_at').order('created_at', { ascending: false });

    const projectRows: ProjectRow[] = [];
    for (const p of projs || []) {
      const { count: creativeCount } = await supabase.from('generated_creatives').select('*', { count: 'exact', head: true }).eq('project_id', p.id);
      const { count: swipeCount } = await supabase.from('swipe_files').select('*', { count: 'exact', head: true }).eq('project_id', p.id);
      projectRows.push({
        ...p,
        active: (p as any).active ?? true,
        creative_count: creativeCount || 0,
        swipe_count: swipeCount || 0,
      });
    }
    setProjects(projectRows);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const filtered = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (statusFilter === 'active') list = list.filter((p) => p.active);
    if (statusFilter === 'inactive') list = list.filter((p) => !p.active);
    return list;
  }, [projects, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [search, statusFilter, perPage]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('projects').insert({ name: newName.trim() });
    if (error) toast.error('Erro ao criar projeto');
    else {
      toast.success('Projeto criado!');
      setNewName('');
      fetchProjects();
    }
    setCreating(false);
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('projects').update({ active: !active } as any).eq('id', id);
    if (error) toast.error('Erro ao atualizar');
    else fetchProjects();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este projeto e todos os seus dados?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) toast.error('Erro ao remover');
    else {
      toast.success('Projeto removido');
      fetchProjects();
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Create project - separate row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase">Projetos ({filtered.length})</h3>
        <div className="flex gap-2">
          <Input placeholder="Nome do novo projeto" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} className="bg-secondary max-w-xs" />
          <Button onClick={handleCreate} disabled={creating}><Plus className="h-4 w-4 mr-1" /> Criar</Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar projeto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary" />
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
            </Button>
          ))}
        </div>
        <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
          <SelectTrigger className="w-24 bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 250].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project list */}
      <div className="space-y-2">
        {paginated.map((p) => (
          <div key={p.id} className={`flex items-center gap-4 p-4 rounded-lg border bg-card ${!p.active ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yyyy')}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{p.creative_count} criativos</span>
              <span>{p.swipe_count} swipes</span>
            </div>
            <Badge variant={p.active ? 'default' : 'secondary'} className="text-xs">
              {p.active ? 'Ativo' : 'Inativo'}
            </Badge>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => handleToggleActive(p.id, p.active)} title={p.active ? 'Desativar' : 'Ativar'}>
                {p.active ? <PowerOff className="h-4 w-4 text-orange-400" /> : <Power className="h-4 w-4 text-green-400" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} title="Remover">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ───

function UsersTab({ currentUser, currentRole }: { currentUser: any; currentRole: AppRole | null }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [resending, setResending] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    // Fetch auth users via edge function
    const { data: authData, error: authError } = await supabase.functions.invoke('admin-list-users');
    const authUsers: AuthUser[] = authError ? [] : (authData || []);

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

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const mergedIds = new Set<string>();
    const merged: UserRow[] = [];

    // All auth users first
    authUsers.forEach((au) => {
      mergedIds.add(au.id);
      const profile = profileMap.get(au.id);
      merged.push({
        user_id: au.id,
        name: profile?.name || au.email?.split('@')[0] || 'Sem nome',
        email: au.email || profile?.email || '',
        approved: profile?.approved || false,
        role: roleMap.get(au.id) || null,
        email_confirmed: !!au.email_confirmed_at,
        has_profile: !!profile,
      });
    });

    // Profiles not in auth (edge case)
    (profiles || []).forEach((p: any) => {
      if (!mergedIds.has(p.user_id)) {
        merged.push({
          user_id: p.user_id,
          name: p.name,
          email: p.email,
          approved: p.approved,
          role: roleMap.get(p.user_id) || null,
          email_confirmed: true,
          has_profile: true,
        });
      }
    });

    setUsers(merged);
    setLoading(false);
  };

  const fetchInvitations = async () => {
    const { data } = await supabase.from('user_invitations').select('*').order('created_at', { ascending: false });
    setInvitations(data || []);
  };

  useEffect(() => { fetchUsers(); fetchInvitations(); }, []);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.endsWith('@agenciamestre.com')) {
      toast.error('Apenas emails @agenciamestre.com são permitidos');
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', { body: { email } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Convite enviado!');
      setInviteEmail('');
      fetchInvitations();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleApprove = async (userId: string, approved: boolean) => {
    const target = users.find((u) => u.user_id === userId);
    if (!target?.has_profile) {
      toast.error('Usuário precisa confirmar o email antes de ser aprovado');
      return;
    }
    await supabase.from('profiles').update({ approved }).eq('user_id', userId);
    if (approved) {
      if (!target?.role) {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'analyst' as any });
      }
    }
    toast.success(approved ? 'Usuário aprovado!' : 'Aprovação removida');
    fetchUsers();
  };

  const handleResendConfirmation = async (email: string, userId: string) => {
    setResending(userId);
    try {
      const { error } = await supabase.functions.invoke('admin-resend-confirmation', {
        body: { email },
      });
      if (error) throw error;
      toast.success('Email de confirmação reenviado!');
    } catch {
      toast.error('Erro ao reenviar email');
    } finally {
      setResending(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const target = users.find((u) => u.user_id === userId);
    if (target?.role === 'owner' && currentRole !== 'owner') {
      toast.error('Apenas owners podem alterar outros owners');
      return;
    }
    if (newRole === 'owner' && currentRole !== 'owner') {
      toast.error('Apenas owners podem atribuir o nível owner');
      return;
    }
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
    toast.success('Nível alterado!');
    fetchUsers();
  };

  const handleRemoveUser = (userId: string) => {
    const target = users.find((u) => u.user_id === userId);
    if (target?.role === 'owner') { toast.error('Não é possível remover um owner'); return; }
    if (userId === currentUser?.id) { toast.error('Você não pode remover a si mesmo'); return; }
    setDeleteTarget(target || null);
    setDeleteConfirmName('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleteTarget.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Usuário excluído permanentemente');
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir usuário');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditName(u.name);
    setEditPassword('');
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);

    if (editName.trim() && editName.trim() !== editUser.name) {
      await supabase.from('profiles').update({ name: editName.trim() }).eq('user_id', editUser.user_id);
    }

    if (editPassword.length > 0) {
      if (editPassword.length < 6) {
        toast.error('Senha deve ter pelo menos 6 caracteres');
        setSaving(false);
        return;
      }
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: editUser.user_id, newPassword: editPassword },
      });
      if (res.error) {
        toast.error('Erro ao resetar senha');
        setSaving(false);
        return;
      }
    }

    toast.success('Usuário atualizado!');
    setEditUser(null);
    setSaving(false);
    fetchUsers();
  };

  const availableRoles: AppRole[] = currentRole === 'owner'
    ? ['owner', 'admin', 'manager', 'analyst']
    : ['admin', 'manager', 'analyst'];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      {/* Invite section */}
      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase">Convidar Usuário</h3>
        <div className="flex gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@agenciamestre.com"
            className="bg-secondary max-w-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          <Button onClick={handleInvite} disabled={inviting} size="sm">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Convidar
          </Button>
        </div>
        {invitations.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Convites pendentes</p>
            {invitations.filter(inv => !inv.accepted_at).map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <span>{inv.email}</span>
                <span className="text-[10px]">— {format(new Date(inv.created_at), 'dd/MM/yyyy')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id}>
                <TableCell>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  <Badge className={`${roleBadgeColor(u.role)} border text-xs`}>
                    {ROLE_LABELS[u.role || ''] || 'Sem nível'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {!u.email_confirmed && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs mr-1">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Email não confirmado
                    </Badge>
                  )}
                  <Badge variant={u.approved ? 'default' : 'secondary'} className="text-xs">
                    {u.approved ? 'Aprovado' : 'Pendente'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select value={u.role || ''} onValueChange={(v) => handleRoleChange(u.user_id, v as AppRole)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs bg-secondary">
                      <SelectValue placeholder="Definir nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!u.email_confirmed && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleResendConfirmation(u.email, u.user_id)}
                        disabled={resending === u.user_id}
                        title="Reenviar email de confirmação"
                      >
                        {resending === u.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4 text-red-400" />
                        )}
                      </Button>
                    )}
                    {!u.approved && u.email_confirmed && u.has_profile && (
                      <Button size="icon" variant="ghost" onClick={() => handleApprove(u.user_id, true)} title="Aprovar">
                        <Check className="h-4 w-4 text-green-400" />
                      </Button>
                    )}
                    {u.approved && (
                      <Button size="icon" variant="ghost" onClick={() => handleApprove(u.user_id, false)} title="Revogar">
                        <X className="h-4 w-4 text-orange-400" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.role !== 'owner' && u.user_id !== currentUser?.id && (
                      <Button size="icon" variant="ghost" onClick={() => handleRemoveUser(u.user_id)} title="Desativar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Nova Senha (deixe vazio para não alterar)</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="bg-secondary" placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(''); } }}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Excluir Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta ação é <strong className="text-destructive">irreversível</strong>. O usuário será permanentemente removido do sistema.
            </p>
            <p className="text-sm">
              Para confirmar, digite o nome do usuário: <strong>{deleteTarget?.name}</strong>
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Digite o nome exato do usuário"
              className="bg-secondary"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting || deleteConfirmName !== deleteTarget?.name}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Excluir Permanentemente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
// ─── Usage Tab ───

function UsageTab() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsage = async () => {
    setLoading(true);
    const now = new Date();
    let since: Date;
    if (period === 'day') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      since = new Date(now);
      since.setDate(since.getDate() - 7);
    } else {
      since = new Date(now);
      since.setMonth(since.getMonth() - 1);
    }

    const sinceISO = since.toISOString();

    // Fetch creatives, downloads, favorites and profiles in parallel
    const [creativesRes, downloadsRes, favoritesRes, profilesRes] = await Promise.all([
      supabase.from('generated_creatives').select('created_by, created_at').gte('created_at', sinceISO),
      supabase.from('user_downloads' as any).select('user_id, created_at').gte('created_at', sinceISO),
      supabase.from('generated_creatives').select('created_by').eq('favorite', true),
      supabase.from('profiles').select('user_id, name, email'),
    ]);

    const creatives = creativesRes.data || [];
    const downloads = (downloadsRes.data || []) as any[];
    const favorites = favoritesRes.data || [];
    const profiles = profilesRes.data || [];

    const countMap = new Map<string, number>();
    (creatives as any[]).forEach((c) => {
      if (c.created_by) countMap.set(c.created_by, (countMap.get(c.created_by) || 0) + 1);
    });

    const downloadMap = new Map<string, number>();
    downloads.forEach((d: any) => {
      if (d.user_id) downloadMap.set(d.user_id, (downloadMap.get(d.user_id) || 0) + 1);
    });

    const favMap = new Map<string, number>();
    (favorites as any[]).forEach((f) => {
      if (f.created_by) favMap.set(f.created_by, (favMap.get(f.created_by) || 0) + 1);
    });

    const profileMap = new Map<string, { name: string; email: string }>();
    (profiles as any[]).forEach((p) => profileMap.set(p.user_id, { name: p.name, email: p.email }));

    const allUserIds = new Set<string>();
    countMap.forEach((_, k) => allUserIds.add(k));
    downloadMap.forEach((_, k) => allUserIds.add(k));
    (profiles as any[]).forEach((p) => allUserIds.add(p.user_id));

    const rows: UsageRow[] = [];
    allUserIds.forEach((userId) => {
      const p = profileMap.get(userId);
      rows.push({
        user_id: userId,
        name: p?.name || 'Desconhecido',
        email: p?.email || '',
        count: countMap.get(userId) || 0,
        downloads: downloadMap.get(userId) || 0,
        favorites: favMap.get(userId) || 0,
      });
    });

    // Sort alphabetically by name
    rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    setUsage(rows);
    setLoading(false);
  };

  useEffect(() => { fetchUsage(); }, [period]);

  const periodLabel = { day: 'Hoje', week: 'Últimos 7 dias', month: 'Último mês' };

  const filtered = useMemo(() => {
    if (!search.trim()) return usage;
    const q = search.toLowerCase();
    return usage.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [usage, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {(['day', 'week', 'month'] as const).map((p) => (
          <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>
            {periodLabel[p]}
          </Button>
        ))}
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div key={u.user_id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5" title="Criativos gerados">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{u.count}</span>
                  <span className="text-xs text-muted-foreground">criativos</span>
                </div>
                <div className="flex items-center gap-1.5" title="Downloads">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{u.downloads}</span>
                  <span className="text-xs text-muted-foreground">downloads</span>
                </div>
                <div className="flex items-center gap-1.5" title="Favoritos">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{u.favorites}</span>
                  <span className="text-xs text-muted-foreground">favoritos</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado para o período selecionado.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Prompts Tab ───

const INTERNAL_PROMPT_IDS = ['context-extraction', 'voice-analysis'];

function PromptsTab({ userId }: { userId?: string }) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [styleEdits, setStyleEdits] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    supabase.from('template_prompts').select('id, prompt, style_prompt, base_image_url').then(({ data }) => {
      setPrompts((data as any) || []);
      setLoading(false);
    });
  }, []);

  const handleSave = async (id: string) => {
    const newPrompt = edits[id];
    if (newPrompt === undefined) return;
    setSaving(id);
    const { error } = await supabase
      .from('template_prompts')
      .update({ prompt: newPrompt, updated_by: userId } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Prompt salvo!');
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, prompt: newPrompt } : p)));
      setEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    setSaving(null);
  };

  const handleSaveStyle = async (id: string) => {
    const newStyle = styleEdits[id];
    if (newStyle === undefined) return;
    setSaving(id + '-style');
    const { error } = await supabase
      .from('template_prompts')
      .update({ style_prompt: newStyle, updated_by: userId } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Prompt de estilo salvo!');
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, style_prompt: newStyle } : p)));
      setStyleEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    setSaving(null);
  };

  const handleImageUpload = async (id: string, file: File) => {
    setUploading(id);
    const ext = file.name.split('.').pop() || 'png';
    const path = `template-bases/${id}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('generated-creatives')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      toast.error('Erro ao fazer upload da imagem');
      setUploading(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('generated-creatives')
      .getPublicUrl(path);

    const { error: dbErr } = await supabase
      .from('template_prompts')
      .update({ base_image_url: publicUrl, updated_by: userId } as any)
      .eq('id', id);

    if (dbErr) {
      toast.error('Erro ao salvar URL da imagem');
    } else {
      toast.success('Imagem base salva!');
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, base_image_url: publicUrl } : p)));
    }
    setUploading(null);
  };

  const handleRemoveImage = async (id: string) => {
    setSaving(id);
    const { error } = await supabase
      .from('template_prompts')
      .update({ base_image_url: null, updated_by: userId } as any)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover imagem');
    } else {
      toast.success('Imagem removida');
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, base_image_url: null } : p)));
    }
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {prompts.map((p) => (
        <div key={p.id} className="space-y-3 p-4 rounded-lg border bg-card">
          <h3 className="text-sm font-semibold text-primary">{TEMPLATE_LABELS[p.id] || p.id}</h3>

          {/* Prompt de Composição */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prompt de Composição (layout/estrutura)</label>
            <Textarea
              value={edits[p.id] ?? p.prompt}
              onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className="bg-secondary min-h-[120px] text-sm font-mono"
            />
            {edits[p.id] !== undefined && edits[p.id] !== p.prompt && (
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={() => handleSave(p.id)} disabled={saving === p.id}>
                  {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Salvar Composição
                </Button>
              </div>
            )}
          </div>

          {/* Prompt de Estilo Visual */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prompt de Estilo Visual (estética)</label>
            <Textarea
              value={styleEdits[p.id] ?? p.style_prompt}
              onChange={(e) => setStyleEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className="bg-secondary min-h-[120px] text-sm font-mono"
            />
            {styleEdits[p.id] !== undefined && styleEdits[p.id] !== p.style_prompt && (
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={() => handleSaveStyle(p.id)} disabled={saving === p.id + '-style'}>
                  {saving === p.id + '-style' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Salvar Estilo Visual
                </Button>
              </div>
            )}
          </div>

          {/* Base Image */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Imagem base de referência</label>
            {p.base_image_url ? (
              <div className="flex items-start gap-3">
                <img
                  src={p.base_image_url}
                  alt="Imagem base"
                  className="w-32 h-32 object-cover rounded-lg border"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRefs.current[p.id]?.click()}
                    disabled={uploading === p.id}
                  >
                    {uploading === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                    Trocar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleRemoveImage(p.id)}
                    disabled={saving === p.id}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRefs.current[p.id]?.click()}
                disabled={uploading === p.id}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed bg-secondary/50 hover:bg-secondary transition-colors text-sm text-muted-foreground"
              >
                {uploading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Fazer upload de imagem base
              </button>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={(el) => { fileInputRefs.current[p.id] = el; }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(p.id, file);
                e.target.value = '';
              }}
            />
          </div>

        </div>
      ))}
    </div>
  );
}

// ─── Formats Tab ───

function FormatsTab() {
  const [formats, setFormats] = useState<{ id: string; label: string; active: boolean; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchFormats = async () => {
    const { data } = await supabase.from('creative_formats').select('*').order('sort_order');
    setFormats((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFormats(); }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    const maxOrder = formats.reduce((max, f) => Math.max(max, f.sort_order), 0);
    const { error } = await supabase.from('creative_formats').insert({ label: newLabel.trim(), sort_order: maxOrder + 1 } as any);
    if (error) toast.error(error.message?.includes('duplicate') ? 'Formato já existe' : 'Erro ao criar');
    else {
      toast.success('Formato criado!');
      setNewLabel('');
      fetchFormats();
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('creative_formats').update({ active: !active } as any).eq('id', id);
    fetchFormats();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este formato?')) return;
    await supabase.from('creative_formats').delete().eq('id', id);
    toast.success('Formato removido');
    fetchFormats();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Ex: 9:16"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="bg-secondary max-w-xs"
        />
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {formats.map((f) => (
          <div key={f.id} className={`flex items-center gap-4 p-4 rounded-lg border bg-card ${!f.active ? 'opacity-50' : ''}`}>
            <span className="font-medium flex-1">{f.label}</span>
            <Badge variant={f.active ? 'default' : 'secondary'} className="text-xs">
              {f.active ? 'Ativo' : 'Inativo'}
            </Badge>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => handleToggle(f.id, f.active)} title={f.active ? 'Desativar' : 'Ativar'}>
                {f.active ? <PowerOff className="h-4 w-4 text-orange-400" /> : <Power className="h-4 w-4 text-green-400" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id)} title="Remover">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
