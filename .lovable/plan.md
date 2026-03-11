

# 3 Modos de Criação: Prompt Livre, Modelos e Swipe File

## Visão Geral

Transformar o painel esquerdo em um seletor de modo com 3 abas, onde cada modo oferece uma experiência diferente de criação. O painel direito (GeneratePanel) se adapta ao modo ativo.

```text
┌─────────────────────────────────────────────────────────┐
│  TopBar                                                 │
├──────────────────┬──────────────────────────────────────┤
│  [✏️][📐][📁]    │                                      │
│  ──────────────  │     GeneratePanel                    │
│                  │     (adapta-se ao modo)               │
│  Conteúdo do     │                                      │
│  modo ativo      │                                      │
│                  │                                      │
└──────────────────┴──────────────────────────────────────┘
```

## Mudanças

### 1. `src/pages/Index.tsx` — Novo state `creationMode`
- Tipo: `'free' | 'templates' | 'swipe'`
- Default: `'swipe'` (comportamento atual)
- O painel esquerdo renderiza componente diferente por modo
- `GeneratePanel` recebe `creationMode` e dados do modo ativo

### 2. Novo componente: `src/components/CreationModeSelector.tsx`
- 3 botões/ícones no topo do painel esquerdo (tabs horizontais compactas):
  - `Pencil` — Prompt Livre
  - `LayoutTemplate` — Modelos
  - `FolderOpen` — Swipe File
- Abaixo, renderiza o conteúdo do modo selecionado

### 3. Novo componente: `src/components/FreePromptPanel.tsx` (Modo 1: Prompt Livre)
- Textarea para prompt livre
- Botão de anexar imagens (upload para storage, exibe thumbnails)
- Sem swipe file, sem análise de elementos
- Imagens anexadas são enviadas como referências adicionais à edge function

### 4. Novo componente: `src/components/TemplatesPanel.tsx` (Modo 2: Modelos)
- Grid/lista de 7 modelos com ícone + nome + descrição curta
- Ao selecionar um modelo, exibe os campos editáveis daquele modelo (headline, subtítulo, CTA, etc.)
- Cada modelo define quais elementos são configuráveis
- Mantém campo de prompt e anexo de imagens

**Os 7 modelos:**
1. **Hero** — Headline, Produto/imagem central, Subheadline, CTA
2. **Problema → Solução** — Texto problema, Texto solução, CTA
3. **Benefício Principal** — Headline grande, Visual de apoio, CTA
4. **Lista (List Ad)** — Headline, 3-5 bullet points, Visual, CTA
5. **Autoridade** — Foto especialista, Headline autoridade, Prova social, CTA
6. **Demonstração** — Produto em uso, Headline, Destaques, CTA
7. **Oferta Direta** — Oferta destacada, Visual produto, Urgência, CTA

### 5. Modificar: `src/components/GeneratePanel.tsx`
- Aceitar novo prop `creationMode` e dados do modo (`freePromptData` | `templateData` | `swipeData`)
- Modo `free`: não exigir swipe selecionado, enviar imagens anexadas como referências
- Modo `templates`: enviar template ID + campos preenchidos + imagens anexadas
- Modo `swipe`: comportamento atual inalterado
- Validação do botão "Gerar" adapta-se ao modo

### 6. Modificar: `supabase/functions/generate-creative/index.ts`
- Aceitar novos campos: `mode`, `templateId`, `templateFields`, `attachedImages`
- Modo `free`: usar prompt + imagens anexadas como contexto, sem referência swipe
- Modo `templates`: construir prompt estruturado baseado no template selecionado + campos preenchidos
- Modo `swipe`: lógica atual inalterada
- Cada template tem um prompt-base embutido na edge function que descreve a estrutura visual esperada

### 7. Novo componente: `src/components/ImageAttachments.tsx`
- Componente reutilizável para upload + preview de imagens anexadas
- Upload para bucket `swipe-files` (reutilizar)
- Thumbnails com botão de remover
- Usado tanto no FreePromptPanel quanto no TemplatesPanel

## Arquivos
- **Criar:** `src/components/CreationModeSelector.tsx`, `src/components/FreePromptPanel.tsx`, `src/components/TemplatesPanel.tsx`, `src/components/ImageAttachments.tsx`
- **Modificar:** `src/pages/Index.tsx`, `src/components/GeneratePanel.tsx`, `supabase/functions/generate-creative/index.ts`

