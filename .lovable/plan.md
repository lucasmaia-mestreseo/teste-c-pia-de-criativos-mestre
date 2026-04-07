

# Sistema de Permissões no Painel Administrativo

## Resumo

Criar uma nova aba "Permissões" no admin onde o Owner/Admin pode configurar o que cada cargo (Owner, Admin, Gerente, Analista) pode fazer, e também controlar acesso por projeto por usuário.

## Arquitetura

### Tabela `role_permissions`
Armazena as permissões de cada cargo. Cada linha é um cargo + permissão + habilitado/desabilitado.

```sql
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE(role, permission)
);
```

### Tabela `user_project_access`
Controla quais projetos cada usuário pode acessar. Se não houver registros para um usuário, ele tem acesso a todos (comportamento atual).

```sql
CREATE TABLE public.user_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(user_id, project_id)
);
```

### Permissões disponíveis

| Permissão | Descrição |
|-----------|-----------|
| `create_project` | Criar novos projetos |
| `delete_project` | Excluir projetos |
| `edit_project` | Editar projetos existentes |
| `generate_creative` | Gerar criativos |
| `delete_creative` | Excluir criativos |
| `download_creative` | Fazer download de criativos |
| `manage_brand_kit` | Editar brand kit |
| `manage_swipe_files` | Gerenciar swipe files |
| `favorite_creative` | Favoritar criativos |

### Defaults iniciais (seed)

- **Owner**: tudo habilitado
- **Admin**: tudo habilitado
- **Gerente**: tudo exceto delete_project
- **Analista**: apenas generate, download, favorite

## UI — Nova aba "Permissões"

Adicionar à sidebar do admin uma aba **"Permissões"** (ícone de cadeado/shield). Visível apenas para Owner.

### Layout da aba

**Seção 1 — Permissões por Cargo**
Tabela/grid com:
- Linhas: cada permissão (com label legível em PT-BR)
- Colunas: Owner (sempre ativo, não editável), Admin, Gerente, Analista
- Cada célula: checkbox (toggle on/off)
- Botão "Salvar" ao final

**Seção 2 — Acesso por Projeto**
- Lista de usuários com dropdown de projetos acessíveis
- Checkbox para cada projeto
- Toggle "Acesso total" (sem restrição de projeto)
- Filtro de busca por usuário

## Hook `usePermissions`

Criar hook que:
1. Busca as permissões do cargo do usuário logado
2. Busca o acesso por projeto (se houver restrição)
3. Expõe `can(permission)` e `canAccessProject(projectId)`

Este hook será usado nos componentes existentes para habilitar/desabilitar botões e ações.

## Integração nos componentes

- **Botão criar projeto**: `can('create_project')`
- **Botão excluir projeto**: `can('delete_project')`
- **Botão gerar criativo**: `can('generate_creative')`
- **Botão download**: `can('download_creative')`
- **Botão excluir criativo**: `can('delete_creative')`
- **Brand kit edição**: `can('manage_brand_kit')`
- **Seletor de projeto**: filtrar por `canAccessProject()`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Criar tabelas `role_permissions` e `user_project_access` com RLS + seed de dados iniciais |
| Criar | `src/hooks/usePermissions.ts` — hook com `can()` e `canAccessProject()` |
| Editar | `src/pages/Admin.tsx` — adicionar aba "Permissões" com grid de checkboxes por cargo + acesso por projeto |
| Editar | `src/components/CreativesPanel.tsx` — usar `can()` nos botões de download/delete/favorite |
| Editar | `src/components/GeneratePanel.tsx` — condicionar geração com `can('generate_creative')` |
| Editar | `src/components/BrandKitPanel.tsx` — condicionar edição com `can('manage_brand_kit')` |
| Editar | `src/hooks/useProjects.ts` — filtrar projetos por `canAccessProject()` |

