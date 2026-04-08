

# Modal de Criativos: Mais Espaço + Prompt com "Ver Mais"

## Problemas
1. O painel lateral (botões + prompt) tem largura fixa pequena (`min-w-[120px]`), ficando "esmagado" em imagens horizontais.
2. Prompts longos ocupam espaço indefinidamente sem scroll nem truncamento.

## Solução

### Layout do modal
- Aumentar a largura mínima do painel lateral para `min-w-[180px] max-w-[220px]`
- Aumentar o `max-w` da imagem de `60vw` para `65vw`
- Envolver o painel lateral em um `ScrollArea` com `max-h-[80vh]` para não estourar o modal

### Prompt com "Ver Mais"
- Criar um mini-componente inline com estado `expanded`
- Quando colapsado: `line-clamp-4` (4 linhas) + botão "Ver mais"
- Quando expandido: texto completo dentro de scroll, botão "Ver menos"

### Consistência
Aplicar as mesmas mudanças nos 5 painéis que têm modal:
- `CreativesPanel.tsx`
- `GeneratePanel.tsx`
- `DynamicResultsPanel.tsx`
- `DashboardPanel.tsx`
- `HistoryPanel.tsx`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/CreativesPanel.tsx` |
| Editar | `src/components/GeneratePanel.tsx` |
| Editar | `src/components/DynamicResultsPanel.tsx` |
| Editar | `src/components/DashboardPanel.tsx` |
| Editar | `src/components/HistoryPanel.tsx` |

