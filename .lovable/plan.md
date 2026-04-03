

# Separar prompts em Composição e Estilo Visual

## Resumo

Cada template de anúncio passará a ter dois campos de prompt: **Prompt de Composição** (guia o layout/estrutura) e **Prompt de Estilo Visual** (define a estética). Ambos serão combinados com o prompt do usuário e variáveis para compor o prompt final.

## Alterações

### 1. Migração de banco de dados

Adicionar coluna `style_prompt` (text, nullable, default vazio) à tabela `template_prompts`. O campo `prompt` existente passa a ser o "Prompt de Composição".

```sql
ALTER TABLE public.template_prompts ADD COLUMN style_prompt text NOT NULL DEFAULT '';
```

### 2. Admin — UI com dois campos (`src/pages/Admin.tsx`)

Na `PromptsTab`, para cada template exibir dois textareas:
- **Prompt de Composição** (campo `prompt` existente)
- **Prompt de Estilo Visual** (campo `style_prompt` novo)

Cada um com botão de salvar independente. Atualizar o `select` para incluir `style_prompt` e os handlers de save.

### 3. Admin Prompts standalone (`src/pages/AdminPrompts.tsx`)

Mesmo ajuste: buscar e exibir ambos os campos, permitir edição independente.

### 4. Edge Function — combinar os dois prompts (`supabase/functions/generate-creative/index.ts`)

No bloco de templates (linha ~487), buscar `style_prompt` junto com `prompt` e `base_image_url`. Compor o prompt efetivo assim:

```
COMPOSIÇÃO E LAYOUT:
{prompt}

ESTILO VISUAL E ESTÉTICA:
{style_prompt}

Elementos do anúncio:
{fieldLines}

Instruções adicionais: {userPrompt}
```

### 5. Edge Function dinâmica (`supabase/functions/generate-dynamic-creative/index.ts`)

Buscar `style_prompt` junto com `prompt`. Incorporar no briefing/geração quando disponível.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | `template_prompts` — adicionar coluna `style_prompt` |
| Editar | `src/pages/Admin.tsx` — dois textareas por template |
| Editar | `src/pages/AdminPrompts.tsx` — dois textareas por template |
| Editar | `supabase/functions/generate-creative/index.ts` — combinar composition + style |
| Editar | `supabase/functions/generate-dynamic-creative/index.ts` — usar style_prompt |

