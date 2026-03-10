

# Melhorar fidelidade do Brand Kit na geração de criativos

## Problema

O system prompt atual é genérico demais. O modelo de IA trata as instruções de marca como sugestões, não como regras absolutas. Resultado: logo substituído, pessoa não fiel, cores de fundo e texto ignoradas.

## Solução

Reescrever o system prompt e as instruções do `generate-creative` edge function para ser muito mais assertivo e específico sobre fidelidade.

### Edge Function `generate-creative/index.ts`

1. **System prompt reescrito** com regras absolutas e numeradas:
   - "NÃO redesenhe, recrie ou altere o logo. Copie-o pixel a pixel da imagem fornecida."
   - "NÃO gere um rosto novo. Use EXATAMENTE o rosto da foto de pessoa fornecida, sem alterações."
   - "A cor de fundo DEVE ser exatamente `{backgroundColor}`. Não adicione linhas, gradientes ou texturas que não estejam na referência."
   - "Textos de headline devem usar a cor primária `{primaryColor}` ou secundária `{secondaryColor}` da marca."
   - "Use EXATAMENTE a tipografia `{typography}` para todos os textos."

2. **Instruções por imagem mais enfáticas**: Ao enviar logo e foto de pessoa, usar linguagem mais forte:
   - Logo: "OBRIGATÓRIO: Use este logo EXATAMENTE como está, sem modificações de forma, cor ou proporção. Não crie um logo diferente."
   - Pessoa: "OBRIGATÓRIO: Use EXATAMENTE este rosto e aparência. Não gere um rosto diferente. Mantenha total fidelidade à foto."

3. **Adicionar regras negativas explícitas** no prompt:
   - "PROIBIDO: alterar cores do logo, gerar rostos diferentes, adicionar texturas ao fundo, usar cores que não estejam no brand kit para elementos de texto."

### Arquivo modificado
- `supabase/functions/generate-creative/index.ts` — reescrita do prompt para máxima fidelidade

