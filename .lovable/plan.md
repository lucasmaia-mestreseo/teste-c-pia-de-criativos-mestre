

# Ajustes de layout no GeneratePanel

## Mudanças

### 1. Swipe file ao lado do prompt (não acima)
- Mover a imagem de referência para dentro da área do prompt, à esquerda do textarea
- Layout flex horizontal: thumbnail pequeno (48px) + textarea ao lado
- Remover o texto "Base: {nome}"

### 2. Modal proporcional com botões à direita
- Trocar layout do modal de vertical (imagem em cima, botões embaixo) para horizontal (imagem à esquerda, painel de ações à direita)
- Limitar altura da imagem com `max-h-[80vh]` e `object-contain` para nunca ultrapassar a tela
- Botões de download/excluir empilhados verticalmente à direita
- Prompt exibido abaixo dos botões no painel lateral

### Arquivo modificado
- `src/components/GeneratePanel.tsx`

