

# Ajustes 01 e 02 — Referência e Ações no Dashboard

## AJUSTE 01 — Botão "Usar Como Referência" nos grids e modais

### Conceito
Ao clicar em "Referência" no hover de um criativo (ou no modal de detalhe), a `image_url` é adicionada ao array `freePromptData.attachedImages`, o modo muda para `free`, e o painel ativo vai para `generate`. O usuário é levado diretamente ao Prompt Livre com a imagem anexada.

### Implementação

**`src/pages/Index.tsx`:**
- Criar callback `handleUseAsReference(imageUrl: string, projectId: string)` que:
  1. Seta `projectId` se necessário
  2. Seta `creationMode('free')`
  3. Adiciona a URL em `freePromptData.attachedImages` (sem duplicar)
  4. Seta `activePanel('generate')`
  5. Toast de confirmação
- Passar `onUseAsReference` para `GeneratePanel`, `DynamicResultsPanel`, `CreativesPanel`, e `DashboardPanel`

**Grids (4 arquivos):** Em cada hover bar, adicionar um novo botão com ícone `ImagePlus` (lucide) com título "Referência", que chama `onUseAsReference(c.image_url)`.

**Modais (4 arquivos):** Adicionar botão "Usar Como Referência" com ícone `ImagePlus` na sidebar do modal de detalhe.

Arquivos afetados:
- `src/pages/Index.tsx` — callback + passar prop
- `src/components/GeneratePanel.tsx` — receber prop, botão no grid e modal
- `src/components/DynamicResultsPanel.tsx` — receber prop, botão no grid e modal
- `src/components/CreativesPanel.tsx` — receber prop, botão no grid e modal
- `src/components/DashboardPanel.tsx` — receber prop, botão no grid e modal (ver Ajuste 02)

## AJUSTE 02 — Ações completas no grid do Dashboard

### Problema
O grid de imagens do Dashboard só mostra formato e data no hover. Faltam os botões padrão (Eye, Star, Download, Trash, Referência).

### Implementação

**`src/components/DashboardPanel.tsx`:**
- Importar hooks `useDeleteCreative`, `useToggleFavorite`, `useGeneratedCreatives` (não — os dados já vêm de `useDashboardStats` sem `favorite`/`prompt`)
- Alternativa: expandir `useDashboardStats` para incluir `favorite`, `prompt`, `project_id` nos `recentCreatives`
- Adicionar estados para `modalCreative`, `deleteTarget`, `thumbSize` com slider
- Replicar o mesmo padrão de hover bar e modal dos outros grids
- Incluir o botão de Referência

**`src/hooks/useDashboardStats.ts`:**
- Na query `recentCreatives`, adicionar campos `favorite`, `prompt`, `project_id` ao select (linha 42)

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Index.tsx` — callback `handleUseAsReference` + props |
| Editar | `src/components/GeneratePanel.tsx` — prop + botão referência no grid e modal |
| Editar | `src/components/DynamicResultsPanel.tsx` — prop + botão referência no grid e modal |
| Editar | `src/components/CreativesPanel.tsx` — prop + botão referência no grid e modal |
| Editar | `src/components/DashboardPanel.tsx` — hover bar completa + modal + referência |
| Editar | `src/hooks/useDashboardStats.ts` — campos extras no select |

