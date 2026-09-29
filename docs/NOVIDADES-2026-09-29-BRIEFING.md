# Novidades — 29/09/2026 (tarde): manual moldado pelo briefing + revisão da experiência

Continuação de [NOVIDADES-2026-09-29.md](./NOVIDADES-2026-09-29.md).

| # | O quê | Onde |
|---|---|---|
| 1 | **Briefing do cliente** na Criação de KVs: CSV do Google Forms, PDF/TXT ou formulário na plataforma | KVs → Briefing e materiais |
| 2 | **Estratégia do manual (IA, Claude)**: o briefing decide a estrutura, cria páginas sob medida e reescreve orientações | Leitura da IA → Estratégia / Estrutura |
| 3 | **Cobertura do briefing**: cada resposta ligada às páginas onde foi aplicada | Leitura da IA → Estratégia |
| 4 | **Estrutura editável**: mapa visual das páginas, tirar/devolver, criar e editar páginas sob medida | Leitura da IA → Estrutura |
| 5 | Nova experiência da Criação de KVs (jornada, abas, barra de aprovação, progresso por fase) | KVs |
| 6 | Nova experiência do Desdobramento (prévia por formato, atalhos, progresso por formato, resultados agrupados) | Desdobramento |

---

## Como colocar no ar

1. **Nenhuma migration nova.**
2. **Edge Function nova:** `kv-plan` (a Lovable publica ao sincronizar). `kv-analyze` passou a
   receber o briefing; `_shared/openrouter.ts` ganhou a chave de modelos `brand_manual` e
   orçamento de tempo na cascata (`timeoutMs`/`budgetMs`).
3. **Modelo:** Admin → Modelos de IA → **Manuais de marca (Criação de KVs)**. Padrão:
   `anthropic/claude-sonnet-4.5`, com fallback `google/gemini-3-flash-preview`. Dá para trocar por
   qualquer slug do OpenRouter (ex.: um Claude mais novo) sem mexer em código.
4. Continua valendo: `OPENROUTER_API_KEY` nos secrets.

### Checklist de teste (com IA real)
- [ ] Exportar as respostas do Google Forms em CSV (Respostas → ⋮ → Baixar respostas) e soltar
      no card **Briefing do cliente** (ou na área de materiais: o CSV do Forms é reconhecido).
- [ ] Subir brandbook + logo, **Ler briefing e materiais**.
- [ ] Aba **Estratégia**: diagnóstico coerente com o briefing; toda resposta aparece na cobertura.
- [ ] Aba **Estrutura**: páginas sob medida no lugar certo; tirar uma página e ver o total mudar.
- [ ] **Aprovar e montar** → sumário refeito, numeração contínua, páginas sob medida no visual do manual.
- [ ] **Salvar no projeto** e reabrir: a estrutura volta junto.

---

## 1. Briefing do cliente

`src/kv/briefing.ts` + `src/components/kv/KvBriefingCard.tsx`

- **CSV do Google Forms**: leitor RFC 4180 (aspas, `""`, quebras de linha dentro do campo;
  vírgula ou ponto-e-vírgula). Cada linha vira um briefing; com várias respostas no arquivo, usa
  a mais recente e deixa trocar num seletor. Carimbo de data/hora e e-mail viram metadados.
- **Anexos do Drive**: respostas que são só links viram "N arquivo(s) no Google Drive" e um aviso
  pede para baixar e subir os arquivos (a plataforma não acessa o Drive do cliente).
- **PDF/TXT/MD**: linhas terminadas em "?" são lidas como perguntas; sem isso, o texto vai inteiro.
- **Preencher aqui**: as 13 perguntas do formulário da Mestre, e **Copiar as perguntas** para
  mandar ao cliente.
- **Observações da agência** (o antigo campo de notas) ficam recolhidas no mesmo card.

## 2. Estratégia do manual — `kv-plan`

A IA não troca textos de um modelo fixo: ela decide a **forma** do manual.

- **Diagnóstico**: problema do cliente final, persona, atributos, o que a marca não quer parecer,
  restrições e tom → página **Contexto do briefing**.
- **Páginas do repertório**: o template de 38 páginas virou uma biblioteca
  (`TEMPLATE_PAGES` em `src/kv/structure.ts`, com descrição de cada página para a IA). A IA remove
  o que o cliente não usa (ex.: "não temos landing pages" tira o capítulo inteiro) — capa,
  sumário, logotipo e cores primárias nunca saem.
- **Orientações reescritas**: as "Orientações de uso" das páginas afetadas pelo briefing
  (sub-marcas, cor proibida, tom do CTA, formatos preferidos…).
- **Páginas sob medida** (até 6–8), em 6 formatos no visual do manual: cartões, persona, tabela,
  fazer/não fazer, checklist e texto. Ex.: Persona decisora, Banco de imagens (critérios e termos
  de busca), Linhas de serviço/sub-marcas, Restrições e brand safety.
- **Cobertura**: cada resposta → aplicado / parcial / sem mudança, com as páginas onde entrou.
- **Pendências**: o que voltar a perguntar ao cliente (copiável).

Se a estratégia falhar, o manual segue a estrutura padrão e dá para tentar de novo em
**Estrutura → Moldar pelo briefing**.

### Como a montagem se adapta (`applyPlan`)
1. O HTML preenchido é cortado nas 38 páginas (marcadores `<!-- ═══ NN · … ═══ -->`).
2. Orientações e aberturas de capítulo reescritas entram no lugar das originais.
3. A ordem final vem de `outline(plan)`: capa, sumário, capítulo de estratégia, e o repertório
   com as páginas sob medida encaixadas depois da página âncora. Capítulo vazio perde a abertura.
4. Numeração refeita e **sumário reconstruído** (duas colunas equilibradas).
5. Páginas sob medida se ajustam ao slide: texto longo encolhe (até 62%), texto curto cresce
   (até 125%) — nada estoura nem fica vazio.

Os textos da IA são sempre escapados (sem HTML da IA no manual) e limitados em tamanho
(`normalizePlan`). Testes em `src/test/kvBriefing.test.ts`.

## 3. Experiência — Criação de KVs

- **Jornada** no topo (Briefing e materiais → Leitura da IA → Manual) com linha de progresso e um
  resumo de cada etapa; o texto do cabeçalho explica o que fazer agora.
- **Briefing e materiais** lado a lado; barra fixa embaixo mostra o que a IA já tem (briefing,
  brandbook, logo, fotos) e o botão de leitura.
- **Progresso por fase** durante a leitura (materiais → identidade → estratégia).
- **Leitura da IA em abas**: Estratégia · Estrutura · Identidade · Textos, com barra fixa
  "N páginas · N sob medida · Aprovar e montar". A seção de landing page some quando o capítulo
  foi removido.
- **Estrutura** como mapa: cada página é uma miniatura desenhada com as cores da marca (cores
  viram amostras, tipografia "Aa", CTA um botão, formatos de banner em proporção…). Clicar tira
  ou devolve; o lápis edita a orientação; páginas sob medida abrem num editor.
- **Manual**: navegação com os títulos reais das páginas e o resumo "N páginas · N sob medida".

## 4. Experiência — Desdobramento

- Diagrama "1 peça → vários formatos" na área de envio; criativos do projeto em faixa rolável.
- **Prévia por formato**: cada cartão mostra a peça-mãe dentro da moldura do formato de destino
  (com o uso: Stories e Reels, Feed vertical…).
- Atalhos **Todos / Redes sociais / Display**; ajustes finos recolhidos, com sugestões de um clique.
- Barra de ação fixa com **progresso por formato**; o formato que está sendo gerado pulsa.
- Resultados: enquanto gera, placeholders **no formato certo**; cada grupo mostra
  peça-mãe → formatos (do mais alto ao mais largo) e "Baixar todos".

## 5. Ajustes gerais
- Toasts no canto superior direito (não cobrem mais as barras de ação).
- Selo do modo demo menor, abaixo do cabeçalho.
- Modo demo: "Usar materiais de exemplo" agora traz também um briefing do Forms (fictício), e a
  estratégia é simulada a partir das respostas.
