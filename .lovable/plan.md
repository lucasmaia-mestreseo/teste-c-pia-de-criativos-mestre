

# Fix: Retry automático quando IA não gera imagem

## Problema
O modelo retorna `content: null` com `native_finish_reason: "IMAGE_OTHER"` — a IA falhou silenciosamente sem gerar imagem. Isso acontece intermitentemente, especialmente com prompts complexos ou múltiplas imagens de referência.

## Solução
Adicionar retry automático (até 2 tentativas extras) na edge function `generate-creative/index.ts` quando a resposta não contém imagem. Na segunda tentativa, simplificar o prompt para aumentar chance de sucesso.

### `supabase/functions/generate-creative/index.ts` (linhas 508-573)
- Envolver a chamada à AI gateway em um loop de até 3 tentativas
- Se `content` vier `null` ou sem imagem, aguardar 1s e tentar novamente
- Na 3a tentativa, trocar para modelo `google/gemini-3.1-pro-image-preview` como fallback (mais potente)
- Log de cada tentativa para debugging
- Mensagem de erro final mais descritiva

