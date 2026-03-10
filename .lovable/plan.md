

# Integrar Brand Kit completo na geração de criativos

## Problema identificado

1. **GeneratePanel envia dados antigos**: Passa `brandKit.colors` (array genérico vazio) em vez dos campos categorizados (`primary_color`, `secondary_color`, `background_color`, `aux_colors`)
2. **Edge function ignora assets visuais**: Menciona logo apenas em texto, nunca envia a imagem do logo ou fotos de pessoas para o modelo de IA
3. **Sem opções para incluir logo/pessoas**: O usuário não tem como indicar que quer o logo ou uma foto de pessoa no criativo

## Solução

### 1. GeneratePanel — checkboxes + seletor de pessoa

Adicionar na UI antes do botão "Gerar":
- Checkbox "Incluir logo da marca" (habilitado apenas se `brandKit.logo_url` existir)
- Checkbox "Incluir foto de pessoa" + dropdown para selecionar qual foto (da lista `brandKit.people_photos`)
- Ambos desabilitados/ocultos se o brand kit não tiver esses assets

Ao chamar a edge function, enviar o brand kit completo:
```
brandKit: {
  primaryColor, secondaryColor, backgroundColor, auxColors,
  typography, logoUrl (se checkbox marcado),
  personPhotoUrl (se selecionada)
}
```

### 2. Edge function `generate-creative` — prompt rico + imagens extras

- **Brand context atualizado**: Montar o contexto com cores categorizadas (primária, secundária, fundo, auxiliares) e tipografia
- **Logo como imagem**: Se `brandKit.logoUrl` vier, incluir como segundo `image_url` na mensagem do usuário com instrução explícita: "Incorpore este logo no criativo"
- **Foto de pessoa como imagem**: Se `brandKit.personPhotoUrl` vier, incluir como terceiro `image_url` com instrução: "Inclua esta pessoa no criativo, mantendo fidelidade ao rosto"
- O array `content` do user message fica dinâmico: texto + swipe file + logo (opcional) + pessoa (opcional)

### Arquivos modificados
- `src/components/GeneratePanel.tsx` — checkboxes de logo/pessoa, enviar brand kit completo
- `supabase/functions/generate-creative/index.ts` — prompt com cores categorizadas, imagens extras no request

