# Arquitetura — Criativos Mestre

Visão geral de como a plataforma funciona. Para o histórico de mudanças, veja
[MELHORIAS-2026-09.md](./MELHORIAS-2026-09.md).

## Camadas

```
Navegador (React + Vite + Tailwind/shadcn)
   │  supabase-js  (login, tabelas com RLS, storage, invoke de funções)
   ▼
Supabase (Lovable Cloud)
   ├─ Postgres ........ projetos, brand kits, swipe files, criativos, uso de IA
   ├─ Storage ......... buckets privados (logos, swipe-files, generated-creatives,
   │                    brand-photos, people-photos) — caminho sempre {projectId}/...
   └─ Edge Functions .. toda chamada de IA passa por aqui (Deno)
          │
          ▼
   OpenRouter (texto, visão, imagem) · Firecrawl (lê sites) · Perplexity (pesquisa)
```

O navegador **nunca** fala direto com a IA. Cada Edge Function valida o usuário
(`_shared/auth.ts` → aprovado + acesso ao projeto), monta o prompt, chama o
OpenRouter, salva a imagem no storage e registra no banco.

## Telas e rotas

| Rota | Tela |
|---|---|
| `/` | **Ferramentas** (hub) — cards de cada ferramenta (`src/pages/Home.tsx`, lista em `src/lib/tools.ts`) |
| `/criativos` | Dashboard de criativos (projetos recentes, últimos criativos) |
| `/project/:id/:painel` | Espaço de trabalho do projeto |
| `/admin` | Administração (projetos, usuários, uso, análises, **custos de IA**, formatos, logs, prompts, modelos, permissões) |

Painéis do projeto (`src/pages/Index.tsx`):

| Painel | Esquerda | Direita |
|---|---|---|
| `generate` — Gerar | `GenerationControls` (modos Prompt livre / Modelos / Swipe) | `GeneratePanel` |
| `dynamic` — Dinâmica | `DynamicGeneratePanel` | `DynamicResultsPanel` |
| `unfold` — Desdobramento | `UnfoldPanel` | `UnfoldResultsPanel` |
| `creatives` — Criativos | — | `CreativesPanel` (galeria completa) |
| `brandkit`, `context`, `history` | — | painéis de configuração |

O modal de qualquer criativo inclui `CreativeInsights`: revisão automática,
botão **Redimensionar**, origem, modelo e custo.

## Modelos de IA

`supabase/functions/_shared/openrouter.ts` centraliza tudo. São três "vagas",
cada uma com modelo principal + 2 reservas (cascata), configuráveis em
**Admin → Modelos de IA** (tabela `app_settings`):

| Vaga | Uso |
|---|---|
| `image_generation` | gerar/editar imagens |
| `text_reasoning` | briefings, textos, contexto |
| `vision_analysis` | analisar imagens (swipe, logo, revisão) |

Helpers principais:

- `callOpenRouter` — uma chamada; registra custo em `ai_usage` quando recebe `track`.
- `callOpenRouterWithCascade` — texto/visão com a cascata de modelos.
- `generateImageWithCascade` — laço único de geração de imagem (orçamento de tempo,
  429/402, formato via `image_config.aspect_ratio`). Usado por todas as funções que geram imagem.

## Edge Functions

| Função | O que faz |
|---|---|
| `generate-creative` | Gera criativo (modos swipe / templates / free) com brand kit + contexto do projeto |
| `generate-dynamic-creative` | Aba Dinâmica: IA de texto escreve o briefing → IA de imagem gera |
| `transform-creative` | **Novo.** `resize` (Redimensionar), `unfold` (Desdobramento), `fix` (corrigir após revisão) |
| `review-creative` | **Novo.** Revisão automática por IA de visão |
| `analyze-swipe` | Detecta textos/logos/pessoas de um swipe file |
| `suggest-texts` / `suggest-creatives` | Sugestões de copy e de ideias |
| `extract-context` | Site → contexto + tom de voz (Firecrawl + Perplexity + IA) |
| `extract-design-system` / `extract-branding` | Cores e fontes a partir do site / screenshot |
| `generate-person-grid` | Grade 3×3 da pessoa em vários ângulos |
| `list-openrouter-models` | Catálogo de modelos para o Admin |
| `admin-*`, `invite-user` | Gestão de usuários |

Helpers compartilhados em `supabase/functions/_shared/`:
`auth.ts`, `openrouter.ts`, `http.ts` (CORS/JSON), `storage.ts` (upload, assinatura
de URL, limpeza de PNG), `connectors.ts` (Firecrawl/Perplexity via gateway da Lovable
ou API direta).

## Tabelas principais

| Tabela | Conteúdo |
|---|---|
| `projects` | cliente/projeto, `context`, `voice_guide`, onboarding |
| `brand_kits` | cores, tipografia, logo, fotos, grid da pessoa, cache da análise do logo |
| `swipe_files` | referências + análise |
| `generated_creatives` | cada criativo: imagem, prompt, formato, **`kind`** (generate/dynamic/resize/unfold/fix), **`parent_creative_id`**, **`source_image_url`**, **`model_used`**, **`cost_usd`**, **`briefing`**, **`generation_meta`**, **`review`**, **`review_status`** |
| `ai_usage` | **Novo.** Uma linha por chamada ao OpenRouter (função, modelo, projeto, usuário, tokens, custo, duração) |
| `template_prompts` | prompts editáveis (templates, dinâmica, extração de contexto) |
| `app_settings` | modelos de IA configurados |
| `error_logs` | erros registrados pelo front |

## Segredos necessários (Edge Functions)

| Segredo | Para quê |
|---|---|
| `OPENROUTER_API_KEY` | toda a IA |
| `FIRECRAWL_API_KEY` | extração de contexto/design system |
| `PERPLEXITY_API_KEY` | pesquisa da empresa (opcional) |
| `LOVABLE_API_KEY` | só quando Firecrawl/Perplexity vêm de conectores da Lovable (gateway) |
