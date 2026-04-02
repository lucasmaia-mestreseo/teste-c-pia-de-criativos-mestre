

# Sugestões de Criativos com IA no Prompt Livre

## Conceito

Adicionar uma seção abaixo do campo de prompt e anexos no `FreePromptPanel` com 3 cards de sugestões (Conservador, Inovador, Fora da Caixa). Um botão "Sugerir Criativos com IA" chama uma edge function que gera os 3 briefings. Ao clicar em um card, o prompt é preenchido com a sugestão. Se já houver texto no prompt, um diálogo de confirmação é exibido.

## Frontend — `src/components/FreePromptPanel.tsx`

- Adicionar estados: `suggestions` (array de 3 objetos com `type`, `titulo`, `copy`, `proposta_imagem`, `objetivo`), `selectedSuggestion` (index ou null), `suggesting` (boolean), `confirmIndex` (para AlertDialog)
- Adicionar botão "Sugerir Criativos com IA" (ícone Sparkles, desabilitado se `suggesting`)
- Ao clicar, chamar `supabase.functions.invoke('suggest-creatives', { body: { projectId } })`
- Renderizar 3 cards com ícones ShieldCheck/Lightbulb/Rocket (mesmo padrão visual da Geração Dinâmica)
- Cada card mostra: tipo (tag), título, copy resumida
- Ao clicar num card:
  - Se `data.prompt` está vazio → preenche direto e marca como selecionado
  - Se `data.prompt` tem conteúdo → abre AlertDialog perguntando se deseja substituir
  - Se confirmado → substitui o prompt, marca selecionado
- Card selecionado tem borda `border-primary`
- Ao clicar no card já selecionado → desmarca (não limpa prompt)
- Ao clicar em outro card com prompt preenchido → mesmo fluxo de confirmação
- O texto inserido no prompt é formatado como: `Título: {titulo}\nCopy: {copy}\nImagem: {proposta_imagem}\nObjetivo: {objetivo}`

- Precisa receber `projectId` (já recebe)

## Edge Function — `supabase/functions/suggest-creatives/index.ts`

- Nova edge function
- Recebe `{ projectId }`
- Busca contexto do projeto (`context`, `voice_guide`, `name`) via service client autenticado
- Chama Lovable AI (`google/gemini-3-flash-preview`) com tool calling para retornar 3 sugestões estruturadas
- System prompt: "Gere 3 sugestões de criativos para redes sociais: uma conservadora, uma inovadora e uma fora da caixa"
- User prompt inclui contexto e tom de voz do projeto
- Tool: `suggest_creatives` com array de 3 objetos `{ type, titulo, copy, proposta_imagem, objetivo_estrategico }`
- Retorna o array de sugestões

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/suggest-creatives/index.ts` |
| Editar | `src/components/FreePromptPanel.tsx` — botão, cards, seleção, confirmação |

