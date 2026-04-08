

# Navegação Modal Consistente em Todos os Painéis

## Situação Atual

| Painel | Modal | Navegação por setas |
|--------|-------|---------------------|
| CreativesPanel | ✅ | ✅ |
| GeneratePanel | ✅ | ✅ |
| DynamicResultsPanel | ✅ | ✅ |
| **DashboardPanel** | ✅ | ❌ Sem setas |
| **HistoryPanel** | ❌ Sem modal | ❌ |

## Solução

### DashboardPanel
- Substituir `modalCreative` (objeto) por `selectedIndex` (número)
- Adicionar `handlePrev` / `handleNext` com `useCallback`
- Adicionar listener de teclado (ArrowLeft/ArrowRight)
- Adicionar botões ChevronLeft/ChevronRight no modal
- Adicionar contador "X / Y"

### HistoryPanel
- Adicionar estado `selectedIndex` e modal com Dialog
- Adicionar navegação por setas (botões + teclado)
- Tornar a imagem clicável para abrir o modal
- Incluir botões de ação no modal (Download, Excluir)
- Adicionar contador "X / Y"

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/DashboardPanel.tsx` — converter para selectedIndex + setas |
| Editar | `src/components/HistoryPanel.tsx` — adicionar modal com navegação completa |

