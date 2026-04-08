

# Ajustes: Navegação no Modal de Criativos + Texto nos Criativos Dinâmicos

## AJUSTE #01 — Setas de navegação no modal de criativos

### Problema
Ao abrir um criativo no modal, para ver o próximo/anterior é preciso fechar e abrir outro manualmente.

### Solução
Adicionar navegação prev/next no modal de ambos os painéis (`CreativesPanel` e `GeneratePanel`):

- Armazenar o **índice** do criativo aberto ao invés de apenas o objeto
- Adicionar botões de seta (ChevronLeft/ChevronRight) nas laterais da imagem no modal
- Suporte a teclas de seta (ArrowLeft/ArrowRight) para navegar pelo teclado
- Desabilitar seta quando no primeiro/último item

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/CreativesPanel.tsx` — estado por índice, setas no modal, navegação por teclado |
| Editar | `src/components/GeneratePanel.tsx` — mesma lógica de navegação no modal |

---

## AJUSTE #02 — Incluir texto (copy) nos criativos dinâmicos

### Problema
A Edge Function `generate-dynamic-creative` instrui explicitamente o modelo a **NÃO incluir texto na imagem** (linha 142: `DO NOT include any text in the image`). Por isso, mesmo que o briefing gere título e copy, a imagem sai sem texto.

### Solução
Alterar o prompt de geração de imagem para **incluir o título e a copy** como elementos visuais do criativo:

- Remover a instrução "DO NOT include any text"
- Adicionar ao prompt: o título como headline e a copy como texto de apoio
- Instruir o modelo a compor esses textos como parte do layout visual do anúncio

### Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/generate-dynamic-creative/index.ts` — reescrever `imagePrompt` para incluir título e copy como texto visual |

