
# 4 Ajustes: Criativos, Favoritos, Grid Dinâmico, Dimensões

## AJUSTE 01 — Nova opção "Criativos" no menu lateral

Novo painel que lista todos os criativos do projeto no mesmo grid usado em "Gerar" (thumbnails com slider de tamanho, clique para abrir modal com detalhes).

**Arquivos:**
- `src/components/CreativesPanel.tsx` (novo) — grid de criativos com slider de tamanho, modal de detalhes, download, excluir, filtro por favoritos
- `src/components/RightSidebar.tsx` — adicionar item "Criativos" no `navItems` (com ícone `Image`)
- `src/pages/Index.tsx` — adicionar tipo `'creatives'` ao `RightPanel`, renderizar `CreativesPanel`

## AJUSTE 02 — Favoritos

### Database
- Migration: adicionar coluna `favorite boolean NOT NULL DEFAULT false` na tabela `generated_creatives`
- Adicionar UPDATE RLS policy para usuários aprovados

### Hook
- `src/hooks/useGeneratedCreatives.ts` — adicionar mutation `useToggleFavorite` que faz `UPDATE` no campo `favorite`

### UI — Ícone de estrela em todos os grids
- `src/components/GeneratePanel.tsx` — adicionar estrela no canto superior direito de cada thumbnail (sempre visível, preenchida se favorito)
- `src/components/DynamicGeneratePanel.tsx` — mesmo ícone de estrela nos resultados
- `src/components/CreativesPanel.tsx` — estrela + botão de filtro "Apenas favoritos"

## AJUSTE 03 — Grid de imagens na Geração Dinâmica

Substituir o layout atual de resultados (cards verticais) pelo mesmo grid de thumbnails usado em "Gerar":
- Slider de tamanho (Minimize2/Maximize2)
- Flex wrap com thumbnails
- Clique para abrir modal com imagem + detalhes do briefing (título, copy, proposta visual, objetivo)

**Arquivo:** `src/components/DynamicGeneratePanel.tsx`

## AJUSTE 04 — Seletor de dimensões na Geração Dinâmica

Adicionar o mesmo Select de formato (`9:16`, `4:5`, `1:1`, `16:9`) ao painel de configuração, e enviar o `format` no body da edge function.

**Arquivos:**
- `src/components/DynamicGeneratePanel.tsx` — adicionar Select de formato antes do botão Gerar
- `supabase/functions/generate-dynamic-creative/index.ts` — receber e usar `format` no body

## Resumo de Migrations

1. `ALTER TABLE generated_creatives ADD COLUMN favorite boolean NOT NULL DEFAULT false;`
2. RLS policy de UPDATE para approved users (já existe DELETE para project_access, mas não UPDATE)

## Arquivos totais

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/CreativesPanel.tsx` |
| Editar | `src/components/RightSidebar.tsx` |
| Editar | `src/pages/Index.tsx` |
| Editar | `src/hooks/useGeneratedCreatives.ts` |
| Editar | `src/components/GeneratePanel.tsx` |
| Editar | `src/components/DynamicGeneratePanel.tsx` |
| Editar | `supabase/functions/generate-dynamic-creative/index.ts` |
| Migration | favorite column + UPDATE RLS |
