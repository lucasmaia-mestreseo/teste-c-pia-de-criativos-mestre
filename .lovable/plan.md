

# Sistema de Autenticação e Permissões por Nível

## Visão Geral

Implementar autenticação com restrição de domínio (`@agenciamestre.com`), 4 níveis de usuário com permissões granulares, fluxo de aprovação por admin/owner, e login com código OTP por email.

## Banco de Dados

### Migration 1: Tabelas e funções

1. **Enum `app_role`**: `owner`, `admin`, `manager`, `analyst`

2. **Tabela `profiles`**:
   - `id` (uuid, FK → auth.users)
   - `name` (text, NOT NULL)
   - `email` (text, NOT NULL)
   - `approved` (boolean, default false)
   - `created_at`, `updated_at`

3. **Tabela `user_roles`**:
   - `id` (uuid)
   - `user_id` (uuid, FK → auth.users, ON DELETE CASCADE)
   - `role` (app_role, NOT NULL)
   - UNIQUE(user_id, role)

4. **Tabela `template_prompts`** (para owner editar prompts dos modelos):
   - `id` (text, PK) — ex: `hero`, `problem-solution`
   - `prompt` (text, NOT NULL)
   - `updated_at`, `updated_by` (uuid)

5. **Função `has_role(uuid, app_role)`** — SECURITY DEFINER para verificar roles sem recursão RLS

6. **Trigger** em `profiles` para criar perfil automaticamente no signup (via trigger on `auth.users` insert — NÃO, isso é schema reservado). Em vez disso, o perfil será criado no frontend após signup.

7. **RLS policies**:
   - `profiles`: usuários autenticados podem ler todos; update apenas do próprio
   - `user_roles`: somente owner/admin podem inserir/deletar; todos autenticados podem ler
   - `projects`: owner/admin/manager podem criar/deletar; analyst pode ler
   - `swipe_files`, `brand_kits`, `generated_creatives`: owner/admin/manager full; analyst pode ler e inserir criativos
   - `template_prompts`: owner pode update; todos autenticados podem ler

### Migration 2: Seed dos prompts padrão
Inserir os 7 template prompts atuais (hero, problem-solution, etc.) como dados iniciais na tabela `template_prompts`.

## Auth Config
- Habilitar confirmação de email (NÃO auto-confirm)
- Login via OTP email (magic link com código de 6 dígitos)

## Frontend

### Novas páginas/componentes

1. **`/auth`** — Página de login/cadastro:
   - Tab "Cadastro": Nome, Email, Senha. Valida domínio `@agenciamestre.com` no frontend. Ao submeter, `supabase.auth.signUp()` com `emailRedirectTo`. Cria `profile` após signup. Mostra mensagem "Verifique seu email e aguarde aprovação de um administrador."
   - Tab "Login": Email + Senha → `supabase.auth.signInWithPassword()`. Após sucesso, envia OTP via `supabase.auth.signInWithOtp({ email })`. Redireciona para tela de código.
   - **Tela de OTP**: Input de 6 dígitos. Verifica com `supabase.auth.verifyOtp({ email, token, type: 'email' })`.

2. **`/pending-approval`** — Tela para usuários não aprovados: "Seu cadastro está aguardando aprovação."

3. **`/admin/users`** — Painel de gestão de usuários (owner/admin):
   - Lista todos os profiles com status de aprovação e role
   - Botão aprovar/reprovar
   - Dropdown para alterar role (owner só pode ser alterado por outro owner)
   - Owner não pode ser removido por admin

4. **`/admin/prompts`** — Painel de edição de prompts (somente owner):
   - Lista os 7 templates com seus prompts editáveis
   - Salva na tabela `template_prompts`

5. **Componente `AuthGuard`** — wrapper que:
   - Verifica se usuário está logado (senão redireciona para `/auth`)
   - Verifica se está aprovado (senão redireciona para `/pending-approval`)
   - Passa `userRole` via context para controlar UI

6. **`useAuth` hook** — gerencia sessão, perfil, role, e status de aprovação

### Modificações em componentes existentes

- **`TopBar`**: Adicionar menu de usuário (avatar, nome, logout). Mostrar botões Admin/Prompts conforme role.
- **`Index`**: Envolver com `AuthGuard`. Esconder botões de criar projeto para analyst.
- **`GeneratePanel`**: Carregar prompts de template da tabela `template_prompts` em vez do hardcoded.
- **Edge function `generate-creative`**: Buscar prompts da tabela `template_prompts` em vez de usar constantes hardcoded.

### Permissões na UI

| Ação | Owner | Admin | Manager | Analyst |
|------|-------|-------|---------|---------|
| Criar projeto | ✅ | ✅ | ✅ | ❌ |
| Editar projeto | ✅ | ✅ | ✅ | ❌ |
| Deletar projeto | ✅ | ✅ | ❌ | ❌ |
| Criar criativos | ✅ | ✅ | ✅ | ✅ |
| Gerenciar usuários | ✅ | ✅* | ❌ | ❌ |
| Editar prompts | ✅ | ❌ | ❌ | ❌ |

*Admin não pode remover owner

## Fluxo de Login (2 etapas)

```text
1. Usuário digita email + senha
2. signInWithPassword() → valida credenciais
3. Se válido, chama signInWithOtp({ email }) → envia código 6 dígitos
4. Usuário digita código na tela de OTP
5. verifyOtp() → sessão ativa
6. AuthGuard verifica approved=true → libera acesso
```

## Arquivos a criar/modificar

**Criar:**
- `src/pages/Auth.tsx`
- `src/pages/PendingApproval.tsx`
- `src/pages/AdminUsers.tsx`
- `src/pages/AdminPrompts.tsx`
- `src/components/AuthGuard.tsx`
- `src/hooks/useAuth.ts`
- `src/contexts/AuthContext.tsx`

**Modificar:**
- `src/App.tsx` — adicionar rotas
- `src/pages/Index.tsx` — envolver com AuthGuard, aplicar permissões
- `src/components/TopBar.tsx` — menu de usuário, links admin
- `supabase/functions/generate-creative/index.ts` — buscar prompts do banco

