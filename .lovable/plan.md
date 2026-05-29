## Refatorar AiModelsTab para cards colapsáveis

Atualmente os 3 grupos (Imagens, Texto, Visão) aparecem lado a lado em colunas, ficando apertados. Vou trocar por uma lista vertical de cards horizontais colapsáveis, no estilo accordion.

### Comportamento

- **Layout**: largura total do container (`max-w-4xl`), cards empilhados verticalmente.
- **Estado colapsado** (padrão):
  - Ícone + título + descrição curta à esquerda.
  - À direita, resumo inline dos 3 modelos: `Primário · openai/gpt-5.4-image-2 (2x) → Fallback · ... (1x) → Terciário · ... (1x)` em fonte mono pequena com cores muted.
  - Chevron indicando expansível.
  - Card inteiro é clicável para expandir.
- **Estado expandido**:
  - Mesma UI atual de edição (Select + Input custom + tentativas) para cada tier.
  - Rodapé com botão **Salvar**.
- **Dirty tracking**:
  - Guardar `initialSettings` (snapshot do que veio do banco/defaults) no estado.
  - `isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings)`.
  - Botão Salvar fica `disabled` quando `!isDirty || saving`.
  - Após salvar com sucesso, atualizar `initialSettings` para o valor recém-salvo (volta a ficar não-dirty).
  - Se o card tiver alterações não salvas, mostrar um pequeno badge "não salvo" no header (mesmo colapsado) para o usuário não esquecer.

### Implementação

- Arquivo único: `src/components/admin/AiModelsTab.tsx`.
- Usar `<Collapsible>` do shadcn (`@/components/ui/collapsible`) — já presente no projeto — para o accordion (cada card controla seu próprio `open`).
- Ícone `ChevronDown` rotacionado quando aberto.
- Não tocar em nenhum Edge Function nem na lógica de save (continua `upsert` em `app_settings`).
- Sem mudanças em `Admin.tsx`.

### Arquivos editados

- `src/components/admin/AiModelsTab.tsx`
