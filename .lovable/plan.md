

# Contexto do Projeto + Sugestão AI de textos

## Conceito
Adicionar um painel "Contexto" na TopBar (ao lado de Brand Kit) onde o usuário descreve informações do projeto (público-alvo, produto, tom de voz, ofertas, etc.). Esse texto é salvo na tabela `projects` numa nova coluna `context`. No `SwipeElementsEditor`, um botão sparkle chama uma edge function que usa o contexto + análise dos elementos para sugerir textos substitutos inteligentes.

## Mudanças

### 1. Migração: coluna `context` em `projects`
```sql
ALTER TABLE projects ADD COLUMN context text DEFAULT '';
```

### 2. TopBar: novo botão "Contexto"
- Adicionar `'context'` ao tipo `RightPanel`
- Botão com ícone `FileText` ao lado de Brand Kit

### 3. Novo componente: `src/components/ContextPanel.tsx`
- Textarea grande para o usuário escrever o contexto do projeto
- Auto-save com debounce (update na tabela `projects.context`)
- Hook simples usando `useQuery`/`useMutation` para ler/salvar

### 4. Index.tsx: renderizar ContextPanel
- Adicionar caso `activePanel === 'context'`

### 5. Nova edge function: `supabase/functions/suggest-texts/index.ts`
- Recebe: `context` (texto do projeto), `analysis.texts` (elementos detectados)
- Usa Lovable AI (`google/gemini-3-flash-preview`) para gerar sugestões de texto para cada elemento, respeitando role/posição
- Usa tool calling para retornar JSON estruturado: `{ suggestions: { id: string, text: string }[] }`
- Retorna as sugestões mapeadas por ID

### 6. SwipeElementsEditor: botão sparkle
- Botão com ícone `Sparkles` no header do collapsible (ao lado de "Elementos detectados")
- Ao clicar, chama `suggest-texts` passando contexto + textos da análise
- Preenche os campos de texto com as sugestões retornadas (ação `replace`)
- Loading state no botão durante a chamada
- Desabilitado se não houver contexto salvo

### 7. Props: passar `projectContext` ao SwipeElementsEditor
- GeneratePanel busca o contexto do projeto (query na tabela projects) e passa como prop

## Fluxo
1. Usuário vai em "Contexto" e escreve sobre o projeto
2. Seleciona um swipe file (análise já feita)
3. Clica no sparkle nos elementos detectados
4. AI preenche os textos com sugestões baseadas no contexto
5. Usuário ajusta se quiser e gera o criativo

