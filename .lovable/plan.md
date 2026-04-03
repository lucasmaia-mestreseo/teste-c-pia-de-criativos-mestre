
# Reestruturação do Painel de Geração

## Resumo

Mover todos os controles de geração (prompt, opções, logo, pessoa, brand kit, contexto, formato, botão gerar) para a **coluna esquerda**, junto dos modos de criação. O `GeneratePanel` (coluna direita) passa a ser apenas a galeria de resultados. A coluna esquerda ganha uma seção de "Configurações Avançadas" e o botão de gerar fixo no rodapé.

## Estrutura da coluna esquerda

```text
┌─────────────────────────────┐
│ [Prompt Livre] [Modelos] [Swipe File]  ← tabs existentes
├─────────────────────────────┤
│ Conteúdo do modo ativo      │
│ (prompt, campos, swipe...)  │
│                             │
│ ─── Configurações Avançadas │
│ □ Logo  [grid 3x3] [P/N/G] │
│ □ Pessoa [grid 3x3]        │
│ ☑ Usar Brand Kit            │
│ ☑ Usar Contexto             │
│                             │
│ Formato: [9:16][4:5][1:1].. │ ← botões em vez de dropdown
├─────────────────────────────┤
│ [████ Gerar Criativo ████]  │ ← fixo no fundo
└─────────────────────────────┘
```

## Detalhes técnicos

### 1. Novo componente `GenerationControls.tsx`

Componente que agrupa tudo da coluna esquerda:
- Recebe os 3 modos via `CreationModeSelector`
- Renderiza `FreePromptPanel`, `TemplatesPanel` ou `SwipeFilePanel` conforme o modo
- Seção colapsável "Configurações Avançadas" com:
  - **Logo**: checkbox + grid 3x3 de posição (9 botões visuais) + 3 botões de tamanho (Pequeno, Normal, Grande)
  - **Pessoa**: checkbox + grid 3x3 de posição (9 botões visuais)
  - **Brand Kit**: checkbox marcado por padrão (desmarcar = ignorar)
  - **Contexto**: checkbox marcado por padrão (desmarcar = ignorar)
- **Formato**: série de botões toggle (não dropdown) para os formatos disponíveis
- **Botão Gerar**: fixo no bottom com `sticky bottom-0`

### 2. Grid de posição (3x3)

Componente reutilizável `PositionGrid` — 9 botões dispostos em grid 3x3:
- Valores: `top-left`, `top-center`, `top-right`, `center-left`, `center-center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`
- Seleção opcional (nenhum selecionado = aceita o que vier no prompt)
- Visual: botões pequenos com indicador de posição

### 3. Tamanhos do logo

3 botões toggle: Pequeno, Normal, Grande — seleção opcional, nenhum = prompt decide.

### 4. Inversão do Brand Kit / Contexto

Atualmente: "Ignorar Brand Kit" / "Ignorar Contexto" (desmarcados por padrão = usam).
Novo: "Usar Brand Kit" / "Usar Contexto" (marcados por padrão). A lógica de `ignoreBrandKit`/`ignoreContext` se inverte: `ignoreBrandKit = !useBrandKit`.

### 5. `GeneratePanel.tsx` simplificado

Remove: prompt, checkboxes de logo/pessoa/brand kit/contexto, formato, botão gerar.
Mantém: galeria de resultados, modal de imagem, ações (download, favoritar, excluir, referência).
Recebe via props: `generating` (para mostrar skeleton de loading).

### 6. `Index.tsx`

- A coluna esquerda renderiza `GenerationControls` em vez de `CreationModeSelector` + painéis separados
- O estado de geração (`handleGenerate`, `format`, `includeLogo`, etc.) sobe para `Index` ou fica dentro de `GenerationControls`
- `GeneratePanel` recebe apenas `projectId`, `generating`, `onUseAsReference`

### 7. Passagem de logo/pessoa position ao body da geração

Novos campos no body de `generate-creative`:
- `logoPosition`: string | null (ex: `top-left`)
- `logoSize`: string | null (ex: `small`, `normal`, `large`)
- `personPosition`: string | null (ex: `bottom-center`)

O prompt do sistema na edge function incorpora essas instruções apenas se valores fornecidos, mas sempre com a nota: "Se o usuário especificar algo diferente no prompt, prevalece o prompt."

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/GenerationControls.tsx` — painel unificado da coluna esquerda |
| Criar | `src/components/PositionGrid.tsx` — grid 3x3 reutilizável |
| Editar | `src/components/GeneratePanel.tsx` — remover controles, manter galeria |
| Editar | `src/pages/Index.tsx` — usar GenerationControls na coluna esquerda |
| Editar | `supabase/functions/generate-creative/index.ts` — aceitar logoPosition, logoSize, personPosition |
