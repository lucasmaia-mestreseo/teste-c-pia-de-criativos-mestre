

# Ajustes visuais no painel de geração

## Problemas identificados

1. **Espaço entre "Sugerir Criativos" e "Configurações Avançadas"**: O `FreePromptPanel` usa `flex-1` no container de conteúdo, fazendo o espaço expandir. O conteúdo precisa fluir naturalmente sem forçar expansão.

2. **Estilo dos botões inconsistente**: Os toggle pills (Logo, Pessoa, Brand Kit, Contexto) usam `rounded-full` e bordas finas, enquanto os botões principais (Sugerir, Gerar) usam `rounded-md` com estilo `outline`/`default`. Precisa unificar — os toggles devem usar `rounded-md` com o mesmo estilo visual.

3. **Logo muito pequeno**: Atualmente `h-6 w-6` — aumentar para `h-10 w-10`.

4. **Layout caótico nas opções de pessoa**: Fotos, radio Foto/Grid e grid de posição ficam misturados. Reorganizar com separação clara: primeiro o toggle + fotos em linha, depois Foto/Grid, depois o grid de posição — com espaçamento uniforme.

## Alterações

### `src/components/FreePromptPanel.tsx`
- Remover `flex flex-col h-full` e `flex-1` do container — usar apenas `div` com overflow, sem forçar altura
- O conteúdo flui naturalmente e "Configurações Avançadas" fica colado logo abaixo

### `src/components/GenerationControls.tsx`
- **TogglePill**: trocar `rounded-full` por `rounded-md` e ajustar padding/borda para coincidir com o estilo dos outros botões (`border` consistente)
- **Logo preview**: de `h-6 w-6` para `h-10 w-10`
- **Seção Logo expandida**: manter `flex items-start gap-6` mas com labels mais claros
- **Seção Pessoa expandida**: reorganizar em blocos verticais separados:
  1. Toggle + thumbnails de fotos (em grid wrap, não inline caótico)
  2. Radio Foto/Grid (se disponível)
  3. Grid de posição
- **Brand Kit / Contexto**: mesmos ajustes de estilo no TogglePill
- Remover `border-t` do CollapsibleTrigger para eliminar a linha separadora que cria distância visual

### `src/components/PositionGrid.tsx`
- Sem alterações (já está em w-7 h-7)

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/FreePromptPanel.tsx` — remover flex-1/h-full para colar conteúdo |
| Editar | `src/components/GenerationControls.tsx` — unificar estilo botões, logo maior, layout pessoa |

