import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Shield, User, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/** Avatar + dropdown (Ferramentas / Perfil / Administração / Sair), shared by every header. */
export default function UserMenu() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const canAdmin = role === 'owner' || role === 'admin' || role === 'manager';

  const userInitials = profile?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1 rounded-md hover:bg-secondary transition-colors flex-shrink-0">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px] font-semibold bg-primary text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium truncate max-w-[100px] hidden lg:block">{profile?.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => navigate('/')}>
          <LayoutGrid className="h-3.5 w-3.5 mr-2" /> Ferramentas
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => navigate('/profile')}>
          <User className="h-3.5 w-3.5 mr-2" /> Perfil
        </DropdownMenuItem>
        {canAdmin && (
          <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => navigate('/admin')}>
            <Shield className="h-3.5 w-3.5 mr-2" /> Administração
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-xs" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
