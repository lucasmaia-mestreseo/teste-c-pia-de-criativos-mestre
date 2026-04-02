

# Exclusão de usuário com confirmação por nome

## Problema atual

O botão de remover usuário apenas desativa (revoga aprovação e remove roles), usa um simples `confirm()` do browser, e não exclui o usuário de verdade.

## Solução

### 1. Dialog de confirmação com digitação do nome — `src/pages/Admin.tsx`

- Substituir o `confirm()` por um `Dialog` customizado
- Mostrar mensagem: "Esta ação é irreversível. Para confirmar, digite o nome do usuário: **{nome}**"
- Input para digitar o nome; botão "Excluir" só habilitado quando o texto digitado coincidir exatamente com o nome
- Ao confirmar, chamar edge function para deletar o usuário do auth (e consequentemente do profiles/roles)

### 2. Nova edge function `supabase/functions/admin-delete-user/index.ts`

- Receber `{ userId }` no body
- Validar que o caller é owner/admin (via JWT + query em user_roles)
- Impedir exclusão de owners
- Usar `adminClient.auth.admin.deleteUser(userId)` para remover do auth
- Deletar registros de `profiles` e `user_roles` para esse user_id
- Retornar sucesso

### 3. Ajuste no `handleRemoveUser`

- Em vez de desativar, abrir o dialog de confirmação
- Ao confirmar (nome correto), chamar `supabase.functions.invoke('admin-delete-user', { body: { userId } })`
- Toast de sucesso e refresh da lista

## Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/admin-delete-user/index.ts` |
| Editar | `src/pages/Admin.tsx` — dialog de confirmação + handler de exclusão real |

