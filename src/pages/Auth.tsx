import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_DOMAIN = 'agenciamestre.com';

type AuthStep = 'form' | 'otp' | 'signup-done';

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<AuthStep>('form');
  const [loading, setLoading] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

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

      // Sign out the password session, then send OTP
      await supabase.auth.signOut();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: loginEmail,
      });
      if (otpError) throw otpError;

      setStep('otp');
      toast.success('Código enviado para seu email!');
    } catch (e: any) {
      toast.error(e.message || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: loginEmail,
        token: otpCode,
        type: 'email',
      });
      if (error) throw error;
      toast.success('Login realizado!');
      navigate('/');
    } catch (e: any) {
      toast.error(e.message || 'Código inválido');
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

      // Create profile
      if (data.user) {
        await supabase.from('profiles').insert({
          user_id: data.user.id,
          name: signupName.trim(),
          email: signupEmail.toLowerCase(),
        });
      }

      setStep('signup-done');
    } catch (e: any) {
      toast.error(e.message || 'Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm space-y-6 p-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="h-6 w-6 text-primary fill-primary" />
              <h1 className="text-xl font-bold">Clonador Mestre</h1>
            </div>
            <Mail className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-lg font-semibold">Verifique seu email</h2>
            <p className="text-sm text-muted-foreground">
              Enviamos um código de 6 dígitos para <strong>{loginEmail}</strong>
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button onClick={handleVerifyOtp} disabled={loading || otpCode.length !== 6} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verificar
          </Button>

          <button
            onClick={() => { setStep('form'); setOtpCode(''); }}
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'signup-done') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm space-y-4 p-6 text-center">
          <Zap className="h-8 w-8 text-primary fill-primary mx-auto" />
          <h2 className="text-lg font-semibold">Cadastro realizado!</h2>
          <p className="text-sm text-muted-foreground">
            Verifique seu email para confirmar sua conta. Após a confirmação, um administrador precisará aprovar seu acesso.
          </p>
          <Button variant="outline" onClick={() => { setStep('form'); setTab('login'); }} className="w-full">
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
