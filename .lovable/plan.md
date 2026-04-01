

# 7 Ajustes: Zoom, Hover, Confirmação, Dimensões, Admin, Criativos Dinâmicos

## AJUSTE 01 — Persistir zoom do grid

Salvar `thumbSize` no `localStorage` por painel (generate, dynamic, creatives). Ao montar, ler o valor salvo.

**Arquivos:** `GeneratePanel.tsx`, `DynamicGeneratePanel.tsx`, `CreativesPanel.tsx`
- Trocar `useState(80)` por `useState(() => Number(localStorage.getItem('thumbSize-generate')) || 80)`
- No `onValueChange` do Slider, gravar `localStorage.setItem('thumbSize-generate', v)`

## AJUSTE 02 — Hover com 4 ações visíveis

Substituir o overlay atual (que esconde a estrela) por 4 botoes sempre visíveis no hover, sem cobrir a imagem inteira:
- **Expandir** (Eye/Maximize2) — abre o modal de detalhes
- **Favoritar** (Star) — toggle favorito
- **Download** (Download)
- **Deletar** (Trash2)

Posicionar como barra no bottom do thumbnail com fundo semi-transparente. Remover o overlay full-cover atual.

**Arquivos:** `GeneratePanel.tsx`, `DynamicGeneratePanel.tsx`, `CreativesPanel.tsx` — mesma refatoracao nos 3 grids.

## AJUSTE 03 — Confirmacao de exclusao

Adicionar `AlertDialog` antes de deletar em todos os grids e modais. Ao clicar Trash2, abrir confirmacao "Tem certeza que deseja excluir este criativo?" com botoes Cancelar/Excluir.

**Arquivos:** `GeneratePanel.tsx`, `DynamicGeneratePanel.tsx`, `CreativesPanel.tsx` — estado `deleteTarget: string | null`, AlertDialog condicional.

## AJUSTE 04 — Seletor de dimensoes na Geracao Dinamica

O Select de formato ja existe no DynamicGeneratePanel (linha 274-279). O problema pode ser visual — verificar se esta renderizando. Se o usuario nao ve, pode ser que o layout esconda. Confirmar que `format` e enviado no body (ja esta na linha 83).

Sem mudanca necessaria se ja funciona. Se nao aparece visualmente, ajustar layout.

## AJUSTE 05 — Admin: gerenciar dimensoes disponiveis

Criar tabela `creative_formats` com colunas `id`, `label` (ex: "9:16"), `active` (boolean).

No Admin, nova secao para CRUD de formatos. Nos paineis de geracao, buscar formatos da tabela em vez de usar constante hardcoded.

**Arquivos:**
- Migration: criar tabela `creative_formats`, inserir defaults, RLS
- `Admin.tsx` — nova secao "Formatos" com lista editavel
- `GeneratePanel.tsx`, `DynamicGeneratePanel.tsx` — hook `useCreativeFormats()` em vez de `FORMATS` constante
- Novo hook: `src/hooks/useCreativeFormats.ts`

## AJUSTE 06 — Criativos dinamicos nao aparecem em "Criativos"

O `CreativesPanel` usa `useGeneratedCreatives(projectId)` que busca todos os criativos do projeto. Os criativos dinamicos estao sendo salvos com o mesmo `project_id`. O problema provavelmente e que a edge function `generate-dynamic-creative` nao esta salvando na tabela corretamente ou o `projectId` enviado esta errado.

Verificar a edge function — se salva com `project_id` correto. Provavelmente funciona e o bug e outro. O `CreativesPanel` ja mostra todos sem filtro, entao deveria mostrar dinamicos tambem.

Acao: investigar e corrigir a edge function se necessario.

## AJUSTE 07 — Coluna de resultados na Geracao Dinamica

Mudar o layout do `DynamicGeneratePanel` para ter duas colunas: esquerda com config/controles, direita com grid de resultados (igual ao GeneratePanel).

Atualizar `Index.tsx` para renderizar o DynamicGeneratePanel em layout de duas colunas quando `activePanel === 'dynamic'`.

**Arquivos:**
- `Index.tsx` — quando `activePanel === 'dynamic'`, renderizar coluna esquerda com controles e coluna direita com grid
- `DynamicGeneratePanel.tsx` — separar em dois componentes ou aceitar prop para modo split

---

## Resumo de Migrations

1. `CREATE TABLE creative_formats (id uuid PK, label text NOT NULL UNIQUE, active boolean DEFAULT true, sort_order int DEFAULT 0);` + RLS + seed com 9:16, 4:5, 1:1, 16:9

## Arquivos totais

| Acao | Arquivo |
|------|---------|
| Criar | `src/hooks/useCreativeFormats.ts` |
| Migration | tabela creative_formats + seed |
| Editar | `src/components/GeneratePanel.tsx` |
| Editar | `src/components/DynamicGeneratePanel.tsx` |
| Editar | `src/components/CreativesPanel.tsx` |
| Editar | `src/pages/Index.tsx` |
| Editar | `src/pages/Admin.tsx` |
| Possivelmente | `supabase/functions/generate-dynamic-creative/index.ts` |

