

# Simplificar Login + Área Administrativa Completa

## 1. Remover OTP do login
**`src/pages/Auth.tsx`**: Simplificar `handleLogin` para usar apenas `signInWithPassword` e navegar direto para `/`. Remover todo o estado e UI de OTP (step `otp`, `otpCode`, `handleVerifyOtp`, tela de código de 6 dígitos). Remover import do `InputOTP`.

## 2. Tornar fabioricotta@agenciamestre.com owner
Após o primeiro login/cadastro deste email, inserir automaticamente o role `owner` via uma migration que cria um trigger ou, mais simples, via uma edge function de bootstrap. **Abordagem escolhida**: criar um database trigger na tabela `profiles` que, ao inserir um perfil com email `fabioricotta@agenciamestre.com`, automaticamente insere o role `owner` em `user_roles` e marca `approved = true`. Isso é feito via migration SQL.

## 3. Menu do usuário com iniciais (TopBar)
**`src/components/TopBar.tsx`**: Substituir o dropdown atual do usuário por um avatar circular com as iniciais do nome. Ao clicar, abrir dropdown com duas opções:
- **Perfil** → navega para `/profile`
- **Administração** → navega para `/admin` (visível apenas para owner/admin)
- **Sair** → signOut

Remover os botões "Gerenciar Usuários" e "Editar Prompts" do dropdown atual (serão movidos para dentro da página de Administração).

## 4. Nova página: Perfil (`/profile`)
**`src/pages/Profile.tsx`** (novo):
- Campo Nome: editável, com botão salvar (update na tabela `profiles`)
- Campo Email: exibido como read-only
- Seção Trocar Senha: campos "Nova senha" e "Confirmar senha", usando `supabase.auth.updateUser({ password })`

## 5. Nova página: Administração (`/admin`)
**`src/pages/Admin.tsx`** (novo) — página com abas/tabs:

### Aba "Projetos"
- Lista todos os projetos com nome, data de criação
- Para cada projeto: contagem de criativos (`generated_creatives`) e arquivos no swipe file (`swipe_files`) — obtidos via queries com `count`
- Botões: Adicionar projeto, Desativar (campo `active` — requer nova coluna), Remover (delete)
- **Migration**: adicionar coluna `active` (boolean, default true) na tabela `projects`

### Aba "Usuários"
- Lista todos os profiles com nome, email, role, status de aprovação
- Botão aprovar/reprovar pendentes
- Dropdown para alterar role
- Botão editar: abre modal para trocar nome (update `profiles`) ou resetar senha (via `supabase.auth.admin.updateUserById` — precisa de edge function pois é operação admin)
- Botão remover usuário
- Reutiliza lógica do `AdminUsers.tsx` atual

### Aba "Uso do Sistema"
- Tabela com uso por usuário: nome, total de criativos criados
- Filtro por período: dia, semana, mês
- **Requer**: adicionar coluna `created_by` (uuid) na tabela `generated_creatives` para rastrear quem criou cada criativo
- **Migration**: `ALTER TABLE generated_creatives ADD COLUMN created_by uuid REFERENCES auth.users(id)`
- Query: `SELECT created_by, count(*) FROM generated_creatives WHERE created_at >= [período] GROUP BY created_by`

### Aba "Prompts" (somente owner)
- Move o conteúdo atual de `AdminPrompts.tsx` para dentro desta aba

## 6. Edge function para admin resetar senha de usuário
**`supabase/functions/admin-reset-password/index.ts`** (novo):
- Recebe `{ userId, newPassword }`
- Valida que o caller tem role owner/admin
- Usa `supabase.auth.admin.updateUserById(userId, { password })` com service_role key
- Retorna sucesso/erro

## 7. Rotas
**`src/App.tsx`**: Adicionar rotas `/profile` e `/admin` (ambas dentro de AuthGuard).

## Migrations necessárias
1. Coluna `active` em `projects` (boolean, default true)
2. Coluna `created_by` em `generated_creatives` (uuid, nullable para dados existentes)
3. Trigger para auto-owner do email `fabioricotta@agenciamestre.com`
4. RLS update para `profiles` permitir owner/admin atualizar qualquer perfil (para editar nomes de outros usuários)

## Arquivos a criar/modificar
- **Criar**: `src/pages/Profile.tsx`, `src/pages/Admin.tsx`, `supabase/functions/admin-reset-password/index.ts`
- **Modificar**: `src/pages/Auth.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`
- **Possivelmente remover/deprecar**: `src/pages/AdminUsers.tsx`, `src/pages/AdminPrompts.tsx` (conteúdo movido para `Admin.tsx`)

