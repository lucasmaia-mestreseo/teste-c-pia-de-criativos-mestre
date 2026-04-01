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
  Save, Pencil, BarChart3, FileCode, FolderOpen, Users, Upload, ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ───

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  approved: boolean;
  role: AppRole | null;
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
}

interface PromptRow {
  id: string;
  prompt: string;
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
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                activeSection === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 max-w-4xl">
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
      <div className="flex gap-2">
        <Input placeholder="Nome do novo projeto" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} className="bg-secondary max-w-xs" />
        <Button onClick={handleCreate} disabled={creating}><Plus className="h-4 w-4 mr-1" /> Criar</Button>
      </div>

      <div className="space-y-2">
        {projects.map((p) => (
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
    await supabase.from('profiles').update({ approved }).eq('user_id', userId);
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

  const handleRemoveUser = async (userId: string) => {
    const target = users.find((u) => u.user_id === userId);
    if (target?.role === 'owner') { toast.error('Não é possível remover um owner'); return; }
    if (userId === currentUser?.id) { toast.error('Você não pode remover a si mesmo'); return; }
    if (!confirm('Tem certeza?')) return;
    await supabase.from('profiles').update({ approved: false }).eq('user_id', userId);
    await supabase.from('user_roles').delete().eq('user_id', userId);
    toast.success('Usuário desativado');
    fetchUsers();
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

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.user_id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.name}</p>
              <p className="text-sm text-muted-foreground truncate">{u.email}</p>
            </div>

            <Badge className={`${roleBadgeColor(u.role)} border text-xs`}>
              {ROLE_LABELS[u.role || ''] || 'Sem nível'}
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

              <Button size="icon" variant="ghost" onClick={() => openEdit(u)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>

              {u.role !== 'owner' && u.user_id !== currentUser?.id && (
                <Button size="icon" variant="ghost" onClick={() => handleRemoveUser(u.user_id)} title="Desativar">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
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
    </>
  );
}

// ─── Usage Tab ───

function UsageTab() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

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

    const { data: creatives } = await supabase
      .from('generated_creatives')
      .select('created_by, created_at')
      .gte('created_at', since.toISOString());

    const { data: profiles } = await supabase.from('profiles').select('user_id, name, email');

    const countMap = new Map<string, number>();
    (creatives || []).forEach((c: any) => {
      if (c.created_by) {
        countMap.set(c.created_by, (countMap.get(c.created_by) || 0) + 1);
      }
    });

    const profileMap = new Map<string, { name: string; email: string }>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, { name: p.name, email: p.email }));

    const rows: UsageRow[] = [];
    countMap.forEach((count, userId) => {
      const p = profileMap.get(userId);
      rows.push({ user_id: userId, name: p?.name || 'Desconhecido', email: p?.email || '', count });
    });
    rows.sort((a, b) => b.count - a.count);

    (profiles || []).forEach((p: any) => {
      if (!countMap.has(p.user_id)) {
        rows.push({ user_id: p.user_id, name: p.name, email: p.email, count: 0 });
      }
    });

    setUsage(rows);
    setLoading(false);
  };

  useEffect(() => { fetchUsage(); }, [period]);

  const periodLabel = { day: 'Hoje', week: 'Últimos 7 dias', month: 'Último mês' };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map((p) => (
          <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>
            {periodLabel[p]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {usage.map((u) => (
            <div key={u.user_id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{u.count}</span>
                <span className="text-xs text-muted-foreground">criativos</span>
              </div>
            </div>
          ))}
          {usage.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado para o período selecionado.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Prompts Tab ───

function PromptsTab({ userId }: { userId?: string }) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    supabase.from('template_prompts').select('id, prompt, base_image_url').then(({ data }) => {
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

          {/* Prompt */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prompt do modelo</label>
            <Textarea
              value={edits[p.id] ?? p.prompt}
              onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className="bg-secondary min-h-[120px] text-sm font-mono"
            />
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

          {/* Save prompt button */}
          {edits[p.id] !== undefined && edits[p.id] !== p.prompt && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleSave(p.id)} disabled={saving === p.id}>
                {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Salvar Prompt
              </Button>
            </div>
          )}
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
