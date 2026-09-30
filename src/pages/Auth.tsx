import AuthShowcase from '@/components/AuthShowcase';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { allowedDomainsLabel, isAllowedEmail } from '@/lib/emailDomains';

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const validateDomain = (email: string) => {
    return isAllowedEmail(email);
  };

  const handleLogin = async () => {
    if (!validateDomain(loginEmail)) {
      toast.error(`Use seu e-mail da empresa (${allowedDomainsLabel})`);
      return;
    }
    setLoading(true);
    setEmailNotConfirmed(false);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed') || error.message?.toLowerCase().includes('email_not_confirmed')) {
          setEmailNotConfirmed(true);
          return;
        }
        throw error;
      }
      toast.success('Login realizado!');
      navigate('/');
    } catch (e: any) {
      toast.error(e.message || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: loginEmail,
      });
      if (error) throw error;
      toast.success('Email de confirmação reenviado! Verifique sua caixa de entrada.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reenviar email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSignup = async () => {
    if (!validateDomain(signupEmail)) {
      toast.error(`Use seu e-mail da empresa (${allowedDomainsLabel})`);
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
        // Use upsert to handle duplicate profiles gracefully
        await supabase.from('profiles').upsert(
          {
            user_id: data.user.id,
            name: signupName.trim(),
            email: signupEmail.toLowerCase(),
          },
          { onConflict: 'user_id' }
        );
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
            Verifique seu email e clique no link de confirmação para ativar sua conta. Após a confirmação, um administrador precisará aprovar seu acesso.
          </p>
          <Button variant="outline" onClick={() => { setSignupDone(false); setTab('login'); }} className="w-full">
            Ir para login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[minmax(420px,1fr)_1.15fr]">
      <div className="relative flex items-center justify-center p-6">
      <div aria-hidden className="lg:hidden absolute -top-32 left-1/2 -translate-x-1/2 h-[300px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
      <div className="relative w-full max-w-sm space-y-6 p-6 rounded-2xl lg:border-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-6 w-6 text-primary fill-primary" />
            <h1 className="text-xl font-bold">Criativos Mestre</h1>
          </div>
          <p className="text-sm text-muted-foreground">Acesso restrito a {allowedDomainsLabel}</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'signup'); setEmailNotConfirmed(false); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Cadastro</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 mt-4">
            {emailNotConfirmed && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Mail className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-300">Email não confirmado</p>
                    <p className="text-xs text-yellow-300/80">
                      Verifique sua caixa de entrada e clique no link de confirmação para ativar sua conta.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                >
                  {resendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Reenviar email de confirmação
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="seu@mestreseo.com.br"
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
                placeholder="seu@mestreseo.com.br"
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
      <AuthShowcase />
    </div>
  );
}
