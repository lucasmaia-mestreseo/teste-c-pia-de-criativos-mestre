import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Zap, Clock, LogOut } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function PendingApproval() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.approved) return <Navigate to="/" replace />;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm space-y-6 p-6 text-center">
        <Zap className="h-8 w-8 text-primary fill-primary mx-auto" />
        <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-semibold">Aguardando aprovação</h2>
        <p className="text-sm text-muted-foreground">
          Seu cadastro foi confirmado, mas um administrador precisa aprovar seu acesso ao sistema.
        </p>
        <p className="text-xs text-muted-foreground">
          Você receberá acesso assim que um owner ou administrador aprovar sua conta.
        </p>
        <Button variant="outline" onClick={signOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
