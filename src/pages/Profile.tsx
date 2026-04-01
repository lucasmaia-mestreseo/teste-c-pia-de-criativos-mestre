import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast.error('Nome não pode estar vazio');
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('user_id', user!.id);
    if (error) {
      toast.error('Erro ao salvar nome');
    } else {
      toast.success('Nome atualizado!');
      await refreshProfile();
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message || 'Erro ao alterar senha');
    } else {
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-5 py-3 border-b bg-card">
        <Button size="icon" variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <User className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Meu Perfil</h1>
      </header>

      <div className="max-w-md mx-auto p-6 space-y-8">
        {/* Name */}
        <div className="space-y-3 p-4 rounded-lg border bg-card">
          <h2 className="text-sm font-semibold">Informações</h2>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveName} disabled={savingName || name === profile?.name}>
              {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-3 p-4 rounded-lg border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" /> Trocar Senha
          </h2>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-secondary"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-secondary"
              onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleChangePassword} disabled={savingPassword || !newPassword}>
              {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Alterar Senha
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
