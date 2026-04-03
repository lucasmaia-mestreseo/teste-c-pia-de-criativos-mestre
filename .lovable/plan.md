

# Separar Prompts de Estilo e Comandos Internos

## Problema

Os prompts "Extração de Contexto (URL)" e "Análise de Tom de Voz" são comandos internos do sistema e não deveriam ter o campo "Prompt de Estilo Visual" — apenas o prompt principal. Atualmente todos os prompts mostram ambos os campos.

## Solução

### Classificação dos prompts

**Prompts de Estilo** (7 estilos + 3 dinâmicos — mostram Composição + Estilo Visual + Imagem base):
- hero, problem-solution, main-benefit, list-ad, authority, demonstration, direct-offer
- dynamic-conservative, dynamic-innovative, dynamic-radical

**Comandos Internos** (mostram apenas o prompt principal, sem Estilo Visual nem Imagem base):
- context-extraction, voice-analysis

### UI — Botões de alternância

Adicionar dois botões no topo da `PromptsTab`: **"Prompts de Estilo"** e **"Comandos Internos"**. Usar toggle buttons (estilo pill/outline) para alternar entre as duas visualizações. Por padrão, mostrar "Prompts de Estilo".

### Lógica de exibição

- Criar constante `INTERNAL_PROMPT_IDS = ['context-extraction', 'voice-analysis']`
- Filtrar `prompts` com base na categoria selecionada
- Para comandos internos: mostrar apenas 1 textarea (prompt) com botão "Salvar" — sem estilo visual, sem imagem base

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Admin.tsx` — `PromptsTab`: adicionar toggle de categoria, condicionar campos |
| Editar | `src/pages/AdminPrompts.tsx` — mesma separação com toggle e condicional |

