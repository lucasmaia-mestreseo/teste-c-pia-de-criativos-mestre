# Acesso do cargo "Gerente" ao painel administrativo

## Objetivo
Permitir que usuários com cargo `manager` acessem, no `/admin`:
- **Análises** — todas as consultas (Time e Clientes)
- **Projetos** — criar, editar, ativar/desativar, remover
- **Usuários** — convidar, aprovar/revogar aprovação, remover **apenas analistas** e alterar cargo **apenas dentro de `analyst`**

Owner e admin mantêm poderes atuais. Toda validação precisa existir tanto no cliente quanto no backend (RLS + edge functions) — o cliente é só UX; a segurança fica no banco.

## Regras de negócio (matriz)

| Ação                                        | owner | admin | manager | analyst |
|--                                           |--     |--     |--       |--       |
| Ver /admin                                  | ✅    | ✅    | ✅ (novo) | ❌     |
| Ver Análises / Uso do Sistema               | ✅    | ✅    | ✅ (novo) | ❌     |
| Projetos: criar/editar/ativar/remover       | ✅    | ✅    | ✅ (novo) | ❌     |
| Usuários: convidar                          | ✅    | ✅    | ✅ (novo) | ❌     |
| Usuários: aprovar/revogar                   | ✅    | ✅    | somente `analyst` ou sem cargo | ❌ |
| Usuários: remover                           | ✅    | ✅ (não owner) | somente `analyst` | ❌ |
| Alterar cargo                               | qualquer | qualquer exceto owner | apenas para/de `analyst` | ❌ |
| Prompts, Modelos de IA, Permissões          | ✅    | ❌    | ❌      | ❌      |
| Formatos, Logs de Erros                     | ✅    | ✅    | ❌ (mantido restrito a admin+) | ❌ |

Justificativa: gerente não pode escalar privilégios (nunca criar admin/manager/owner) nem mexer em quem já tem privilégio.

## Mudanças no banco (migração)

1. Nova função `public.can_manage_users(_actor uuid)` → `owner|admin|manager`.
2. Nova função `public.can_manage_user_target(_actor uuid, _target uuid)` — booleana:
   - `owner` sempre pode
   - `admin` pode qualquer alvo que não seja `owner`
   - `manager` só pode alvos cujo maior cargo seja `analyst` **ou** que ainda não tenham cargo
3. Nova função `public.can_assign_role(_actor uuid, _role app_role)`:
   - `owner`: qualquer
   - `admin`: `admin|manager|analyst`
   - `manager`: apenas `analyst`
4. Recriar policies para incluir `manager` sem afrouxar:
   - `projects`: já usa `has_permission(edit_project/create_project)` + `delete` restrito a `has_any_admin_role`. Trocar delete/insert/update para permitir também `manager` via nova função `has_project_admin(uuid)` que devolve true para owner/admin/manager. Isso substitui a dependência de flags de permissões (que hoje o gerente pode não ter).
   - `profiles UPDATE/DELETE`: passar de `has_any_admin_role` para `can_manage_user_target(auth.uid(), user_id)`.
   - `user_roles INSERT/UPDATE/DELETE`: passar para `can_manage_user_target(auth.uid(), user_id) AND can_assign_role(auth.uid(), role)` (o `WITH CHECK` no INSERT/UPDATE bloqueia gerente tentando gravar cargo ≠ analyst).
   - `user_invitations INSERT/SELECT/DELETE`: passar para `can_manage_users(auth.uid())`.
   - `error_logs SELECT`: manter só admin/owner (não pedido).
   - `app_settings`, `role_permissions`, `template_prompts`: sem mudança (owner-only mantido).
5. `is_approved` continua sendo o gate para leituras gerais — gerente já é aprovado.

## Mudanças nas edge functions

Cada função que hoje chama `has_any_admin_role` precisa aceitar `manager` quando a ação é permitida a gerente, e bloquear quando não é:

- `invite-user` → trocar guard para `can_manage_users(caller)` (aceita manager). Continua forçando `@agenciamestre.com` e cargo inicial `analyst`.
- `admin-list-users` → `can_manage_users(caller)`.
- `admin-resend-confirmation` → `can_manage_users(caller)` (usada em fluxo de convite/aprovação).
- `admin-delete-user` → validar `can_manage_user_target(caller, targetUserId)`; retornar 403 se gerente tentar apagar admin/owner/manager.
- `admin-reset-password` → manter restrito a admin/owner (não pedido a gerente).

Todos continuam derivando o `caller.id` do JWT (nunca do body) e usando o service role só depois da checagem.

## Mudanças no frontend

`src/pages/Admin.tsx`:
- `canManageUsers = role === 'owner' || role === 'admin' || role === 'manager'`.
- `SIDEBAR_ITEMS`: adicionar flag `adminOnly` para `formats`, `error-logs`; `analytics`, `projects`, `users`, `usage` ficam visíveis para gerente. `prompts`, `ai-models`, `permissions` seguem `ownerOnly`.
- Sidebar filtra por role.
- `handleRoleChange`: se `currentRole === 'manager'`, só permitir alvo com cargo atual `analyst`/sem cargo **e** novo cargo `analyst`. Toast de erro caso contrário.
- `availableRoles`: para gerente, `['analyst']`.
- `handleRemoveUser` / `handleApprove`: bloquear se alvo tem cargo ≠ analyst e ator é gerente.
- Botão "Acesso Total"/restrito por projeto continua desabilitado para gerente quando alvo é admin/owner.

`src/hooks/usePermissions.ts`: expor helper `isPrivileged` (owner/admin/manager) para futuras conferências, opcional.

## Blindagem / validação de segurança

- Revisar cada política reescrita rodando `supabase--linter` após a migração.
- Testes manuais que devem passar:
  1. Gerente logado abre `/admin` → vê apenas Projetos, Usuários, Uso do Sistema, Análises.
  2. Gerente tenta `supabase.from('user_roles').insert({ role: 'admin' })` direto pelo client → RLS `WITH CHECK` recusa.
  3. Gerente tenta alterar cargo de um admin via dropdown → bloqueado no cliente e, se forçado via SQL, `can_manage_user_target` recusa.
  4. Gerente chama `admin-delete-user` com id de um admin → 403.
  5. Analista tenta abrir `/admin` → redireciona para `/`.
- Confirmação com dupla-checagem cliente+servidor: cliente esconde, servidor recusa. Nenhuma decisão de segurança sai do cliente.

## Arquivos afetados

| Ação      | Arquivo |
|--         |--       |
| Migração  | Novas funções + recriação das policies de `projects`, `profiles`, `user_roles`, `user_invitations` |
| Editar    | `supabase/functions/invite-user/index.ts` |
| Editar    | `supabase/functions/admin-list-users/index.ts` |
| Editar    | `supabase/functions/admin-resend-confirmation/index.ts` |
| Editar    | `supabase/functions/admin-delete-user/index.ts` |
| Editar    | `src/pages/Admin.tsx` (guard, sidebar, handleRoleChange, availableRoles, botões condicionais) |
