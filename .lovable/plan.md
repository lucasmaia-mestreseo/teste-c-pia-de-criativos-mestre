

# Pré-análise do logo para preservar textos

## Problema
O modelo de geração de imagem não "entende" que o logo contém textos pequenos (em cima e embaixo), e acaba cortando essas partes ao reproduzi-lo. Mesmo com instruções rigorosas, o modelo não tem contexto suficiente sobre o conteúdo textual do logo.

## Solução
Adicionar um passo de **pré-análise do logo via AI** dentro da edge function `generate-creative`, antes da geração da imagem. Esse passo usa um modelo de texto+visão (Gemini Flash) para descrever o logo em detalhes — textos exatos, posição de cada elemento, proporções. Essa descrição é então injetada no prompt de geração.

## Mudanças

### `supabase/functions/generate-creative/index.ts`

1. **Nova função `analyzeLogoContent()`** — faz uma chamada ao `google/gemini-2.5-flash` (texto apenas, barato e rápido) enviando a imagem do logo e pedindo:
   - Todos os textos exatos presentes no logo (topo, centro, base)
   - Descrição da estrutura visual (ícone central, texto acima, texto abaixo, etc.)
   - Proporção aproximada de cada parte

2. **Chamar antes da geração** — quando `hasLogo` é true, executar `analyzeLogoContent(brandKit.logoUrl)` e guardar o resultado

3. **Injetar no prompt do logo** — na SEÇÃO 4 (REGRAS DO LOGO), adicionar um bloco com a descrição extraída:
   ```
   📝 CONTEÚDO DO LOGO DETECTADO:
   [descrição da AI]
   
   - Cada texto listado acima DEVE aparecer legível e completo no logo final
   - Se o logo tem texto no topo, a parte superior NÃO pode ser cortada
   - Se o logo tem texto na base, a parte inferior NÃO pode ser cortada
   ```

4. **Atualizar o label do logo** na seção de `userContent` para incluir a descrição textual detectada

### Fluxo
```text
Logo URL ──► analyzeLogoContent() ──► "Ícone central com raio,
             (gemini-2.5-flash)       texto 'IA NA PRÁTICA' acima,
                                      texto 'INTELIGÊNCIA...' abaixo"
                                           │
                                           ▼
                                   Injeta na SEÇÃO 4 do prompt
                                           │
                                           ▼
                                   Geração da imagem
                                   (gemini-3.1-flash-image)
```

### Custo
Uma chamada extra de texto+visão por geração (~0.001 USD), sem impacto perceptível no tempo total.

