## Problema

A Edge Function `list-openrouter-models` usa categorias mutuamente exclusivas. Modelos multimodais como `anthropic/claude-opus-4.8` (recebem texto+imagem, geram texto) só caem em "Visão", e somem da aba "Texto". Por isso o sistema mostra 182 em Texto enquanto a OpenRouter mostra 357.

## Solução

Recategorizar por **modalidade de output** (modelo OpenRouter), permitindo que o mesmo modelo apareça em múltiplas abas.

### Mudança em `supabase/functions/list-openrouter-models/index.ts`

Substituir a lógica de classificação por:

- **`image_generation`**: `output_modalities` inclui `image`
- **`vision_analysis`**: `input_modalities` inclui `image` E `output_modalities` inclui `text` (independente de também gerar imagem)
- **`text_reasoning`**: `output_modalities` inclui `text` (sem exigir que o input seja text-only)

Assim `claude-opus-4.8` aparece em Texto e Visão; `gpt-image-2` em Imagens; modelos só de texto continuam só em Texto.

Remover também o filtro `inSet.size > 0 && outSet.size > 0` que estava descartando modelos cujo `architecture` da OpenRouter vinha sem `input_modalities`/`output_modalities` explícitos (alguns modelos novos chegam só com o campo legado `modality`). O fallback para `modality` "text+image->text" já existe — manter e garantir que modelos sem nenhum dado de modalidade sejam tratados como `text->text` ao invés de descartados.

### Sem mudanças

- `ModelCatalogDialog.tsx` continua igual (as abas e filtros do front já funcionam por categoria).
- `AiModelsTab.tsx` continua igual.
- `app_settings.model_catalogs` continua igual — apenas mais modelos vão aparecer nas listas após o próximo "Atualizar OpenRouter".

### Verificação

Após o deploy, abrir o catálogo, clicar em "Atualizar OpenRouter" e confirmar:
1. Aba Texto mostra contagem próxima a 357
2. `anthropic/claude-opus-4.8` aparece em Texto e em Visão
3. Modelos já marcados continuam marcados (o estado salvo é por slug, não muda)
