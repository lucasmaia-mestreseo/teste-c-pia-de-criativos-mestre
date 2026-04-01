

# Reestruturar Layout: Sidebar Direita + Dashboard Inicial

## Visao Geral

Mover a navegacao (projetos, botoes de painel, avatar) do TopBar horizontal para uma sidebar na direita. Quando nenhum projeto esta selecionado, exibir um dashboard com estatisticas do usuario. A sidebar tem botao de collapse.

## 1. Remover TopBar, criar RightSidebar

**Novo arquivo: `src/components/RightSidebar.tsx`**

Sidebar fixa na direita (~280px) contendo:
- Logo "Criativos Mestre" no topo
- Select de projeto + botao criar projeto
- Separador
- Botoes de navegacao (Gerar, Brand Kit, Contexto, Historico) — **so aparecem quando um projeto esta selecionado**
- Separador
- Avatar do usuario com dropdown (Perfil, Admin, Sair)
- Botao de fechar/colapsar sidebar (icone X ou PanelRightClose)

Estado `collapsed` controla visibilidade. Quando colapsada, mostra apenas um botao flutuante para reabrir.

Props: mesmas do TopBar atual (selectedProjectId, onSelectProject, activePanel, onPanelChange) + `collapsed`/`onToggle`.

## 2. Criar Dashboard Inicial

**Novo arquivo: `src/components/DashboardPanel.tsx`**

Exibido quando `projectId === null` no lugar dos paineis de geracao.

Conteudo:
- **Cards de estatisticas**: total de criativos do usuario, criativos nos ultimos 7 dias
- **Ultimos 10 criativos**: grid com thumbnail, nome do projeto, data
- **Projetos recentes**: lista de projetos onde o usuario gerou criativos, ordenados pelo mais recente

Queries (todas filtram por `created_by = auth.uid()`):
- `SELECT count(*) FROM generated_creatives WHERE created_by = auth.uid()` — total
- `SELECT count(*) FROM generated_creatives WHERE created_by = auth.uid() AND created_at > now() - interval '7 days'` — ultimos 7 dias
- `SELECT * FROM generated_creatives WHERE created_by = auth.uid() ORDER BY created_at DESC LIMIT 10` — ultimos 10
- `SELECT DISTINCT project_id, max(created_at) as last_gen FROM generated_creatives WHERE created_by = auth.uid() GROUP BY project_id ORDER BY last_gen DESC` — projetos recentes (join com projects para pegar nome)

**Hook: `src/hooks/useDashboardStats.ts`** — encapsula essas queries.

## 3. Alterar Index.tsx

- Remover `<TopBar />`
- Layout muda de `flex-col` para `flex flex-row`
- Conteudo principal (left column + right panel) ocupa `flex-1`
- `<RightSidebar />` fica na direita
- Quando `projectId === null` e `activePanel === 'generate'`, mostrar `<DashboardPanel />` ao inves dos paineis
- Ao clicar num projeto no dashboard, chama `handleProjectChange(id)`

## 4. Deletar TopBar.tsx

Nao sera mais usado.

## Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/components/RightSidebar.tsx` |
| Criar | `src/components/DashboardPanel.tsx` |
| Criar | `src/hooks/useDashboardStats.ts` |
| Editar | `src/pages/Index.tsx` |
| Deletar | `src/components/TopBar.tsx` |

Nenhuma migracao de banco necessaria — `generated_creatives` ja tem `created_by`.

