

# Fix: Conectar element overrides com envio de assets do Brand Kit

## Problema
Dois mecanismos desconectados controlam logo/foto:
1. **SwipeElementsEditor**: toggles "Meu logo" / "Minha foto" → define `elementOverrides.logos[id].action = 'replace'` e `elementOverrides.photos[id].action = 'replace'`
2. **Checkboxes no GeneratePanel**: `includeLogo` e `includePersonPhoto` → controlam `brandKit.logoUrl` e `brandKit.personPhotoUrl` enviados à edge function

A edge function só envia as imagens reais quando `brandKit.logoUrl`/`brandKit.personPhotoUrl` estão preenchidos (linhas 371-372). Então os overrides dizem "replace" mas o asset nunca é enviado.

## Solução

### `src/components/GeneratePanel.tsx` — `handleGenerate`
Na construção do body, verificar se algum elemento em `elementOverrides` tem `action: 'replace'` e, se sim, incluir automaticamente o asset correspondente:

```typescript
// Auto-include logo if any element override requests replacement
const anyLogoReplace = Object.values(elementOverrides.logos).some(l => l.action === 'replace');
const anyPhotoReplace = Object.values(elementOverrides.photos).some(p => p.action === 'replace');

const logoUrl = (includeLogo || anyLogoReplace) && hasLogo ? brandKit.logo_url : null;
const personPhotoUrl = (includePersonPhoto && selectedPersonPhoto) 
  || (anyPhotoReplace && personPhotos.length > 0 ? (selectedPersonPhoto || personPhotos[0]) : null);
```

Isso garante que quando o usuário ativa "Minha foto" no editor de elementos, a URL da foto é enviada automaticamente — sem precisar marcar o checkbox separadamente.

Também remover os checkboxes duplicados de Logo/Pessoa quando os toggles do editor de elementos já cobrem a mesma funcionalidade (ou sincronizá-los).

### Arquivos modificados
- `src/components/GeneratePanel.tsx` — lógica de construção do body no `handleGenerate`

