

# Ajustar Estilo de Hover no Menu Superior

## Comportamento atual
- **Hover**: fundo cinza (`hover:bg-accent`), texto branco (`hover:text-foreground`)
- **Ativo**: fundo amarelo (`bg-primary`), texto preto (`text-primary-foreground`)

## Comportamento desejado
- **Hover**: borda amarela, texto amarelo, fundo preto (sem fundo extra)
- **Ativo**: fundo amarelo, texto preto (mantém como está)

## Solução
Na linha 207 de `src/components/TopBar.tsx`, trocar:

```tsx
'text-muted-foreground hover:bg-accent hover:text-foreground'
```

Por:

```tsx
'text-muted-foreground hover:text-primary hover:border-primary border border-transparent'
```

Isso adiciona:
- `border border-transparent` — borda transparente por padrão (para não quebrar o layout quando a borda amarela aparecer)
- `hover:border-primary` — borda amarela no hover
- `hover:text-primary` — texto amarelo no hover
- Remove `hover:bg-accent` — mantém o fundo preto

## Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/TopBar.tsx` linha 207 — ajustar classes de hover |

