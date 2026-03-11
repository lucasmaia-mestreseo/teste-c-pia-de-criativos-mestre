

# Resetar overrides ao trocar de swipe file

## Problema
Ao trocar de imagem no swipe file, o `elementOverrides` mantém os dados da imagem anterior. O `useEffect` no `SwipeElementsEditor` tenta preservar overrides existentes (`overrides.texts[t.id] ?? ...`), mas como os IDs mudam entre análises diferentes, os campos antigos ficam "fantasmas" no estado.

O problema principal está em dois lugares:
1. **`GeneratePanel.tsx`**: não reseta `elementOverrides` ao trocar de `selectedSwipe`
2. **`SwipeElementsEditor.tsx`**: o useEffect usa `overrides.texts[t.id] ??` que tenta preservar dados antigos

## Mudanças

### `src/components/GeneratePanel.tsx`
- Adicionar um `useEffect` que reseta `elementOverrides` para `EMPTY_OVERRIDES` quando `selectedSwipe?.id` muda

### `src/components/SwipeElementsEditor.tsx`
- No useEffect de inicialização, sempre criar overrides frescos a partir da análise (não tentar preservar overrides antigos), já que o reset no GeneratePanel garante que são novos

