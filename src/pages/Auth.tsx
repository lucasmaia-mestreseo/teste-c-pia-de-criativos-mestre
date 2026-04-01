import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_DOMAIN = 'agenciamestre.com';

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const validateDomain = (email: string) => {
    return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
  };

  const handleLogin = async () => {
    if (!validateDomain(loginEmail)) {
      toast.error(`Apenas emails @${ALLOWED_DOMAIN} são permitidos`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      toast.success('Login realizado!');
      navigate('/');
    } catch (e: any) {
      toast.error(e.message || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!validateDomain(signupEmail)) {
      toast.error(`Apenas emails @${ALLOWED_DOMAIN} são permitidos`);
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (!signupName.trim()) {
      toast.error('Preencha seu nome');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name: signupName.trim() },
        },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').insert({
          user_id: data.user.id,
          name: signupName.trim(),
          email: signupEmail.toLowerCase(),
        });
      }

      setSignupDone(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  if (signupDone) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm space-y-4 p-6 text-center">
          <Zap className="h-8 w-8 text-primary fill-primary mx-auto" />
          <h2 className="text-lg font-semibold">Cadastro realizado!</h2>
          <p className="text-sm text-muted-foreground">
            Verifique seu email para confirmar sua conta. Após a confirmação, um administrador precisará aprovar seu acesso.
          </p>
          <Button variant="outline" onClick={() => { setSignupDone(false); setTab('login'); }} className="w-full">
            Ir para login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-6 w-6 text-primary fill-primary" />
            <h1 className="text-xl font-bold">Clonador Mestre</h1>
          </div>
          <p className="text-sm text-muted-foreground">Acesso restrito a @{ALLOWED_DOMAIN}</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Cadastro</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder={`seu@${ALLOWED_DOMAIN}`}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                placeholder="Sua senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="bg-secondary"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Seu nome completo"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                className="bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder={`seu@${ALLOWED_DOMAIN}`}
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="bg-secondary"
                onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
              />
            </div>
            <Button onClick={handleSignup} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cadastrar
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
