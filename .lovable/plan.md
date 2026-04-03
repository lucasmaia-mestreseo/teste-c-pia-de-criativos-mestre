

# Corrigir o ajuste de tamanho do logo

## Problema

O `logoSize` é passado apenas como instrução textual no prompt para o modelo de IA (ex: "Pequeno (~3-5% da área)"). Porém, na mesma seção existe uma regra conflitante que diz "O novo logo DEVE ter o MESMO tamanho relativo que o logo da referência". Quando ambas estão presentes, o modelo ignora o tamanho solicitado e segue a referência.

Além disso, quando não há imagem de referência (modo `free`), a instrução genérica de "5-8% da área" compete com o tamanho escolhido pelo usuário.

## Solução

Editar `supabase/functions/generate-creative/index.ts`, na função `buildInstructionBlock`, seção 4 (REGRAS DO LOGO):

1. **Quando `logoSize` é especificado pelo usuário**: remover/sobrescrever a regra genérica de escala e substituir por uma instrução enfática e única baseada no tamanho escolhido:
   - `small`: "O logo deve ser DISCRETO e PEQUENO, ocupando no máximo 3-5% da área total"
   - `normal`: "O logo deve ter tamanho MODERADO, ocupando ~6-8% da área total"
   - `large`: "O logo deve ser BEM VISÍVEL e PROEMINENTE, ocupando ~12-18% da área total"

2. **Priorizar a instrução de tamanho** sobre a regra de "copiar o tamanho da referência" — quando `logoSize` está definido, remover o parágrafo que diz para copiar o tamanho da referência.

3. **Reforçar no checklist final** (seção 7): adicionar item "O logo está no tamanho solicitado (small/normal/large)?"

## Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/generate-creative/index.ts` — priorizar logoSize sobre regra de referência |

