

# Remover Metadados de Imagens Geradas

## Problema
Imagens geradas pela IA podem conter metadados (EXIF, tEXt chunks PNG, etc.) que expõem informações indesejadas.

## Solução
Re-codificar cada imagem via Canvas API (OffscreenCanvas no Deno) antes do upload. Isso descarta todos os metadados, mantendo apenas os pixels.

Como Deno em edge functions não tem Canvas/OffscreenCanvas, a abordagem mais confiável é **re-encodar o PNG removendo chunks não-essenciais manualmente** — ou seja, parsear o PNG e manter apenas os chunks `IHDR`, `IDAT`, e `IEND`, descartando `tEXt`, `iTXt`, `zTXt`, `eXIf`, etc.

## Implementação

### Helper function `stripPngMetadata`
Criar uma função utilitária inline nos dois edge functions que:
1. Lê os bytes do PNG
2. Itera pelos chunks PNG (cada chunk = 4 bytes length + 4 bytes type + data + 4 bytes CRC)
3. Mantém apenas: signature (8 bytes), `IHDR`, `PLTE`, `tRNS`, `IDAT`, `IEND`
4. Reconstrói o buffer limpo

### Arquivos a modificar
- **`supabase/functions/generate-creative/index.ts`** — aplicar `stripPngMetadata(imageBytes)` antes do upload (linha ~593)
- **`supabase/functions/generate-person-grid/index.ts`** — mesmo tratamento (linha ~123)

### Lógica do strip (pseudocódigo)
```text
PNG = 8-byte signature + chunks
chunk = [4B length][4B type][data][4B CRC]

keepTypes = {"IHDR","PLTE","tRNS","IDAT","IEND"}
output = signature
for each chunk:
  if type in keepTypes: output += chunk
return output
```

Simples, sem dependências externas, funciona em Deno.

