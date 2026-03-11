

# Modal de Preview + Confirmação de Exclusão no Swipe File

## Mudanças

### 1. Novo componente: `src/components/SwipePreviewModal.tsx`
- `Dialog` com `max-w-5xl`, layout flex: imagem ampliada à esquerda (~60%), elementos detectados à direita (~40%)
- Usa `useSwipeAnalysis` para listar textos, logos, fotos com ícones e badges
- Skeleton se análise pendente, mensagem vazia se sem análise

### 2. Modificar: `src/components/SwipeFilePanel.tsx`
- Adicionar ícone `Expand` (ou `Maximize2`) ao lado do botão `Trash2`, mesmo estilo (absolute, opacity on hover)
- Clicar no ícone abre a modal de preview (state `previewFile`)
- O clique na thumbnail continua apenas selecionando o swipe (sem abrir modal)
- Botão `Trash2`: em vez de deletar direto, abre `AlertDialog` de confirmação ("Tem certeza que deseja excluir esta imagem?")
- Confirmar executa `deleteFile.mutate()`; cancelar fecha o dialog

### Arquivos
- **Criar:** `src/components/SwipePreviewModal.tsx`
- **Modificar:** `src/components/SwipeFilePanel.tsx` (ícone expand, AlertDialog de confirmação, state da modal)

