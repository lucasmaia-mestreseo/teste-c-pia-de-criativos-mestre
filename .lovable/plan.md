

# Plano: 6 Ajustes no Sistema

## AJUSTE 01 — Modo padrão "Prompt Livre"
**Mudança simples**: Em `src/pages/Index.tsx`, alterar o estado inicial de `creationMode` de `'swipe'` para `'free'`.

**Arquivo**: `src/pages/Index.tsx`

---

## AJUSTE 02 — Convites para usuários na área administrativa

Criar uma funcionalidade de convite por email dentro da aba "Usuários" do painel admin.

### Database
- Nova tabela `user_invitations` com colunas: `id`, `email`, `invited_by`, `created_at`, `accepted_at`
- RLS: owner/admin podem INSERT e SELECT

### Edge Function
- `invite-user`: recebe email, valida domínio `@agenciamestre.com`, cria o usuário via Admin API (`supabase.auth.admin.createUser`) com senha temporária e envia email com instruções (ou gera link de magic link). Alternativa mais simples: criar o convite na tabela e enviar email via Lovable Email ou apenas pré-aprovar o perfil quando o usuário se cadastrar.

### Abordagem escolhida
- Na aba "Usuários" do Admin, adicionar campo "Convidar email" + botão
- Edge Function `invite-user` que:
  1. Valida domínio `@agenciamestre.com`
  2. Chama `supabase.auth.admin.inviteUserByEmail(email)` para enviar convite
  3. Cria perfil pré-aprovado com role `analyst`
- UI mostra convites pendentes (não aceitos ainda)

**Arquivos**:
- `supabase/functions/invite-user/index.ts` (nova edge function)
- `src/pages/Admin.tsx` (adicionar seção de convite na UsersTab)
- Migration: tabela `user_invitations`

---

## AJUSTE 03 — Brand Kit: Extrair Design System via Firecrawl (screenshot)

Substituir a extração de branding atual por um fluxo que:
1. Usa Firecrawl para capturar screenshot da URL
2. Armazena o screenshot no storage
3. Mostra o screenshot na UI com opção de apagar e refazer
4. Usa o screenshot capturado como input para a IA extrair o Design System (cores, tipografia, espaçamento, componentes)

### Pré-requisito
- Conectar o Firecrawl via connector (`standard_connectors--connect`)

### Edge Function
- Criar `extract-design-system/index.ts`:
  1. Recebe URL
  2. Chama Firecrawl scrape com `formats: ['screenshot', 'branding']`
  3. Salva screenshot no bucket `brand-photos`
  4. Usa Lovable AI para analisar o screenshot e extrair design system completo
  5. Retorna screenshot URL + dados do design system

### Database
- Adicionar coluna `design_screenshot_url` à tabela `brand_kits` (migration)

### UI
- Em `BrandKitPanel.tsx`: trocar label "Extrair branding" para "Extrair Design System"
- Mostrar screenshot salvo com botão de apagar/refazer
- Ao extrair, mostrar screenshot + preencher cores/tipografia

**Arquivos**:
- `supabase/functions/extract-design-system/index.ts` (nova)
- `src/components/BrandKitPanel.tsx` (editar)
- Migration: adicionar `design_screenshot_url` em `brand_kits`

---

## AJUSTE 04 — Contexto a partir de URL (Firecrawl + Perplexity)

Adicionar no ContextPanel um botão "Extrair contexto de URL" que:
1. Usa Firecrawl para baixar o conteúdo da URL (markdown)
2. Usa Perplexity para pesquisar detalhes sobre a empresa (produtos, serviços, posicionamento)
3. Usa Lovable AI com um prompt configurável (admin) para gerar o contexto do projeto a partir dos dados coletados

### Pré-requisito
- Conectar Perplexity via connector

### Edge Function
- `extract-context/index.ts`:
  1. Recebe URL e projectId
  2. Chama Firecrawl scrape (markdown)
  3. Chama Perplexity search com query sobre a empresa
  4. Busca prompt de contexto da tabela `template_prompts` (id = `context-extraction`)
  5. Envia tudo para Lovable AI com o prompt configurável
  6. Retorna contexto gerado + guia de voz (AJUSTE 06)

### Database
- Inserir novo registro em `template_prompts` com id `context-extraction` e o prompt padrão para geração de contexto
- Inserir novo registro com id `voice-analysis` para o prompt do tom de voz (AJUSTE 06)

### Admin
- Na aba Prompts, esses novos prompts (`context-extraction`, `voice-analysis`) aparecerão automaticamente para edição pelo Owner

### UI
- Em `ContextPanel.tsx`: adicionar input de URL + botão "Extrair de URL"
- Mostrar loading enquanto processa

**Arquivos**:
- `supabase/functions/extract-context/index.ts` (nova)
- `src/components/ContextPanel.tsx` (editar)
- Migration: inserir prompts padrão
- `src/pages/Admin.tsx` (adicionar labels para novos prompts)

---

## AJUSTE 05 — Geração Dinâmica (novo painel)

Nova opção no menu lateral: "Geração Dinâmica" com 3 tipos de criativos.

### Fluxo
1. Usuário seleciona quais tipos quer (1+ de 3): conservadores, inovadores, fora da caixa
2. Define quantidade de cada (1-5)
3. Clica "Gerar"
4. Edge function primeiro gera briefing para cada criativo (título, copy, proposta de imagem, objetivo estratégico)
5. Depois gera a imagem com prompt alinhado ao briefing
6. Resultados aparecem na área de geração

### Database
- Inserir 3 registros em `template_prompts`:
  - `dynamic-conservative`: prompt para criativos conservadores
  - `dynamic-innovative`: prompt para criativos inovadores
  - `dynamic-radical`: prompt para criativos fora da caixa

### Edge Function
- `generate-dynamic-creative/index.ts`:
  1. Recebe projectId, tipo(s), quantidade(s)
  2. Busca contexto do projeto, brand kit
  3. Busca prompt do tipo na `template_prompts`
  4. Para cada criativo: gera briefing (título, copy, proposta de imagem, objetivo) via Lovable AI
  5. Monta prompt de imagem baseado no briefing
  6. Gera imagem via Lovable AI (modelo de imagem)
  7. Salva em `generated_creatives`
  8. Retorna resultados

### UI
- `src/components/DynamicGeneratePanel.tsx` (novo):
  - Checkboxes para os 3 tipos
  - Slider/input para quantidade de cada (1-5)
  - Botão "Gerar"
  - Grid de resultados com briefing + imagem
- Menu lateral: adicionar item "Geração Dinâmica" (`dynamic` panel)
- `src/components/RightSidebar.tsx`: adicionar nav item
- `src/pages/Index.tsx`: adicionar renderização do novo painel

**Arquivos**:
- `supabase/functions/generate-dynamic-creative/index.ts` (nova)
- `src/components/DynamicGeneratePanel.tsx` (novo)
- `src/components/RightSidebar.tsx` (editar)
- `src/pages/Index.tsx` (editar)
- Migration: inserir prompts dinâmicos
- `src/pages/Admin.tsx` (labels para novos prompts)

---

## AJUSTE 06 — Tom de Voz (integrado com AJUSTE 04)

O tom de voz será extraído junto com o contexto na edge function `extract-context`.

### Database
- Adicionar coluna `voice_guide` na tabela `projects` (migration)

### Edge Function
- Na `extract-context`, após gerar o contexto, executar uma segunda chamada com o prompt do tom de voz (id `voice-analysis`) usando o conteúdo da URL
- Retornar tanto o contexto quanto o guia de voz

### UI
- Em `ContextPanel.tsx`: mostrar campo editável "Tom de Voz / Guia de Voz" abaixo do contexto
- Auto-save junto com o contexto

**Arquivos**:
- Migration: adicionar `voice_guide` em `projects`
- `src/components/ContextPanel.tsx` (editar)
- `supabase/functions/extract-context/index.ts` (já incluído no AJUSTE 04)

---

## Resumo de Migrations

1. Tabela `user_invitations` (AJUSTE 02)
2. Coluna `design_screenshot_url` em `brand_kits` (AJUSTE 03)
3. Coluna `voice_guide` em `projects` (AJUSTE 06)
4. Inserir prompts padrão em `template_prompts`: `context-extraction`, `voice-analysis`, `dynamic-conservative`, `dynamic-innovative`, `dynamic-radical` (AJUSTES 04, 05, 06)

## Pré-requisitos de Connectors

Antes de implementar, preciso conectar:
- **Firecrawl** (AJUSTES 03 e 04)
- **Perplexity** (AJUSTE 04)

## Arquivos totais

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/Index.tsx` |
| Editar | `src/components/RightSidebar.tsx` |
| Editar | `src/components/BrandKitPanel.tsx` |
| Editar | `src/components/ContextPanel.tsx` |
| Editar | `src/pages/Admin.tsx` |
| Criar | `src/components/DynamicGeneratePanel.tsx` |
| Criar | `supabase/functions/invite-user/index.ts` |
| Criar | `supabase/functions/extract-design-system/index.ts` |
| Criar | `supabase/functions/extract-context/index.ts` |
| Criar | `supabase/functions/generate-dynamic-creative/index.ts` |
| Migration | 4 migrations (tabela, colunas, inserts) |

