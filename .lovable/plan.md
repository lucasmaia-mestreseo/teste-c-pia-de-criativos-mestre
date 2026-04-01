

# Mover Sidebar para a Esquerda

## Mudança

Inverter a ordem dos elementos no layout: a sidebar passa a ser o primeiro filho do flex container (esquerda) e o conteúdo principal fica à direita.

## Arquivos

### `src/pages/Index.tsx`
- Mover `<RightSidebar />` para **antes** do `<div>` de conteúdo principal no flex container

### `src/components/RightSidebar.tsx`
- Trocar `border-l` por `border-r` na aside
- No estado colapsado, trocar o botão flutuante de `right-4` para `left-4`
- Renomear internamente se desejado (opcional, não afeta funcionalidade)

