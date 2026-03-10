

# Análise estrutural do Swipe File com campos editáveis

## Conceito
Ao selecionar (ou fazer upload de) um swipe file, o sistema analisa a imagem via AI para detectar **textos**, **logos** e **fotos/pessoas**. Os elementos detectados aparecem como campos editáveis no painel de geração. O usuário pode: substituir textos, limpar campos (para pedir remoção), e alternar logo/foto. Tudo isso é enviado como mapa estruturado ao prompt de geração.

## Arquitetura

```text
Upload/Seleção ──► analyze-swipe (edge function)
                   (gemini-2.5-flash, tool calling)
                        │
                        ▼
                   swipe_files.analysis (JSONB)
                   {
                     texts: [{ id, content, position, role }],
                     logos: [{ id, position, description }],
                     photos: [{ id, position, description }]
                   }
                        │
                        ▼
                   GeneratePanel exibe campos editáveis
                        │
                        ▼
                   generate-creative recebe elementMap
                   e injeta no prompt por elemento
```

## Mudanças

### 1. Migração: adicionar coluna `analysis` ao `swipe_files`
- `ALTER TABLE swipe_files ADD COLUMN analysis jsonb DEFAULT NULL`
- Armazena resultado da análise para não re-analisar toda vez

### 2. Nova edge function: `supabase/functions/analyze-swipe/index.ts`
- Recebe `swipeFileUrl` e `swipeFileId`
- Usa `google/gemini-2.5-flash` com **tool calling** para retornar JSON estruturado:
  - `texts[]`: cada bloco de texto detectado com `id`, `content` (texto exato), `position` (ex: "topo centro"), `role` (headline, subtítulo, CTA, legenda)
  - `logos[]`: cada logo detectado com `id`, `position`, `description`
  - `photos[]`: cada foto/pessoa detectada com `id`, `position`, `description`
- Salva resultado na coluna `analysis` do `swipe_files`
- Retorna o JSON ao frontend

### 3. Hook: `src/hooks/useSwipeAnalysis.ts`
- `useSwipeAnalysis(swipeFile)`: retorna a análise do swipe selecionado
- Se `swipeFile.analysis` já existe, usa direto
- Se não, invoca `analyze-swipe` e invalida a query

### 4. UI: `src/components/SwipeElementsEditor.tsx`
- Renderizado no GeneratePanel quando um swipe está selecionado e tem análise
- Para cada **texto detectado**: input editável pré-preenchido com o texto original. Se o usuário apagar, marca como "remover". Se alterar, marca como "substituir por X"
- Para cada **logo detectado**: toggle "Substituir pelo meu logo" (usa o logo do brand kit)
- Para cada **foto detectada**: toggle "Substituir pela minha foto" (usa a foto do brand kit)
- Compacto, colapsável, com labels curtos (ex: "Headline: ...", "CTA: ...")

### 5. `src/components/GeneratePanel.tsx`
- Importa `SwipeElementsEditor` e `useSwipeAnalysis`
- Ao selecionar um swipe, dispara análise se necessário
- Mantém estado `elementOverrides` com as edições do usuário
- Envia `elementOverrides` no body da chamada `generate-creative`
- Botão "Analisar" aparece se swipe não tem análise ainda (com loading state)

### 6. `supabase/functions/generate-creative/index.ts`
- Recebe novo campo `elementOverrides` no body
- Nova SEÇÃO no `buildInstructionBlock`: **MAPA DE ELEMENTOS DETECTADOS**
  - Lista cada elemento com sua posição e a ação: manter, substituir, ou remover
  - Ex: `"HEADLINE no topo-centro: SUBSTITUIR 'Texto Original' → 'Novo Texto do Usuário'"`
  - Ex: `"CTA no canto inferior: REMOVER completamente"`
  - Ex: `"LOGO no canto inferior-direito: SUBSTITUIR pelo logo fornecido"`
- Adiciona ao checklist: "Cada elemento do mapa foi tratado conforme a ação especificada?"

### Fluxo do usuário
1. Faz upload de imagem no Swipe File
2. Seleciona a imagem → sistema analisa automaticamente (loading ~2-3s)
3. Campos aparecem acima do prompt: textos editáveis, toggles para logo e foto
4. Usuário edita textos, apaga o que quer remover, ativa substituições
5. Escreve prompt adicional se quiser
6. Clica "Gerar Criativo" → tudo é enviado de forma estruturada

