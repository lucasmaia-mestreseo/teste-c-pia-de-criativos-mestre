

# Padronizar hover nos menus e corrigir legibilidade do usuário

## Problema 1 — Admin sidebar com hover diferente

O menu lateral principal (`RightSidebar.tsx`) usa o padrão:
- Ativo: `bg-primary text-primary-foreground`
- Hover: `border border-primary/50 text-primary` (linha fina + texto colorido)

Já o Admin (`Admin.tsx` linha 123-128) usa:
- Ativo: `bg-primary/10 text-primary`
- Hover: `hover:bg-accent hover:text-foreground` (fundo sólido, sem borda)

**Correção:** Alterar o Admin para usar o mesmo padrão de borda fina + texto primary no hover.

**Arquivo:** `src/pages/Admin.tsx` (linhas 123-128)
- Adicionar `border border-transparent` no base
- Ativo: `bg-primary text-primary-foreground` (igual ao sidebar principal)
- Hover: `hover:border-primary/50 hover:text-primary` (remover `hover:bg-accent hover:text-foreground`)

## Problema 2 — Nome do usuário ilegível no hover

O botão do usuário (`RightSidebar.tsx` linha 185) usa `hover:bg-accent`. Como `accent` é a cor amarela (primary), o texto branco fica ilegível sobre fundo amarelo.

**Correção:** Trocar para `hover:bg-secondary` (cinza escuro) que mantém contraste com o texto claro.

**Arquivo:** `src/components/RightSidebar.tsx` (linha 185)
- Mudar `hover:bg-accent` → `hover:bg-secondary`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Admin.tsx` (linhas 123-128) |
| Editar | `src/components/RightSidebar.tsx` (linha 185) |

