

# Mover sidebar para barra de topo compacta

## Resumo

Substituir a sidebar lateral (`RightSidebar`) por uma barra horizontal fixa no topo da página, liberando espaço horizontal para os painéis de controle e resultados.

## Layout proposto

```text
┌──────────────────────────────────────────────────────────┐
│ ⚡ Criativos Mestre │ [Projeto ▾] │ Gerar │ Dinâmica │  │
│                     │ [+Novo]     │ Criativos │ Brand Kit│
│                     │             │ Contexto │ Histórico│ [Avatar ▾]
└──────────────────────────────────────────────────────────┘
│                    Conteúdo principal                     │
```

A barra terá ~48-56px de altura com tudo em uma linha:
- **Esquerda**: Logo "Criativos Mestre" (clicável → dashboard)
- **Centro-esquerda**: Seletor de projeto (Select compacto) + botão "+" para novo projeto
- **Centro**: Navegação horizontal — 6 botões compactos (ícone + texto curto), estilo tabs/pills
- **Direita**: Avatar do usuário com dropdown (Perfil, Admin, Sair)

## Alterações

### 1. Criar `src/components/TopBar.tsx`

Componente horizontal que recebe as mesmas props do `RightSidebar`:
- Usa `flex items-center` com altura fixa (`h-12` ou `h-14`)
- Seletor de projeto inline (Select compacto, ~180px)
- Nav items como botões horizontais com ícone + label curto
- Labels abreviados para caber: "Gerar", "Dinâmica", "Criativos", "Brand Kit", "Contexto", "Histórico"
- Avatar + dropdown no canto direito
- Dialog de novo projeto mantido

### 2. Editar `src/pages/Index.tsx`

- Trocar layout de `flex` (horizontal com sidebar) para `flex-col` (vertical com topbar)
- Substituir `<RightSidebar>` por `<TopBar>` no topo
- Remover estado `sidebarCollapsed` (não mais necessário)
- Conteúdo principal ocupa `flex-1` abaixo da barra

### 3. Remover `src/components/RightSidebar.tsx`

Arquivo não mais utilizado após a migração.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/TopBar.tsx` |
| Editar | `src/pages/Index.tsx` — layout vertical, usar TopBar |
| Remover | `src/components/RightSidebar.tsx` |

