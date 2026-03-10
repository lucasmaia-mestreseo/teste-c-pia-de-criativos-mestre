

# Ajuste no Brand Kit — Input hexadecimal nas cores

Adicionar ao lado de cada color picker (primária, secundária, fundo e auxiliares) um campo de texto para digitar o código hex diretamente (ex: `#FF5500`). O usuário pode escolher pela paleta visual ou colar/digitar o hex.

## Implementação

### `BrandKitPanel.tsx`

- Criar um componente interno `ColorPickerWithHex` que combina:
  - `<input type="color">` para seleção visual
  - `<Input>` de texto com placeholder `#000000`, validação de formato hex, sincronizado bidireccionalmente com o color picker
- Usar esse componente nos 3 slots fixos (Primária, Secundária, Fundo) e no botão de adicionar cor auxiliar
- Para as auxiliares, ao editar o hex de uma cor existente, atualizar inline; ao adicionar nova, aceitar tanto pelo picker quanto digitando hex e confirmando com Enter

### Arquivos modificados
- `src/components/BrandKitPanel.tsx` — novo subcomponente + integração nos campos de cor

