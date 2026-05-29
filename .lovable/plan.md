## Objetivo

Já migramos a geração de imagens para OpenRouter com cascata configurável. Agora vamos:
1. Padronizar **todas** as chamadas de texto/visão para usar o helper `_shared/openrouter.ts` (eliminando `fetch` manuais espalhados).
2. Tornar os modelos de texto/visão **configuráveis no Admin**, com a mesma lógica de cascata (primário → fallback → terciário + tentativas).

## Funções afetadas

| Função | Uso atual | Categoria proposta |
|---|---|---|
| `analyze-swipe` | gemini-2.5-flash (visão de imagem) | `vision_analysis` |
| `extract-branding` | gemini-3-flash-preview (visão de screenshot) | `vision_analysis` |
| `extract-context` | gemini-3-flash-preview (texto, 2 chamadas) | `text_reasoning` |
| `suggest-creatives` | gemini-3-flash-preview (texto JSON) | `text_reasoning` |
| `suggest-texts` | gemini-3-flash-preview (texto JSON) | `text_reasoning` |
| `generate-dynamic-creative` (briefing) | gemini-3-flash-preview (texto) | `text_reasoning` |

`extract-context` continua usando Perplexity (`sonar`) para crawl — fora do escopo do OpenRouter.

## Modelo de configuração

Duas novas linhas em `app_settings`, no mesmo formato JSONB já usado por `image_generation`:

**`text_reasoning`** (chat, sugestões, briefings) — default:
- primary: `google/gemini-3-flash-preview` (2 tentativas)
- fallback: `openai/gpt-5.4-mini` (1 tentativa)
- tertiary: `anthropic/claude-3.5-haiku` (1 tentativa)

**`vision_analysis`** (análise de imagens) — default:
- primary: `google/gemini-2.5-flash` (2 tentativas)
- fallback: `google/gemini-3-flash-preview` (1 tentativa)
- tertiary: `openai/gpt-5.4-mini` (1 tentativa)

## Mudanças no helper `_shared/openrouter.ts`

- Generalizar `ImageGenSettings` → `ModelSettings` (mesmo shape, sem campo "provider" obrigatório).
- Renomear/adicionar:
  - `loadModelSettings(key: 'image_generation' | 'text_reasoning' | 'vision_analysis')` (substitui `loadImageGenSettings`).
  - `buildModelCascade(settings)` continua igual.
  - Novo wrapper `callOpenRouterWithCascade({ settingsKey, messages, responseFormat?, modalities? })` que:
    - Carrega settings, monta cascata, tenta cada modelo, loga falhas em `error_logs` (já existente), e retorna o primeiro sucesso.
- Manter `extractImageUrl` como está.

## Refactor das funções de texto

Cada uma das 5 funções de texto/visão acima passa de `fetch(openrouter, ...)` direto para:
```ts
const result = await callOpenRouterWithCascade({
  settingsKey: 'text_reasoning', // ou 'vision_analysis'
  messages: [...],
  responseFormat: { type: 'json_object' }, // quando aplicável
});
```
Mantém o restante (parsing, validação Zod onde existe, CORS, etc.) intacto.

## UI Admin — aba "Modelos de IA"

Expandir `src/components/admin/AiModelsTab.tsx` para mostrar **3 cards de configuração** (sub-seções), cada um com a mesma UI atual (modelo + tentativas para primário/fallback/terciário):

1. **Geração de Imagens** (já existe — `image_generation`)
2. **Texto e Raciocínio** (`text_reasoning`) — sugestões, briefings, extrações textuais
3. **Análise de Imagens (Visão)** (`vision_analysis`) — análise de swipes e screenshots

Cada card tem seu próprio botão "Salvar". Catálogo de modelos servirá ambos os usos:
- Lista de modelos de imagem (atual) + lista expandida para texto/visão:
  - Google: `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
  - OpenAI: `gpt-5`, `gpt-5-mini`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5`
  - Anthropic: `claude-3.5-sonnet`, `claude-3.5-haiku`, `claude-sonnet-4`
  - xAI: `grok-2-1212`, `grok-4`
- Campo livre continua disponível para qualquer slug `provider/model`.

## Migração SQL

Insert idempotente das duas novas chaves em `app_settings` (não toca em `image_generation`):
```sql
INSERT INTO app_settings (key, value)
VALUES
  ('text_reasoning', '{"primary_model":"google/gemini-3-flash-preview","fallback_model":"openai/gpt-5.4-mini","tertiary_model":"anthropic/claude-3.5-haiku","primary_attempts":2,"fallback_attempts":1,"tertiary_attempts":1}'),
  ('vision_analysis', '{"primary_model":"google/gemini-2.5-flash","fallback_model":"google/gemini-3-flash-preview","tertiary_model":"openai/gpt-5.4-mini","primary_attempts":2,"fallback_attempts":1,"tertiary_attempts":1}')
ON CONFLICT (key) DO NOTHING;
```

## Arquivos

**Editar:**
- `supabase/functions/_shared/openrouter.ts` — generalizar + novo `callOpenRouterWithCascade`
- `supabase/functions/analyze-swipe/index.ts`
- `supabase/functions/extract-branding/index.ts`
- `supabase/functions/extract-context/index.ts`
- `supabase/functions/suggest-creatives/index.ts`
- `supabase/functions/suggest-texts/index.ts`
- `supabase/functions/generate-dynamic-creative/index.ts` (só a chamada de briefing)
- `supabase/functions/generate-creative/index.ts` e `generate-person-grid/index.ts` — apenas renomeio (`loadImageGenSettings` → `loadModelSettings('image_generation')`)
- `src/components/admin/AiModelsTab.tsx` — três cards

**Criar:**
- Migration adicionando as duas novas linhas em `app_settings`

## Notas

- `LOVABLE_API_KEY` deixa de ser usado em qualquer função — pode ficar como secret órfã (não removo para não quebrar nada externo).
- Comportamento de retry continua via cascata; nenhuma função precisa mais saber de modelo específico.
- Permanece restrito a owner/admin no Admin (igual hoje).
