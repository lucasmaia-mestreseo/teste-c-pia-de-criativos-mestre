

# Reposicionar Setas de Navegação para Fora da Imagem

## Problema
No DashboardPanel e HistoryPanel, as setas usam `position: absolute` com `-left-10` / `-right-10`, fazendo com que fiquem em cima da imagem. Nos outros painéis (CreativesPanel, GeneratePanel, DynamicResultsPanel), as setas são itens flex ao lado da imagem — fora da área visual.

## Solução
Padronizar todos os 5 painéis para usar o layout flex onde as setas ficam **ao lado** do modal, não sobrepostas à imagem:

```text
[ < ]  [ imagem ]  [ > ]  [ painel lateral ]
```

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/DashboardPanel.tsx` — trocar layout absolute por flex siblings |
| Editar | `src/components/HistoryPanel.tsx` — trocar layout absolute por flex siblings |

As setas passam de `absolute -left-10` para `flex-shrink-0 p-2 rounded-full hover:bg-secondary`, como já funciona nos outros painéis.

