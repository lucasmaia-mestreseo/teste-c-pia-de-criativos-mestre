## Drag-and-drop entre tiers (Primário ↔ Fallback ↔ Terciário)

Adicionar reordenação por arrasto dos 3 tiers dentro de cada card expandido, para o admin reordenar a cascata sem precisar reescrever os campos.

### Comportamento

- Cada tier (Primário, Fallback, Terciário) vira um item arrastável dentro do card expandido.
- O **label** do tier (Primário / Fallback / Terciário) é determinado pela **posição** atual, não pelo modelo. Arrastar o terciário para o topo o transforma em Primário automaticamente.
- Handle visual à esquerda de cada tier (ícone `GripVertical`) com cursor `grab` / `grabbing`.
- Ao soltar, o estado `settings` é reescrito de modo que `primary_*` recebe o item que ficou no topo, `fallback_*` o do meio e `tertiary_*` o último — mantendo `model` e `attempts` de cada item.
- A reordenação conta como alteração: ativa o badge "não salvo" e habilita Salvar (já funciona via comparação JSON existente).
- Drag funciona apenas no handle (não no Select/Input), para não conflitar com edição de texto.

### Implementação

- Biblioteca: `@dnd-kit/core` + `@dnd-kit/sortable` (padrão React leve, sem instalar React DnD pesado). Verificar se já está no `package.json`; se não, instalar.
- Em `SectionCard`, representar os tiers como um array local derivado:
  ```ts
  const tiers = [
    { id: 'primary', model: settings.primary_model, attempts: settings.primary_attempts },
    { id: 'fallback', ... },
    { id: 'tertiary', ... },
  ];
  ```
  apenas para renderização ordenada. Source of truth continua `settings` com chaves fixas.
- Ao reordenar via `onDragEnd`, montar novo `settings` mapeando a nova ordem para `primary_*`/`fallback_*`/`tertiary_*` na ordem `[0, 1, 2]`.
- Label exibido (`Primário` / `Fallback` / `Terciário`) vem do índice na lista ordenada, não do `id` original.
- Resumo colapsado (P / F / T) continua igual, já que lê de `settings`.

### Arquivo editado

- `src/components/admin/AiModelsTab.tsx`

### Sem mudanças

- Schema `app_settings`, helper `_shared/openrouter.ts`, Edge Functions: o formato salvo (`primary_*`, `fallback_*`, `tertiary_*`) permanece idêntico.
