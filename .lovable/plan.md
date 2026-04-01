

# Ajustes 01, 02 e 03

## AJUSTE 01 — Opções para ignorar Brand Kit e Contexto

### Frontend

**`src/components/GeneratePanel.tsx`:**
- Adicionar dois estados: `ignoreBrandKit` e `ignoreContext` (default `false`)
- Renderizar dois checkboxes na área de controles (perto do formato): "Ignorar Brand Kit" e "Ignorar Contexto"
- No `handleGenerate`: se `ignoreBrandKit`, enviar `brandKit: null` no body; se `ignoreContext`, adicionar `ignoreContext: true` no body

**`src/components/DynamicGeneratePanel.tsx`:**
- Mesmo padrão: dois estados + dois checkboxes antes do botão de gerar
- Enviar `ignoreBrandKit: true` e `ignoreContext: true` no body quando marcados

### Edge Functions

**`supabase/functions/generate-creative/index.ts`:**
- Ler `ignoreContext` do body. Se `true`, não incluir `project.context` e `project.voice_guide` no prompt de geração
- O brandKit já é controlado pelo frontend (envia `null`)

**`supabase/functions/generate-dynamic-creative/index.ts`:**
- Ler `ignoreBrandKit` e `ignoreContext` do body
- Se `ignoreBrandKit`: setar `brandInfo` como string vazia e não usar cores do brandKit no image prompt
- Se `ignoreContext`: não incluir context e voice_guide no prompt do briefing

## AJUSTE 02 — Tamanho dos thumbnails

Três arquivos com sliders de thumb size:

| Arquivo | Default atual | Max atual | Novo default | Novo max |
|---------|--------------|-----------|-------------|---------|
| `GeneratePanel.tsx` | 80 | 160 | 160 | 640 |
| `DynamicResultsPanel.tsx` | 100 | 200 | 200 | 800 |
| `CreativesPanel.tsx` | 100 | 200 | 200 | 800 |

- Alterar o valor default no `useState` (manter leitura do localStorage para valores já salvos)
- Alterar o `max` do `<Slider>`

## AJUSTE 03 — Projetos em ordem alfabética

**`src/components/RightSidebar.tsx` (linha 110):**
- Adicionar `.sort((a, b) => a.name.localeCompare(b.name))` antes do `.map()`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/GeneratePanel.tsx` — checkboxes + lógica |
| Editar | `src/components/DynamicGeneratePanel.tsx` — checkboxes + envio |
| Editar | `supabase/functions/generate-creative/index.ts` — respeitar ignoreContext |
| Editar | `supabase/functions/generate-dynamic-creative/index.ts` — respeitar flags |
| Editar | `src/components/DynamicResultsPanel.tsx` — default e max do slider |
| Editar | `src/components/CreativesPanel.tsx` — default e max do slider |
| Editar | `src/components/RightSidebar.tsx` — sort alfabético |

