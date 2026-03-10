

# Corrigir inserção do logo: tamanho, posição e integridade

## Problema
O prompt atual diz "inclua o logo completo sem cortes" mas não instrui o modelo a:
1. Detectar onde está o logo existente na referência
2. Posicionar o novo logo no mesmo local e tamanho
3. Evitar redimensionar o logo para um tamanho desproporcional

O resultado: logo cortado e gigante em vez de pequeno e posicionado como na referência.

## Mudança

Arquivo: `supabase/functions/generate-creative/index.ts`

Reescrever a **SEÇÃO 4 (REGRAS DO LOGO)** com instruções muito mais específicas sobre posicionamento e escala:

- **Regra de posição**: Se a imagem de referência contém um logo, o novo logo DEVE ser posicionado EXATAMENTE no mesmo local (mesmo canto, mesma margem, mesma distância das bordas)
- **Regra de escala**: O novo logo DEVE ter o MESMO tamanho relativo que o logo da referência. Se o logo da referência ocupa ~5% da área da imagem, o novo logo deve ocupar ~5%. NUNCA ampliar o logo
- **Regra de integridade reforçada**: O logo DEVE aparecer 100% completo, com margem de segurança ao redor. PROIBIDO cortar qualquer pixel do logo
- **Regra de sobreposição**: NENHUM outro elemento (texto, pessoa, forma) pode sobrepor qualquer parte do logo
- **Regra de fundo**: Se o logo precisa de um fundo para legibilidade, usar um container discreto com opacidade sutil, nunca maior que o necessário

Também adicionar ao **checklist final**:
- "O logo tem o mesmo tamanho relativo que o logo na referência?"
- "O logo está no mesmo local/canto que o logo na referência?"
- "O logo está 100% visível com margem de segurança, sem nenhum pixel cortado?"

