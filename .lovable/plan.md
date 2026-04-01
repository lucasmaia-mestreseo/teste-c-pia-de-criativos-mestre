

# 4 Ajustes

## AJUSTE 01 — Fix extract-design-system base64 error

The Firecrawl screenshot format returns a URL (not base64). The edge function tries to `atob()` it, causing `InvalidCharacterError: Failed to decode base64`.

**Fix in `supabase/functions/extract-design-system/index.ts`:**
- Instead of `atob(base64Data)`, fetch the screenshot URL with `fetch()` and get the bytes via `arrayBuffer()`
- If it IS base64 (starts with `data:`), keep the current logic; otherwise treat it as a URL

## AJUSTE 02 — Fullscreen expand for Context/Voice fields + manual save

**In `src/components/ContextPanel.tsx`:**
- Remove auto-save debounce effect
- Add a "Salvar" button (visible when `dirty`) that triggers `save.mutate()`
- Add an `Expand` (Maximize2) icon button on each textarea that opens a Dialog/modal with the textarea filling the screen, plus a close button
- Use state `expandedField: 'context' | 'voice' | null` to control which is fullscreen

## AJUSTE 03 — Reorder sidebar: "Geração Dinâmica" right after "Gerar"

**In `src/components/RightSidebar.tsx`:**
- Move `dynamic` entry to index 1 in `navItems` array (right after `generate`)

## AJUSTE 04 — Hide CreationModeSelector when activePanel is 'dynamic'

**In `src/pages/Index.tsx`:**
- Only render the left column (CreationModeSelector + SwipeFile/FreePrompt/Templates) when `activePanel === 'generate'`
- For other panels (brandkit, context, history, dynamic), render the right panel at full width without the left column

