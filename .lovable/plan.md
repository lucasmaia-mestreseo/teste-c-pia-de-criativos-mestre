

# Ajustes de Robustez, Upload Múltiplo e Auto-Save no Onboarding

## AJUSTE #01 & #04 — Retry automático + mensagens de erro claras nas Edge Functions

### Problema
Chamadas a `extract-branding`, `extract-design-system`, `suggest-creatives` e `suggest-texts` falham intermitentemente com "Edge Function returned a non-2xx status code" sem informação útil.

### Solução
Criar uma função utilitária `invokeWithRetry` no frontend que:
- Tenta invocar a Edge Function até **3 vezes** com delay exponencial (1s, 2s, 4s)
- Exibe toast com mensagem amigável e número da tentativa: "Tentativa 2 de 3..."
- Só mostra erro final após esgotar tentativas, com mensagem descritiva (ex: "Não foi possível extrair o branding. Tente novamente em alguns instantes.")

Aplicar em: `BrandKitPanel.tsx` (extract-branding, extract-design-system), `ContextPanel.tsx` (extract-context), `FreePromptPanel.tsx` (suggest-creatives), `TemplatesPanel.tsx` (suggest-texts), `SwipeElementsEditor.tsx` (suggest-texts).

### Arquivo novo
`src/lib/invokeWithRetry.ts` — função genérica de retry

---

## AJUSTE #02 — Upload múltiplo de imagens no Brand Kit

### Problema
No Brand Kit, o upload de fotos gerais e fotos de pessoas aceita `multiple` no input, mas o handler `handlePhotoUpload` processa sequencialmente e pode travar se muitos arquivos são selecionados. O upload de logo só aceita um arquivo (correto).

### Solução
Refatorar `handlePhotoUpload` em `BrandKitPanel.tsx`:
- Processar uploads em paralelo com `Promise.all` (limitado a lotes de 5)
- Atualizar o state progressivamente conforme cada upload termina
- Mostrar progresso: "Enviando 3 de 8 fotos..."

---

## AJUSTE #03 — Auto-save ao avançar etapas no Onboarding

### Problema
Ao clicar "Próximo" no onboarding sem clicar "Salvar", os dados se perdem.

### Solução
Modificar `ProjectOnboarding.tsx`:
- Adicionar refs/callbacks para disparar save do BrandKitPanel e ContextPanel antes de avançar
- Expor um método `saveIfDirty()` no BrandKitPanel e ContextPanel via `useImperativeHandle` / `forwardRef`
- No botão "Próximo", chamar o save antes de mudar de step: `await panelRef.current?.saveIfDirty()`
- Se o save falhar, mostrar toast de erro e não avançar

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/lib/invokeWithRetry.ts` — utilitário de retry com backoff |
| Editar | `src/components/BrandKitPanel.tsx` — usar retry nas extrações + upload paralelo + expor `saveIfDirty` via forwardRef |
| Editar | `src/components/ContextPanel.tsx` — usar retry na extração + expor `saveIfDirty` via forwardRef |
| Editar | `src/components/ProjectOnboarding.tsx` — chamar save automático antes de avançar |
| Editar | `src/components/FreePromptPanel.tsx` — usar retry em suggest-creatives |
| Editar | `src/components/TemplatesPanel.tsx` — usar retry em suggest-texts |
| Editar | `src/components/SwipeElementsEditor.tsx` — usar retry em suggest-texts |

