
# Restaurar Acesso ao Dashboard (403 em profiles/user_roles)

## Diagnóstico confirmado

Os logs de rede mostram que, após o login, as chamadas para `profiles` e `user_roles` estão retornando **403** com a mensagem:

```
permission denied for function can_manage_users
```

Isso acontece porque, na última migração de segurança, o `EXECUTE` de várias funções `SECURITY DEFINER` foi revogado do papel `authenticated`. Só que algumas dessas funções (como `can_manage_users`, `can_manage_user_target`, `has_project_admin`, `has_any_admin_role`, `user_can_access_project`, `is_approved`, `has_role`, `has_permission`, `max_role_rank`, `has_project_access`) são chamadas **dentro das políticas RLS** de `profiles` e `user_roles`. Sem permissão de executá-las, o PostgREST bloqueia a leitura → o `AuthContext` não consegue carregar o profile → `AuthGuard` fica sem dados → tela em branco.

Funções `SECURITY DEFINER` chamadas em políticas RLS **precisam** de `EXECUTE` para o papel que dispara a policy (`authenticated`, e às vezes `anon`). Elas não expõem risco porque só retornam booleanos calculados internamente.

## Correção

Migração única que restaura `EXECUTE` para `authenticated` em todas as funções auxiliares usadas por RLS, mantendo revogado apenas o que for genuinamente sensível:

- `GRANT EXECUTE ... TO authenticated` em:
  - `public.has_role(uuid, app_role)`
  - `public.has_any_admin_role(uuid)`
  - `public.is_approved(uuid)`
  - `public.has_permission(uuid, text)`
  - `public.has_project_access(uuid)`
  - `public.has_project_admin(uuid)`
  - `public.can_manage_users(uuid)`
  - `public.can_manage_user_target(uuid, uuid)`
  - `public.can_assign_role(uuid, app_role)`
  - `public.max_role_rank(uuid)`
  - `public.user_can_access_project(uuid, uuid)`
- Manter `REVOKE ... FROM anon` (anônimos não precisam).

## Verificação

1. Recarregar a app logado → dashboard deve listar projetos.
2. Conferir na aba Network que `GET /rest/v1/profiles` e `GET /rest/v1/user_roles` retornam 200.
3. Abrir `/admin` como owner → deve carregar.

## Nota sobre o alerta do scanner

O aviso `SUPA_authenticated_security_definer_function_executable` vai voltar a aparecer nessas funções, mas nesse caso é **falso-positivo**: são helpers de RLS que precisam ser executáveis. Depois de aplicar, marco como `ignore` com essa justificativa no scanner.
