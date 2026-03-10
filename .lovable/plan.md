

# Ajustes na galeria e modal

## Problemas identificados

1. **Galeria**: o `border-b` na div container (linha 104) cria a linha horizontal visível. Além disso, a galeria está limitada a `max-h-[40vh]` e separada do prompt por um `border-t`. O usuário quer que a galeria ocupe todo o espaço disponível até o prompt, sem divisórias visuais.

2. **Modal**: o botão X de fechar (do DialogContent) sobrepõe o botão Download porque ambos ficam no canto superior direito. Preciso adicionar `pt-8` ao painel de botões para descer os botões abaixo do X.

## Mudanças em `src/components/GeneratePanel.tsx`

### Galeria ocupa todo o espaço
- Remover `border-b` do container da galeria
- Remover `max-h-[40vh]` — trocar por `flex-1 overflow-y-auto min-h-0`
- Remover o `<div className="flex-1" />` (spacer) — a galeria já será o elemento flex que cresce
- Remover `border-t` do bloco do prompt (manter apenas separação natural)
- Estrutura: galeria com `flex-1 min-h-0 overflow-y-auto` + prompt fixo embaixo

### Modal — botão fechar não sobrepõe Download
- Adicionar `pt-8` no painel lateral de botões para que fiquem abaixo do X

## Arquivo
- `src/components/GeneratePanel.tsx`

