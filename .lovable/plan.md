

# Botão "IA" para Preencher Campos de Modelos

## Mudança

### `src/components/TemplatesPanel.tsx`

Adicionar um botão com ícone `Sparkles` + "IA" no header do modelo selecionado (ao lado do nome do template). Ao clicar:

1. Buscar o `context` do projeto via `supabase.from('projects').select('context').eq('id', projectId)`
2. Mapear os campos do template para o formato esperado pela edge function `suggest-texts`:
   - Cada campo vira `{ id: field.key, role: field.key, content: currentValue || field.placeholder, position: field.label }`
3. Chamar `supabase.functions.invoke('suggest-texts', { body: { context, texts } })`
4. Preencher os campos com as sugestões retornadas (matching por `id`)
5. Toast de sucesso/erro, loading state com `Loader2`
6. Desabilitado se contexto do projeto não estiver preenchido (tooltip explicativo)

### Props
- `projectId` já está disponível como prop -- basta buscar o context

### Nenhuma mudança na edge function
A `suggest-texts` já aceita textos genéricos com id/role/content.

### Arquivo
- **Modificar:** `src/components/TemplatesPanel.tsx`

