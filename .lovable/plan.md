

# Corrigir deploy + Auto-análise no upload do Swipe File

## Problema resolvido
A edge function `analyze-swipe` não estava deployed — já fiz o deploy e confirmei que funciona (retornou status 200 com análise completa).

## Mudança: Auto-análise no upload

Mover a análise para acontecer automaticamente ao fazer upload, em vez de exigir clique manual no botão "Analisar".

### `src/hooks/useSwipeFiles.ts`
- No `useUploadSwipeFile`, após o insert retornar sucesso, disparar `supabase.functions.invoke('analyze-swipe')` em background (fire-and-forget, sem bloquear o upload)
- Ao terminar a análise, invalidar a query `swipe_files` para atualizar o cache

### `src/components/SwipeElementsEditor.tsx`
- Remover o botão "Analisar Elementos" manual
- Quando `analysis` é null e não está analisando, mostrar um indicador sutil de "Análise pendente..." ou "Analisando..."
- Manter o editor funcional quando a análise já existe

### `src/hooks/useSwipeAnalysis.ts`
- Simplificar: remover a função `analyze` exposta (não será mais chamada manualmente)
- Manter apenas o estado de leitura da análise do swipe selecionado

### `src/components/GeneratePanel.tsx`
- Remover referência ao botão de análise manual
- O editor de elementos aparece automaticamente quando o swipe já tem análise

