## O que será feito

### 1. Impedir projetos com nome duplicado
- Migração no banco: adicionar índice único case-insensitive em `projects.name` (`CREATE UNIQUE INDEX projects_name_unique_ci ON public.projects (lower(name));`).
- Antes de aplicar, será necessário tratar o duplicado atual "Agência Mestre" (já identificado anteriormente). Sugestão: renomear o mais novo (28/05, 5 criativos) para "Agência Mestre 2" automaticamente na mesma migração — assim a unique index passa. Você pode renomear depois pela tela.
- Frontend (`src/pages/Admin.tsx` ProjectsTab e `src/components/TopBar.tsx` handleCreate / handleRename): detectar erro de duplicidade do Postgres (código `23505`) e mostrar toast amigável: "Já existe um projeto com esse nome".
- Também fazer checagem cliente antes do insert (comparar case-insensitive contra a lista carregada) para feedback imediato.

### 2. Ordem alfabética na lista de admin
- Em `ProjectsTab.fetchProjects` (`src/pages/Admin.tsx` linha 185): trocar `.order('created_at', { ascending: false })` por `.order('name', { ascending: true })`.
- A ordenação cliente continua respeitando filtros/busca.

### 3. Editar nome do projeto na administração
- Adicionar botão de lápis (ícone `Pencil`) na linha do projeto, ao lado do toggle ativar/desativar e do remover.
- Ao clicar, abrir um `Dialog` com `Input` pré-preenchido com o nome atual e botão "Salvar".
- Ao salvar: `supabase.from('projects').update({ name: novoNome.trim() }).eq('id', id)`, tratando erro `23505` (duplicado) com o mesmo toast.
- Recarregar a lista (`fetchProjects`) após sucesso.

### Detalhes técnicos
- A unique index em `lower(name)` cobre variações de caixa ("agência mestre" vs "Agência Mestre").
- Não há FK em `projects.id`, então renomear é seguro.
- Sem mudança em RLS: política existente `Users with edit_project permission can update projects` já permite o rename para admins (que têm `edit_project`).

## Arquivos
- Migração nova (renomear duplicado + criar unique index)
- `src/pages/Admin.tsx` (ordem alfabética, botão editar + dialog, tratamento de erro 23505)
- `src/components/TopBar.tsx` (tratamento de erro 23505 em criar/renomear)