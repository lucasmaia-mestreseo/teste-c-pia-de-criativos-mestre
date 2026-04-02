

# Ajustes 01, 02 e 03

## AJUSTE 01 — Caixa de prompt customizado na Geração Dinâmica

**`src/components/DynamicGeneratePanel.tsx`:**
- Adicionar estado `customPrompt` (string vazia)
- Renderizar um `Textarea` com placeholder "Instruções adicionais para a geração..." entre os checkboxes e o botão de gerar
- Enviar `customPrompt` no body para a edge function

**`supabase/functions/generate-dynamic-creative/index.ts`:**
- Ler `customPrompt` do body
- Inserir o conteúdo do `customPrompt` no prompt do briefing, após as instruções padrão (ex: "Instruções adicionais do usuário: {customPrompt}")

## AJUSTE 02 — Fidelidade tipográfica e posicional no Swipe File

**`supabase/functions/generate-creative/index.ts`:**
- Na `buildInstructionBlock`, na **Seção 2 (Regras de Texto)**, adicionar regra explícita:
  - "TODOS os textos DEVEM ser posicionados nos MESMOS locais da imagem de referência, com os MESMOS tamanhos relativos e a MESMA hierarquia visual."
  - "Se 'Ignorar Brand Kit' estiver ativo, use a MESMA tipografia (fonte, peso, estilo) visível na imagem de referência. NÃO substitua por outra fonte."
- Receber flag `ignoreBrandKit` (boolean) no body (já existe implicitamente via `brandKit: null`)
- Adicionar nova flag `ignoreBrandKit` explicitamente no body para que a edge function saiba diferenciar "sem brand kit definido" de "ignorar brand kit intencionalmente"
- Quando `ignoreBrandKit === true` e há swipe reference, adicionar seção: "Como o Brand Kit foi ignorado, COPIE EXATAMENTE a tipografia, cores e estilos visuais da imagem de referência."

**`src/components/GeneratePanel.tsx`:**
- Enviar `ignoreBrandKit: true` no body (além de enviar `brandKit: null`)

## AJUSTE 03 — Não limpar prompt/referências/checkboxes após geração

**`src/components/GeneratePanel.tsx` (linha 165):**
- Remover `setPrompt('')` após geração bem-sucedida — manter o prompt do swipe mode intacto
- Os estados `freePromptData`, `templateData`, `ignoreBrandKit`, `ignoreContext`, `includeLogo`, `includePersonPhoto`, `selectedPersonPhoto`, `attachedImages` já são preservados naturalmente (não são resetados)

**`src/components/DynamicGeneratePanel.tsx`:**
- Verificar que nenhum estado é limpo após `handleGenerate` — atualmente não limpa nada, OK

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/DynamicGeneratePanel.tsx` — adicionar Textarea de customPrompt |
| Editar | `supabase/functions/generate-dynamic-creative/index.ts` — ler e usar customPrompt |
| Editar | `src/components/GeneratePanel.tsx` — enviar `ignoreBrandKit` flag + remover `setPrompt('')` |
| Editar | `supabase/functions/generate-creative/index.ts` — regras de fidelidade tipográfica/posicional + lógica ignoreBrandKit |

