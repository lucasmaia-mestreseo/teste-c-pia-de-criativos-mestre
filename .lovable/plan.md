## Melhorar visual do modal de detalhes do criativo

Arquivo: `src/components/GeneratePanel.tsx` (modal `Dialog` do preview).

### Mudanças

1. **Setas sobrepostas à imagem**
   - Remover os botões `ChevronLeft`/`ChevronRight` do flex row lateral.
   - Envolver a `<img>` em um container `relative` e posicionar as setas com `absolute left-2` e `absolute right-2`, `top-1/2 -translate-y-1/2`.
   - Estilo: fundo semi-transparente (`bg-background/60 hover:bg-background/80 backdrop-blur-sm`), arredondado, sombra sutil — só aparecem sobre a imagem, liberando o espaço horizontal.

2. **Respiro e espaçamentos do DialogContent**
   - Aumentar padding do `DialogContent` (de `p-3` para `p-6`) e usar `gap-6` entre imagem e coluna de ações.
   - Limitar largura total (`max-w-5xl`) para não colar nas bordas em telas grandes.
   - Coluna de ações: `min-w-[200px]`, `pt-0` (remover `pt-8`), alinhar ao topo com `self-start` e adicionar `pr-1` para respirar da borda direita.
   - Adicionar `pl-1` ou espaçamento uniforme para não colar botões na borda do modal.

3. **Ajustes menores de polimento**
   - Aumentar levemente o tamanho dos botões (mantendo `size="sm"`) e usar `gap-2` na coluna.
   - Colocar o contador `x / y` acima do prompt com `text-muted-foreground text-xs`.
   - Garantir que o `x` de fechar do Dialog não colida com o novo padding.

### Fora de escopo
- Nenhuma mudança em lógica, permissões, download, favoritar, navegação por teclado ou dados.
