

# Corrigir Permissões: Respeitar Configurações do Painel Admin

## Problema
As permissões configuradas no painel administrativo (tabela `role_permissions`) estão sendo ignoradas em vários lugares. O código usa verificações hardcoded por nome de cargo ao invés de consultar a tabela de permissões.

### Exemplo concreto
No `TopBar.tsx`, linha 37:
```typescript
const canCreateProject = role === 'owner' || role === 'admin' || role === 'manager';
```
Isso ignora completamente o que está configurado na aba "Permissões" do admin. Mesmo que o admin marque `create_project` como habilitado para analistas, eles não conseguem criar projetos.

### Dois níveis do problema
1. **Interface (UI)**: Verificações hardcoded por cargo ao invés de usar `can('create_project')`
2. **Banco de dados (RLS)**: A função `has_project_access()` só permite owner/admin/manager, bloqueando analistas no nível do banco mesmo que a UI permita

## Solução

### Camada UI
Substituir verificações hardcoded por `can()` do hook `usePermissions`:

- **TopBar.tsx**: Trocar `role === 'owner' || ...` por `can('create_project')`
- **DashboardPanel.tsx**: Adicionar `usePermissions` para controlar botões de download/delete/favoritar
- **GeneratePanel.tsx**: Usar `can('generate_creative')` para controlar acesso à geração
- **HistoryPanel.tsx**: Usar `can()` para controlar ações no modal

### Camada RLS (banco de dados)
Criar uma nova função `has_permission()` que consulta a tabela `role_permissions`:

```sql
CREATE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.permission = _permission
      AND rp.enabled = true
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;
```

Atualizar as policies de INSERT em `projects` para usar `has_permission(auth.uid(), 'create_project')` ao invés de `has_project_access()`.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Nova função `has_permission` + atualizar policy de INSERT em `projects` |
| Editar | `src/components/TopBar.tsx` — usar `can('create_project')` |
| Editar | `src/components/DashboardPanel.tsx` — usar `can()` para ações |
| Editar | `src/components/GeneratePanel.tsx` — usar `can('generate_creative')` |
| Editar | `src/components/DynamicGeneratePanel.tsx` — usar `can('generate_creative')` |
| Editar | `src/components/HistoryPanel.tsx` — usar `can()` para ações no modal |

