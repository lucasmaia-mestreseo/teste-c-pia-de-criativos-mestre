

# Ajustes 01, 02 e 03

## AJUSTE 01 — Exclusão não funciona no Dashboard

**Causa raiz:** O hook `useDeleteCreative` invalida a query `['generated_creatives', projectId]`, mas o Dashboard usa queries com keys diferentes (`['dashboard-recent', userId]`, `['dashboard-total', userId]`, etc.). Após deletar, o cache do dashboard não é atualizado.

**Correção em `src/hooks/useGeneratedCreatives.ts`:**
- No `onSuccess` do `useDeleteCreative`, além de invalidar `['generated_creatives', projectId]`, também invalidar as queries do dashboard: `['dashboard-recent']`, `['dashboard-total']`, `['dashboard-7days']`, `['dashboard-projects']`.

## AJUSTE 02 — Referência deve limpar prompt e imagens existentes

**Correção em `src/pages/Index.tsx`:**
- No `handleUseAsReference`, ao invés de preservar `prev`, resetar o `freePromptData` com prompt vazio e apenas a nova imagem:
```
setFreePromptData({ prompt: '', attachedImages: [imageUrl] });
```

## AJUSTE 03 — Cursor pointer no menu do usuário

**Correção em `src/components/RightSidebar.tsx`:**
- Adicionar `className="cursor-pointer"` nos três `DropdownMenuItem` (Perfil, Administração, Sair).

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/hooks/useGeneratedCreatives.ts` — invalidar queries do dashboard no delete |
| Editar | `src/pages/Index.tsx` — resetar freePromptData na referência |
| Editar | `src/components/RightSidebar.tsx` — cursor-pointer nos menu items |

