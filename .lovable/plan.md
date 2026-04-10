

# Seletor de Projetos: Fonte Menor + Busca com Filtro

## Problema
O dropdown de projetos usa `Select` do Radix, que não suporta campo de busca nativo. Com muitos projetos, fica difícil encontrar o desejado.

## Solução
Substituir o `Select` por um **Popover + Command** (combobox com busca), que já existe no projeto via shadcn/ui. Isso permite:

1. **Campo de busca** no topo do dropdown que filtra projetos em tempo real
2. **Fonte menor** nos itens (`text-[11px]`) para caber mais projetos na lista
3. Manter o mesmo visual compacto do trigger atual

### Componente resultante
```text
[ Projeto selecionado ▼ ]
┌─────────────────────┐
│ 🔍 Buscar projeto   │
├─────────────────────┤
│ Agência Mestre      │
│ Focosmais Contab... │
│ ForLife Imóveis     │
│ ...                 │
└─────────────────────┘
```

## Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/TopBar.tsx` — substituir `Select` por `Popover` + `Command` com input de busca e itens com fonte menor |

