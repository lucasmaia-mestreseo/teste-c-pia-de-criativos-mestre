

# Menu Lateral no Admin + Imagem Base nos Prompts

## 1. Layout do Admin com sidebar lateral

Substituir o `Tabs` horizontal atual em `src/pages/Admin.tsx` por um layout com sidebar à esquerda e conteúdo à direita:

- Sidebar fixa (~220px) com itens de navegação vertical: Projetos, Usuários, Uso do Sistema, Prompts (owner only)
- Área de conteúdo ocupa o restante da largura
- Estado `activeSection` controla qual seção é exibida
- Usar estilos simples com botões/links verticais (sem necessidade do componente Sidebar do shadcn, basta um `div` com navegação)

## 2. Imagem base por template no Prompts

### Migration: adicionar coluna `base_image_url` à tabela `template_prompts`
```sql
ALTER TABLE template_prompts ADD COLUMN base_image_url text;
```

### UI no PromptsTab
Para cada template, além do textarea do prompt, adicionar:
- Preview da imagem base atual (se existir)
- Botão de upload de imagem (usa storage bucket existente, ex: `generated-creatives` ou um novo `template-images`)
- Botão para remover a imagem
- Ao salvar, atualiza tanto `prompt` quanto `base_image_url`

### Edge Function `generate-creative`
- Ao buscar o prompt do template, incluir também `base_image_url`
- Enviar a imagem base como parte do contexto visual na chamada de geração da IA (como `image_url` adicional nas messages)

## Arquivos a modificar
- **`src/pages/Admin.tsx`** — trocar Tabs por sidebar lateral; adicionar upload de imagem no PromptsTab
- **Migration SQL** — adicionar coluna `base_image_url` em `template_prompts`
- **`supabase/functions/generate-creative/index.ts`** — consumir `base_image_url` do template

