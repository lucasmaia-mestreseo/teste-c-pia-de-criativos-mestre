## Catálogo dinâmico de modelos OpenRouter (com checkboxes + proteção contra desativação)

Atualmente o catálogo de modelos em cada dropdown (`IMAGE_MODELS`, `TEXT_MODELS`) é hardcoded em `AiModelsTab.tsx`. Vou trocar por um catálogo dinâmico puxado da OpenRouter, com seleção via checkbox e proteção contra desativar modelos em uso.

### Comportamento

**Botão "Atualizar catálogo da OpenRouter"** no topo de cada card expandido (ou um único botão global no topo da página — ver "Detalhes UX" abaixo):
- Busca `https://openrouter.ai/api/v1/models` (via Edge Function), filtra por categoria, e abre um painel com a lista completa.
- Cada linha mostra: checkbox · nome amigável · slug em mono · badge da modalidade (text, image-in, image-out) · preço por 1M tokens (se disponível).
- Busca textual no topo (filtrar por nome/slug/provider).
- Botões "Selecionar todos" / "Limpar" / "Restaurar padrão Lovable".

**Categorização** (a partir de `architecture.input_modalities` e `architecture.output_modalities` retornados pela OpenRouter):
- `image_generation`: `output_modalities` contém `image`.
- `vision_analysis`: `input_modalities` contém `image` E `output_modalities` é só `text`.
- `text_reasoning`: `input_modalities` = `[text]` E `output_modalities` = `[text]`.
(Um modelo pode aparecer em mais de uma categoria — ok.)

**Persistência**: nova linha em `app_settings`:
- `key = 'model_catalogs'`, `value = { image_generation: string[], text_reasoning: string[], vision_analysis: string[] }` — cada array é a lista de slugs habilitados nos dropdowns. Default seedado com os modelos hardcoded atuais.

**Os dropdowns Primário/Fallback/Terciário** passam a usar o catálogo carregado de `app_settings.model_catalogs[categoria]` em vez dos arrays hardcoded. Se a configuração ativa de algum tier apontar para um modelo que **não está** no catálogo habilitado, ele continua aparecendo como item desabilitado/grifado "(fora do catálogo)" para o usuário visualizar e trocar — não silenciosamente sumir.

### Proteção contra desativação

Ao tentar desmarcar o checkbox de um modelo:
- Verificar nas 3 chaves de `app_settings` (`image_generation`, `text_reasoning`, `vision_analysis`) se aquele slug é o `primary_model`, `fallback_model` ou `tertiary_model` de qualquer uma.
- Se sim: abrir um **AlertDialog** bloqueando a ação, listando "Este modelo está sendo usado em: Geração de Imagens (Primário)" etc., com um botão "Entendi" — sem opção de forçar.
- Se não: desmarcar normalmente. Salvar só persiste após clicar "Salvar catálogo".

A verificação roda no momento do clique no checkbox (estado em memória mais recente das 3 configurações), não só no momento de salvar.

### Detalhes UX

- Um único botão "Catálogo de modelos" no topo do tab `AiModelsTab` (acima dos 3 cards), abrindo um **Dialog** grande com 3 abas internas (Imagens, Texto, Visão) — mais limpo do que duplicar o botão em cada card.
- Indicador de "última sincronização" (timestamp salvo em `model_catalogs.value.synced_at`).
- Loading state durante o fetch da OpenRouter.

### Edge Function

Nova função `list-openrouter-models` (`supabase/functions/list-openrouter-models/index.ts`):
- Sem secrets adicionais — endpoint público da OpenRouter, mas centralizar evita problemas de CORS no browser.
- Retorna o array `data` já categorizado: `{ image_generation: Model[], text_reasoning: Model[], vision_analysis: Model[], synced_at: string }`.
- Campos por modelo: `{ id, name, context_length, pricing: { prompt, completion }, input_modalities, output_modalities }`.
- `verify_jwt = true` (padrão Lovable) — só admins logados acessam.

### Migração

Inserir linha default em `app_settings`:
```sql
INSERT INTO app_settings (key, value) VALUES (
  'model_catalogs',
  '{
    "image_generation": ["openai/gpt-5.4-image-2", "google/gemini-3.1-flash-image-preview", ...],
    "text_reasoning": [...],
    "vision_analysis": [...],
    "synced_at": null
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
```
(Lista inicial = os mesmos slugs que estão hoje hardcoded em `AiModelsTab.tsx`.)

### Arquivos

**Criados**:
- `supabase/functions/list-openrouter-models/index.ts`
- `src/components/admin/ModelCatalogDialog.tsx` (Dialog com 3 abas, checkboxes, busca, proteção)
- Migration adicionando default `model_catalogs`

**Editados**:
- `src/components/admin/AiModelsTab.tsx`:
  - Remover `IMAGE_MODELS`/`TEXT_MODELS` hardcoded.
  - Carregar `model_catalogs` do banco e passar como prop para cada `SectionCard`.
  - Adicionar botão "Catálogo de modelos" no topo abrindo `ModelCatalogDialog`.
  - Tratar modelo "fora do catálogo" no dropdown (item desabilitado/grifado).

### Não muda

- Helper `_shared/openrouter.ts`, Edge Functions de geração, estrutura das 3 chaves `image_generation`/`text_reasoning`/`vision_analysis` em `app_settings`.
- Drag-and-drop, dirty tracking, layout colapsável.
