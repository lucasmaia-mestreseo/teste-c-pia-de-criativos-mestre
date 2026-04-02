

# Mostrar usuários não confirmados no painel admin

## Problema

O `UsersTab` em `Admin.tsx` (linha 258) busca apenas da tabela `profiles`. Usuários que se cadastraram mas não confirmaram o email (samara, matheus) não têm perfil criado, então não aparecem. A edge function `admin-list-users` já existe e retorna todos os usuários do auth, mas não está sendo usada neste componente.

## Solução

Aplicar no `UsersTab` do `Admin.tsx` a mesma lógica que já existe no `AdminUsers.tsx` — cruzar dados do auth com profiles.

### Alterações em `src/pages/Admin.tsx` — `UsersTab`

**Interface `UserRow` (linha 23):** Adicionar campos `email_confirmed` e `has_profile`.

**`fetchUsers` (linha 258):**
1. Chamar `supabase.functions.invoke('admin-list-users')` para obter todos os usuários do auth
2. Cruzar com profiles e roles (como já faz)
3. Incluir usuários que existem no auth mas não no profiles, com `email_confirmed: false` e `has_profile: false`

**Tabela (linha 424):**
- Adicionar badge "Email não confirmado" (vermelho) na coluna Status para quem não confirmou
- Adicionar botão de reenviar email de confirmação (ícone Mail) nas ações, visível para quem não confirmou
- Ajustar botão de aprovar: só mostrar se `email_confirmed && has_profile`

**Imports:** Adicionar `Mail, AlertCircle, Loader2` (Mail e AlertCircle já podem estar importados, verificar).

**Estado:** Adicionar `resending` (string | null) para controlar loading do reenvio.

**Handler `handleResendConfirmation`:** Chamar `supabase.functions.invoke('admin-resend-confirmation', { body: { email } })`.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Admin.tsx` — UsersTab: buscar auth users, mostrar não confirmados, botão reenviar |

