

# Usuários não confirmados no painel admin + reenvio de email

## Problema

Quando alguém se cadastra mas **não confirma o email**, o `data.user` retornado pelo `signUp` pode ser `null` ou o insert no `profiles` pode falhar silenciosamente. Resultado: o usuário existe no auth mas não aparece no painel administrativo (que lista apenas `profiles`).

## Solução

### 1. Garantir criação do perfil mesmo sem confirmação de email

**`src/pages/Auth.tsx`:**
- O `signUp` do Supabase retorna `data.user` mesmo quando email não está confirmado (com `identities` vazio). Verificar se o insert está funcionando corretamente.
- Adicionar tratamento para caso o insert falhe (ex: conflito), usando `.upsert()` ou ignorando erro de duplicata.

### 2. Mostrar status de confirmação de email no painel admin

**Nova edge function `supabase/functions/admin-list-users/index.ts`:**
- Usar `adminClient.auth.admin.listUsers()` para obter todos os usuários do auth
- Retornar `id`, `email`, `email_confirmed_at`, `created_at` para cada usuário
- Verificação de permissão: apenas owner/admin

**`src/pages/AdminUsers.tsx`:**
- Chamar a nova edge function para obter dados de confirmação de email
- Cruzar com os dados de `profiles` para mostrar:
  - Badge "Email não confirmado" (vermelho) para quem não confirmou
  - Badge "Aprovado" / "Pendente" como já existe
- Para usuários que existem no auth mas não no profiles, criar uma linha com status especial
- Mostrar mensagem orientando que o usuário precisa confirmar o email

### 3. Botão "Reenviar email de confirmação" no admin

**Nova edge function `supabase/functions/admin-resend-confirmation/index.ts`:**
- Receber `{ userId }` no body
- Verificar permissão admin/owner
- Usar `adminClient.auth.admin.generateLink({ type: 'signup', email })` para gerar novo link de confirmação
- Alternativamente, usar `adminClient.auth.resend({ type: 'signup', email })` com service role

**`src/pages/AdminUsers.tsx`:**
- Adicionar botão "Reenviar confirmação" (ícone Mail) visível apenas para usuários com email não confirmado
- Ao clicar, chamar a edge function e mostrar toast de sucesso

### 4. Mensagem na tela de login para verificar email

**`src/pages/Auth.tsx`:**
- Ao receber erro `email_not_confirmed` no login, mostrar mensagem clara: "Verifique seu email e clique no link de confirmação para ativar sua conta"
- Adicionar botão "Reenviar email de confirmação" que chama `supabase.auth.resend({ type: 'signup', email })`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/admin-list-users/index.ts` — listar usuários com status de confirmação |
| Criar | `supabase/functions/admin-resend-confirmation/index.ts` — reenviar email de confirmação |
| Editar | `src/pages/AdminUsers.tsx` — mostrar status de confirmação + botão reenviar |
| Editar | `src/pages/Auth.tsx` — mensagem e botão de reenvio no erro de email não confirmado |

