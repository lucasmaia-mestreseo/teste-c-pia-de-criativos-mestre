

# Melhorar fidelidade do prompt + redesign do painel de geração

## Problemas identificados

1. **Prompt corta logo**: Instrução genérica; precisa ser mais explícita sobre posicionamento e escala completa do logo
2. **Pessoa substituída em vez de trocada**: Quando o usuário quer "colocar a pessoa X no lugar da pessoa Y", o prompt deve instruir a IA a manter pose, roupa, contexto e apenas trocar o rosto/aparência pela pessoa do Brand Kit
3. **CTA/botão sem cores do brand kit**: O prompt não menciona que botões, CTAs e outros elementos interativos devem seguir as cores do brand kit
4. **Layout apertado**: A galeria de resultados ocupa espaço demais; o prompt + opções ficam comprimidos

## Solução

### 1. Edge Function — prompt mais detalhado (`generate-creative/index.ts`)

Reescrever as regras de brand kit para cobrir:
- **Logo**: "Inclua o logo COMPLETO, sem cortar nenhuma parte. Mantenha proporções originais. Posicione-o de forma visível."
- **Pessoa**: "Substitua a pessoa que aparece na imagem de referência por esta pessoa. Mantenha a MESMA pose, enquadramento, roupas e cenário da referência original. Apenas troque o rosto e características físicas pela pessoa fornecida."
- **Cores em TODOS os elementos**: Adicionar regras explícitas para:
  - Headlines: cor primária
  - Textos secundários: cor secundária  
  - Botões/CTAs: cor primária como fundo, com texto em cor que contraste
  - Fundo: cor de fundo exata
  - Detalhes decorativos: cores auxiliares
- **Proibição reforçada**: "NUNCA use uma cor que não esteja listada no brand kit para qualquer elemento visual."

### 2. GeneratePanel — novo layout inspirado na referência (`GeneratePanel.tsx`)

Reorganizar o layout em 3 zonas verticais:

```text
┌──────────────────────────────────┐
│ GALERIA (topo, scrollável horiz) │  ← thumbnails pequenos + controle de tamanho
│ [img] [img] [img] [img]         │  ← click abre modal fullscreen
├──────────────────────────────────┤
│ REFERÊNCIA (swipe selecionado)   │  ← imagem de referência compacta
├──────────────────────────────────┤
│ PROMPT + OPÇÕES (parte inferior) │
│ [textarea compacta]             │
│ [✓ Logo] [✓ Pessoa: thumb]     │  ← inline, uma linha
│ [formato ▼] [⚡ Gerar]          │
└──────────────────────────────────┘
```

Detalhes:
- **Galeria no topo**: grid compacto (thumbnails ~80px) com slider para controlar tamanho. Hover mostra download/delete. Click abre Dialog/modal com imagem em tamanho real
- **Referência**: altura máxima reduzida (~120px), compacta
- **Prompt**: `min-h-[60px]` em vez de 80px; assets do brand kit inline (não em card separado)
- **Modal de imagem**: Dialog com a imagem expandida, botões de download e delete

### Arquivos modificados
- `supabase/functions/generate-creative/index.ts` — prompt detalhado com regras por elemento
- `src/components/GeneratePanel.tsx` — novo layout com galeria no topo, modal, controle de tamanho

