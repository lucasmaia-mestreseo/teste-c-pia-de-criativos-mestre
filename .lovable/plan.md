

# Grid Multi-Ângulo + Seleção Foto vs Grid na Geração

## Conceito
Adicionar no Brand Kit a capacidade de gerar um "grid multi-ângulo" (3x3, 9 ângulos cinematográficos) a partir das fotos de pessoas já cadastradas. O grid gerado é salvo no banco e pode ser selecionado na hora de gerar criativos como alternativa à foto individual.

## Mudanças

### 1. Migração: coluna `person_grid_url` em `brand_kits`
```sql
ALTER TABLE public.brand_kits ADD COLUMN person_grid_url text;
```
Armazena a URL do grid gerado.

### 2. Nova edge function: `supabase/functions/generate-person-grid/index.ts`
- Recebe: `photos` (array de URLs das fotos de pessoas)
- Usa Lovable AI (`google/gemini-3.1-flash-image-preview` — Nano Banana 2, geração de imagem)
- Prompt baseado no JSON fornecido: analisa a foto principal, infere corpo/roupa, gera grid 3x3 com os 9 ângulos (MCU, MS, OS, WS, HA, LA, P, ThreeQ, B) com labels
- Faz upload do resultado no bucket `people-photos` e retorna a URL pública
- `verify_jwt = false` no config.toml

### 3. BrandKitPanel: botão "Gerar Grid" na seção Fotos de Pessoas
- Botão com ícone `Grid3x3` abaixo das fotos de pessoas
- Desabilitado se não houver fotos de pessoas
- Loading state durante geração
- Ao concluir, exibe o grid gerado com opção de remover
- Salva `person_grid_url` junto com o save do Brand Kit

### 4. GeneratePanel: opção "Foto" vs "Grid" na seleção de pessoa
- Quando `brand_kits.person_grid_url` existe, mostrar um toggle/radio inline:
  - `Foto` — comportamento atual (envia foto individual)
  - `Grid` — envia o grid URL como `personGridUrl` no body
- O campo `personGridUrl` é passado à edge function `generate-creative`

### 5. Edge function `generate-creative`: suporte a `personGridUrl`
- Aceitar novo campo `brandKit.personGridUrl`
- Quando presente, incluir no prompt instruções para usar o grid como referência de consistência facial/corporal em múltiplos ângulos, em vez de uma foto única

### 6. Hook `useBrandKit`: incluir `person_grid_url` no upsert

## Arquivos modificados
- **Criar:** `supabase/functions/generate-person-grid/index.ts`
- **Modificar:** `src/components/BrandKitPanel.tsx` (botão gerar grid + exibir grid)
- **Modificar:** `src/components/GeneratePanel.tsx` (toggle foto vs grid)
- **Modificar:** `src/hooks/useBrandKit.ts` (campo person_grid_url)
- **Modificar:** `supabase/functions/generate-creative/index.ts` (suporte a personGridUrl)
- **Modificar:** `supabase/config.toml` (nova function)
- **Migração:** adicionar coluna `person_grid_url`

