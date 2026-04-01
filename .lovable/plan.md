

# Corrigir Sidebar: Ícones, Animação de Collapse e Hover dos Menus

## Problemas identificados

1. **Ícone de fechar/abrir invertido** — `PanelRightClose` deveria ser `PanelLeftClose` (seta apontando para a esquerda para recolher); quando colapsado, usar `PanelLeftOpen` (seta apontando para a direita para expandir)
2. **Collapse abrupto** — sidebar some/aparece instantaneamente; deveria animar a largura com transição suave
3. **Colapsado sem filete** — quando colapsado, em vez de botão flutuante, manter um filete fino (~48px) com o ícone de abrir centralizado
4. **Dropdown de projetos sem hover** — os itens do `SelectContent` não têm destaque visual claro ao passar o mouse
5. **Hover dos nav items sem contraste** — substituir `hover:bg-accent` por hover com borda e mudança de cor do texto/ícone

## Mudanças em `src/components/RightSidebar.tsx`

### Ícones
- Importar `PanelLeftClose` e `PanelLeftOpen` no lugar de `PanelRightClose`/`PanelRightOpen`
- Expandido: mostrar `PanelLeftClose` (recolhe para esquerda)
- Colapsado: mostrar `PanelLeftOpen` (expande para direita)

### Animação de collapse
- Remover o `if (collapsed) return <button>...` 
- Usar sempre o mesmo `<aside>` com largura condicional via `transition-all duration-300`:
  - Expandido: `w-[280px]`
  - Colapsado: `w-[48px]` (filete fino)
- Quando colapsado, esconder todo o conteúdo (logo, projetos, nav, user) com `overflow-hidden` e mostrar apenas o ícone de abrir centralizado

### Hover do dropdown de projetos
- Adicionar CSS customizado ao `SelectItem`: `hover:bg-secondary hover:text-foreground` para contraste visível

### Hover dos nav items (quando projeto selecionado)
- Trocar o estilo inativo de `hover:bg-accent hover:text-foreground` para:
  - `hover:border hover:border-primary/50 hover:text-primary` — borda sutil + cor primária no texto/ícone
  - Sem background no hover, apenas borda e cor

## Arquivo a modificar
- **`src/components/RightSidebar.tsx`** — todas as mudanças acima

