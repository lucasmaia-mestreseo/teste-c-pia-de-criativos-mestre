
## Objetivo

Tornar a geração muito mais consistente quando houver Brand Kit, principalmente em 4 pontos:
1. não perder a foto da pessoa quando o logo também estiver ativo
2. respeitar cores/tipografia mesmo sem usar logo
3. tratar substituição de texto como instrução obrigatória
4. diferenciar claramente “trocar a pessoa” vs “trocar a fotografia inteira” no prompt enviado à API

## Diagnóstico do código atual

Hoje a function `generate-creative` envia:
- um `systemPrompt` forte, mas ainda genérico
- o `prompt` do usuário como texto solto
- a imagem base
- opcionalmente logo e foto da pessoa

Problemas prováveis no formato atual:
- o pedido do usuário entra “cru”, sem ser reescrito como regras obrigatórias
- não existe uma seção específica para **texto obrigatório a aparecer / texto obrigatório a substituir**
- não existe um modo explícito para **face swap** vs **photo replacement**
- quando logo + pessoa + cores + tipografia entram juntos, o modelo pode priorizar só parte das instruções
- as regras de cores estão descritivas, mas não em um checklist final de execução por elemento

## Plano de implementação

### 1. Reestruturar o payload enviado para a API
Em vez de mandar só o prompt cru, montar um bloco textual estruturado antes da chamada, com seções fixas:
- `OBJETIVO PRINCIPAL`
- `TEXTO OBRIGATÓRIO`
- `TEXTO PROIBIDO / TEXTO A SUBSTITUIR`
- `REGRAS DE COR POR ELEMENTO`
- `REGRAS DE TIPOGRAFIA`
- `REGRAS DE LOGO`
- `REGRAS DE PESSOA`
- `CHECKLIST FINAL DE FIDELIDADE`

Isso reduz ambiguidades e força prioridade.

### 2. Tornar o texto do criativo obrigatório
Adicionar ao prompt uma regra explícita:
- todo texto solicitado pelo usuário deve aparecer na imagem final
- textos antigos da referência devem ser removidos ou substituídos quando o prompt pedir
- o modelo não pode inventar headline, CTA ou copy diferente se o usuário tiver especificado o texto

Também vou orientar o prompt a interpretar frases como:
- “troque o texto”
- “substitua a headline”
- “use este CTA”
- “mantenha só a estrutura visual”
como ordens mandatórias.

### 3. Separar dois comportamentos para pessoa/foto
Vou ajustar o prompt para deixar claro dois modos:

**Modo padrão**
- se houver foto de pessoa no Brand Kit, trocar apenas a pessoa da referência
- preservar pose, enquadramento, roupa e contexto

**Modo explícito de troca de fotografia**
- se o prompt indicar que quer substituir a fotografia/imagem inteira, usar a nova foto como base visual principal daquela área
- não apenas trocar rosto/características

A function pode detectar termos no prompt como:
- “substituir a foto”
- “trocar a fotografia”
- “usar exatamente esta foto”
- “usar a foto original do brand kit”
e então enviar instruções diferentes para o modelo.

### 4. Reforçar prioridade quando logo e pessoa forem usados juntos
Vou reorganizar a ordem e redação das instruções multimodais para evitar que um asset “apague” o outro:
- primeiro: referência base
- depois: bloco de instruções estruturadas
- depois: logo com regras de integridade
- depois: pessoa com regras de uso
- finalizar com checklist obrigatório dizendo que **todos** os assets enviados devem ser respeitados simultaneamente, não apenas parcialmente

### 5. Transformar cores e tipografia em mapa obrigatório
Hoje há regras por cor, mas vou deixar isso ainda mais rígido em formato de mapeamento:
- fundo: `backgroundColor`
- headline principal: `primaryColor` ou `secondaryColor` conforme instrução
- textos de apoio: `secondaryColor`
- CTA fundo: `primaryColor`
- CTA texto: `secondaryColor` ou branco apenas se contraste exigir
- detalhes: `auxColors`
- tipografia: usar exatamente a fonte do Brand Kit ou o equivalente visual mais próximo sem trocar o estilo

Também vou incluir uma proibição final:
- se o logo estiver desativado, as regras de cor e tipografia continuam obrigatórias
- assets opcionais não desativam o restante do Brand Kit

### 6. Melhorar a robustez do código da edge function
No arquivo `supabase/functions/generate-creative/index.ts` vou:
- extrair helpers para montar prompts mais previsíveis
- montar um `instructionBlock` separado do `systemPrompt`
- detectar automaticamente intenção de “photo replacement” vs “person swap”
- injetar um checklist final de validação no prompt
- manter o tratamento de erros atual

## Arquivos a alterar

- `supabase/functions/generate-creative/index.ts`

## Resultado esperado

Após a mudança:
- quando marcar logo + pessoa, os dois devem ser considerados juntos com muito mais consistência
- quando não marcar logo, cores e tipografia continuam obrigatórias
- quando o prompt pedir troca de texto, o texto passa a ser tratado como requisito obrigatório
- quando o prompt pedir trocar a fotografia, o comportamento muda de face swap para substituição mais literal da imagem/foto
