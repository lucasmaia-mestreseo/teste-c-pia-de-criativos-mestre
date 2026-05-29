# Migração para OpenRouter

Substitui o Lovable AI Gateway pelo OpenRouter em todas as Edge Functions de IA, e finaliza a tela admin de configuração de modelos (pendente do plano anterior) já apontando para o catálogo do OpenRouter.

## 1. Secret
- Solicitar `OPENROUTER_API_KEY` via `add_secret` antes de qualquer código.
- `LOVABLE_API_KEY` deixa de ser usado pelas funções de IA (mantido apenas se algum connector ainda depender dele).

## 2. Helper compartilhado
Criar `supabase/functions/_shared/openrouter.ts`:
- `callOpenRouterImage({ model, prompt, referenceImages?, signal })` — POST `https://openrouter.ai/api/v1/chat/completions` com `modalities: ["image","text"]`, extrai `b64_json` / `image_url` da resposta.
- `callOpenRouterText({ model, messages, jsonSchema? })` — wrapper para chat/completions (usado por análise/sugestões).
- Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `HTTP-Referer`, `X-Title: "Criativos Mestre"`.
- Retry interno + parsing de 429 (`Retry-After`) preservando o formato de erro estruturado já consumido por `invokeWithRetry.ts`.

## 3. Modelos disponíveis no seletor admin
| ID OpenRouter | Rótulo amigável | Uso |
|---|---|---|
| `openai/gpt-5.4-image-2` | GPT-5.4 Image 2 | Primário (padrão) |
| `google/gemini-3.1-flash-image-preview` | Nano Banana 2 | Secundário (padrão) |
| `x-ai/grok-imagine-image-quality` | Grok Imagine (Quality) | Terciário (padrão) |
| `google/gemini-2.5-flash-image` | Nano Banana 2.5 | Opcional |
| `google/gemini-3-pro-image-preview` | Nano Banana Pro | Opcional |
| `black-forest-labs/flux-1.1-pro` | Flux 1.1 Pro | Opcional |

## 4. Banco — `app_settings`
Migration cria tabela `app_settings (key text PK, value jsonb, updated_at)` com GRANTs + RLS (SELECT autenticado; INSERT/UPDATE owner/admin via `has_any_admin_role`). Seed:
```json
{
  "primary_model": "openai/gpt-5.4-image-2",
  "fallback_model": "google/gemini-3.1-flash-image-preview",
  "tertiary_model": "x-ai/grok-imagine-image-quality",
  "primary_attempts": 2,
  "fallback_attempts": 1,
  "tertiary_attempts": 1
}
```

## 5. Edge Functions migradas
- **Imagens** (`generate-creative`, `generate-dynamic-creative`, `generate-person-grid`): cascata primário → fallback → terciário lendo `app_settings`.
- **Texto/análise** (`analyze-swipe`, `extract-branding`, `extract-context`, `extract-design-system`, `suggest-creatives`, `suggest-texts`): trocar para `openai/gpt-5.4` (raciocínio) e `google/gemini-2.5-flash` (extração rápida) via OpenRouter. Sem UI dedicada — modelos fixos no código por enquanto.

## 6. UI Admin
Nova aba **"Modelos de IA"** em `src/pages/Admin.tsx` (já planejado):
- 3 `<Select>` (primário, fallback, terciário) populados com a tabela acima.
- 3 `<Input numeric>` para nº de tentativas por nível (1–5).
- Botão Salvar grava em `app_settings`.
- Visível apenas para `owner`/`admin`.

## 7. Logging
`error_logs` ganha `provider: 'openrouter'` no payload; dashboard exibe o modelo efetivamente usado por tentativa.

## Arquivos
| Ação | Arquivo |
|---|---|
| Criar | `supabase/functions/_shared/openrouter.ts` |
| Migration | tabela `app_settings` + seed + RLS |
| Editar | 3 funções de imagem + 6 de texto |
| Criar | `src/pages/AdminAiModels.tsx` |
| Editar | `src/pages/Admin.tsx` (nova aba) |
| Editar | `src/lib/invokeWithRetry.ts` (campo `provider` no log) |

## Pré-requisito
Aprovar este plano dispara: (1) pedido do secret `OPENROUTER_API_KEY`, (2) migration, (3) implementação.
