

# Strip Metadata no Download (Frontend)

## Problema
As imagens geradas já têm metadata removido no upload, mas imagens vindas de APIs externas (Google, etc.) ou já armazenadas podem ainda conter metadados. O download no browser precisa garantir que o arquivo final esteja limpo.

## Solução
Criar uma função utilitária `stripPngMetadata` no frontend (mesma lógica dos edge functions) e aplicá-la nos blobs antes de criar o link de download.

### Novo arquivo: `src/lib/stripPngMetadata.ts`
- Exportar função `stripPngMetadata(data: Uint8Array): Uint8Array`
- Mesma lógica: manter apenas chunks `IHDR`, `PLTE`, `tRNS`, `IDAT`, `IEND`

### Modificar: `src/components/GeneratePanel.tsx`
- No `handleDownload`, após `res.blob()` → converter para `ArrayBuffer` → `Uint8Array` → `stripPngMetadata` → criar novo `Blob` limpo

### Modificar: `src/components/HistoryPanel.tsx`
- Mesmo tratamento no `handleDownload`

### Lógica resumida
```typescript
const res = await fetch(url);
const buf = await res.arrayBuffer();
const clean = stripPngMetadata(new Uint8Array(buf));
const blob = new Blob([clean], { type: 'image/png' });
// ... criar link de download com blob limpo
```

