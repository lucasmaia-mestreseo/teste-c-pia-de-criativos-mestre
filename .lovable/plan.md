

# Renomear Projeto: Nova Funcionalidade

## Resumo
Adicionar a possibilidade de renomear um projeto após criado, controlado pela permissão `edit_project` (que já existe na tabela de permissões). Também adicionar uma nova permissão `rename_project` ao sistema para controle granular no admin.

## Decisão de Design
A permissão `edit_project` já existe e cobre edição de projetos. Vou **reutilizá-la** para controlar o rename, sem criar uma permissão nova — mantendo simplicidade. O RLS de UPDATE em `projects` já usa `has_permission('edit_project')`, então o banco já está pronto.

## Implementação

### 1. UI — Botão de renomear no seletor de projetos (TopBar)
- Adicionar um ícone de edição (Pencil) ao lado do nome do projeto selecionado no Popover
- Ao clicar, abrir um pequeno Dialog com input para o novo nome
- Só exibir o botão se `can('edit_project')` retornar true
- Após salvar, invalidar queries de projetos

### 2. Hook — Mutation para renomear
- Adicionar `useRenameProject()` em `src/hooks/useProject.ts`
- Faz `supabase.from('projects').update({ name }).eq('id', projectId)`
- Invalida `['projects']` e `['project', projectId]`

### 3. Nenhuma migração necessária
- A permissão `edit_project` já existe na tabela `role_permissions`
- O RLS de UPDATE em `projects` já usa `has_permission(auth.uid(), 'edit_project')`
- Basta garantir que `edit_project` esteja habilitado para todos os cargos (via insert tool)

### 4. Dados — Habilitar para todos os cargos
- Inserir/atualizar `role_permissions` para garantir que `edit_project` está `enabled = true` para admin, manager e analyst

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/hooks/useProject.ts` — adicionar `useRenameProject` |
| Editar | `src/components/TopBar.tsx` — adicionar botão de edição e Dialog de rename |
| Dados | Garantir `edit_project` habilitado para todos os cargos via insert |

