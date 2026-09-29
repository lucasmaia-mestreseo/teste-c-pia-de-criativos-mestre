# Novidades — 29/09/2026

Continuação de [MELHORIAS-2026-09.md](./MELHORIAS-2026-09.md). Arquitetura geral em
[ARQUITETURA.md](./ARQUITETURA.md) e modo de teste em [MODO-DEMO.md](./MODO-DEMO.md).

| # | O quê | Onde |
|---|---|---|
| 1 | **Criação de KVs** — manual de comunicação digital de 38 páginas com IA | Ferramentas → Criação de KVs · aba **KVs** do projeto |
| 2 | **Copy do anúncio** — texto por plataforma para cada criativo | Modal do criativo → **Copy** |
| 3 | **Variações A/B** — variações que testam uma hipótese + comparação | Modal do criativo → **Variações** / **Comparar A/B** |
| 4 | Acabamento visual e usabilidade | App inteiro |
| 5 | Correções encontradas nos testes | — |

---

## Como colocar no ar

1. **Nenhuma migration nova.** Tudo usa as colunas da migration de 29/09 (já aplicada).
2. **Edge Functions novas** (a Lovable publica ao sincronizar): `kv-analyze`, `ad-copy`,
   `suggest-variants`. A `transform-creative` ganhou a operação `variant`.
3. **Dependências novas** no front: `pdfjs-dist` (ler PDFs) e `imagetracerjs`
   (vetorizar logos). `package.json`, `package-lock.json` e `bun.lock` já estão atualizados.
4. Continua valendo: `OPENROUTER_API_KEY` precisa estar nos secrets.

### Checklist de teste (com IA real)
- [ ] Ferramentas → Criação de KVs → escolher projeto → subir brandbook PDF + logo + 1 peça → Analisar.
- [ ] No resumo: conferir cores (e o aviso de contraste do CTA), fontes, logo nas 5 versões, fotos.
- [ ] Aprovar → conferência verde → navegar pelas 38 páginas → **Baixar PDF** (Salvar como PDF, margens "Nenhuma").
- [ ] **Salvar no projeto** e **Aplicar à identidade do cliente** → Brand Kit atualizado + cartão do manual no Brand Kit.
- [ ] Gerar um criativo nesse projeto: ele deve seguir as cores/regras do manual.
- [ ] Modal de um criativo → **Copy** → escrever → abas Meta / Instagram / LinkedIn / Google / Ângulos.
- [ ] Modal → **Variações** → sugerir → editar → gerar → **Comparar A/B** → marcar vencedora.

---

## 1. Criação de KVs

Reconstrução, como ferramenta da plataforma, do sistema de manuais que foi feito à mão
na conversa "manuais-de-marca-figma" (SISPRO, CTD, Omada, VIGI, Mundo Apto, Calhas
Kennedy, Doow, PHE).

### De onde veio o template
O `template/index.html` original (base Agência Mestre, 38 páginas 16:9, 1920×1080) não
estava no backup — só a conversa. Ele foi **reconstruído a partir do histórico**: o
manual SISPRO foi remontado aplicando cada escrita/edição registrada, o `mktemplate.mjs`
original foi rodado sobre ele e depois as 3 edições diretas e os 7 scripts de correção
(`limpar`, `tpl-veu`, `tpl-colunas`, `patch3-tp`, `patch-lp`, `patch-azul`,
`fix-gotham`) na ordem original. As saídas bateram com as registradas na época
("marcadores 162", "4/4 trocas limpo", "21 trocas | azul: 1"), então o template é o
mesmo. Está em `src/kv/manual-template.html`; as lições do trabalho original em
`src/kv/ARMADILHAS-original.md`.

### Fluxo (o que você desenhou em 21/08)
**Materiais → IA analisa → resumo para aprovação → manual.** Nada é criado antes do OK.

1. **Materiais** (`KvMaterialsStep`): PDFs, imagens (PNG/JPG/SVG/WEBP) e texto
   (TXT/CSV/MD) + briefing. Cada imagem recebe um papel (logo, logo com slogan,
   símbolo, foto, peça, ou "IA decide"). Botão para importar logo e fotos do Brand Kit.
   - PDFs são lidos no navegador (pdf.js): texto das páginas, **nomes das fontes
     embutidas** (a evidência mais forte de tipografia — o equivalente ao `pdffonts` do
     fluxo original) e páginas renderizadas para a IA.
   - As cores são **medidas nos pixels** (logo, peças e páginas do PDF) e vão para a IA
     como candidatas — ela não inventa cor.
2. **Análise** (`kv-analyze`, IA de texto multimodal): devolve os DADOS do manual — cores
   com papéis, tipografia, textos, CTAs, landing page, direção de imagem, descrição dos 3
   criativos, resumo (direção visual, tom, público), **inferências** e **pendências**.
   O prompt carrega as regras aprendidas nos manuais feitos à mão (não inventar cor,
   contraste do CTA, restrições do briefing, CTAs com verbo, etc.). O contexto e o Brand
   Kit do projeto também entram.
3. **Resumo para aprovação** (`KvReviewStep`): tudo editável — cores com contraste do CTA
   ao vivo, paleta oficial (p.09), fontes com prévia (Google Fonts), logo nas 5 versões,
   até 3 fotos com **ponto de foco clicável**, textos com contador de caracteres, listas.
4. **Manual** (`KvManualStep`): prévia navegável das 38 páginas, relatório de
   conferência, **Baixar PDF** (impressão do navegador, página 1920×1080 já definida),
   HTML, **Salvar no projeto**, **Aplicar à identidade do cliente**.

### O que é automático (e vinha das armadilhas do fluxo manual)
- **Logo**: remove fundo chapado por flood fill a partir das bordas (preserva o branco de
  dentro das letras), recorta justo com margem, mede a proporção real, gera versões
  branco/institucional/apoio/preto **com vazados** (detalhes claros viram furo) e detecta
  logo enviado em negativo. Símbolo: arquivo marcado como símbolo ou caixa sugerida pela IA.
- **Vetorização** (opcional, ligada por padrão): ImageTracer num **Web Worker**, uma vez
  por arquivo; as versões mono recolorem os caminhos do SVG. Limite de 25 s por arquivo
  e recurso automático para PNG.
- **Marca quase quadrada** (proporção < 2,2): as larguras do template são reduzidas para
  não estourar as páginas. **Área de proteção**: X = largura real do símbolo.
- **CTA**: se branco reprova (< 4,5:1) sobre a cor de acento, o manual usa texto escuro em
  todos os botões e escreve a regra na página de CTA.
- **Tons derivados** (p.10), RGB/CMYK, véu das fotos, tokens — calculados das 3 cores.
- **Fontes**: pesos testados um a um no Google Fonts (pedir peso inexistente derruba o CSS
  inteiro); fontes comerciais ausentes viram a equivalente gratuita mais próxima
  (Gotham→Montserrat, Futura→Jost, Avenir→Nunito Sans…) com nota no manual.
- **Imagens embutidas uma única vez** no HTML (o logo aparece ~70×): manual de ~0,6–2 MB.
- **Conferência**: cada troca estrutural é registrada; marcadores sem valor e termos de
  outras marcas são listados.

### Integração com a identidade do cliente
- **Aplicar à identidade do cliente**: Brand Kit (cores, tipografia, logo, fotos) +
  Contexto (tom de voz, público) + **Diretrizes visuais** — um bloco com papéis das cores,
  regra do CTA, tipografia e fazer/evitar de imagem, que a geração de criativos já injeta
  em todo prompt. Reaplicar substitui o bloco anterior (não duplica).
- **Brand Kit** mostra um cartão do manual (último salvo) com atalho para a ferramenta.
- Manuais salvos ficam no storage do projeto (`generated-creatives/{projeto}/manuals/`,
  HTML autocontido + JSON do resumo) — sem tabela nova.

Arquivos: `src/kv/*` (lógica), `src/components/kv/*` (telas),
`supabase/functions/kv-analyze/`.

## 2. Copy do anúncio

No modal de qualquer criativo → **Copy**. A IA **lê a peça** e escreve o texto que vai
junto dela, no tom e nas diretrizes da marca, com objetivo de campanha (conversão, leads,
tráfego, reconhecimento):

- **Meta Ads**: texto principal (os 125 primeiros caracteres funcionam sozinhos), título ≤ 40,
  descrição ≤ 30, botão.
- **Instagram**: legenda com gancho + hashtags. **LinkedIn**: post profissional.
- **Google Ads**: 5 títulos ≤ 30 e 2 descrições ≤ 90.
- **Ângulos A/B**: 3 alternativas de texto principal + título.

Contador de caracteres por campo (vermelho quando passa do limite) e botão de copiar.
A copy fica salva no criativo (`generation_meta.adCopy`). Função: `ad-copy`.

## 3. Variações A/B

No modal → **Variações**: escolha o foco (ângulo da mensagem, só headline, só CTA, ou um
elemento visual) e a quantidade (2–4). A IA propõe variações — **cada uma testa uma
hipótese** (prova social, dor, urgência…) para o resultado do teste ser legível. Tudo é
editável antes de gerar. A imagem é gerada pela `transform-creative` (operação
`variant`) mantendo layout, pessoas, logo e cores — muda só o que foi pedido.

**Comparar A/B**: controle e variações lado a lado com hipótese, headline, nota da
revisão e custo; **Marcar vencedora** (vira favorito). Variações também passam pela
revisão automática. Sem mudança de banco: ficam como `kind = generate` com
`generation_meta.operation = 'variant'` e `parent_creative_id`.

## 4. Acabamento visual e usabilidade

- **Miniaturas** mostram o criativo inteiro (antes 9:16 e 16:9 perdiam a headline no
  recorte), com selo de formato, elevação no hover, ações que deslizam, entrada suave.
- **Menu do projeto**: ícones em telas médias (rótulo na aba ativa), pílula animada.
- **Transições** entre abas e etapas em CSS — não travam quando a aba do navegador fica
  em segundo plano (o framer-motion segurava a troca de tela até a animação terminar).
- **Ferramentas**: brilho da marca, entrada escalonada, **Continue de onde parou**
  (projetos recentes).
- **Login** com painel de apresentação animado.
- **Estados vazios** com orientação no Gerar, Galeria e Dinâmica.
- Placeholder de geração com brilho deslizante; tudo respeita "reduzir movimento".

## 5. Correções encontradas nos testes

- Modais das galerias acompanhavam o criativo **pela posição** na lista: ao entrar um
  criativo novo no topo (redimensionado, variação), o modal passava a mostrar outro.
  Agora acompanham pelo id (`useSelectedById`).
- pdf.js travava a leitura com a aba em segundo plano (usa `requestAnimationFrame`):
  renderização com `intent: 'print'`.
- Detecção de cor neutra: saturação HSL marcava quase-branco (#FEFEFF) como cor forte;
  trocada por croma.
- Vetorizador que não carrega agora falha na hora (PNG) em vez de esperar o limite.

## Modo demo

Tudo acima funciona em `npm run dev:demo` com respostas simuladas. Na Criação de KVs há
o botão **Usar materiais de exemplo (demo)** (brandbook PDF + logo gerados no navegador),
que só existe no modo demo.

## Verificação feita

- `tsc` sem erros; checagem de tipos das Edge Functions (Deno simulado) sem erros novos.
- `vitest`: 17 testes (12 do KV: cores/contraste, contrato, preenchimento das 38 páginas,
  imagens únicas, marcas quase quadradas, diretrizes; 4 da fila; 1 exemplo).
- Build de produção ok; o código do modo demo não entra no bundle.
- Fluxos testados no navegador (modo demo): KV completo com logo real (PNG transparente)
  e com logo de exemplo (fundo branco + símbolo), 38 páginas inspecionadas; salvar,
  aplicar ao Brand Kit; Copy; Variações e Comparar A/B.
- **Não testado com IA real** (a cópia segue sem `OPENROUTER_API_KEY`): a qualidade da
  análise depende do modelo configurado em Admin → Modelos de IA → `text_reasoning`
  (precisa aceitar imagens; os padrões aceitam).

## Reforço de UI e animações (manhã de 29/09)

Objetivo: deixar o uso da plataforma mais leve e fluido, sem pesar no carregamento.

- **Base (shadcn):** botões com resposta ao clique (`active:scale`) e brilho sutil no primário; diálogos e alertas com fundo desfocado, cantos maiores e entrada/saída mais suave; inputs, selects e textareas com hover e foco discretos; abas com transição de conteúdo; toasts em vidro no canto inferior direito.
- **Tokens (`src/index.css`):** hover neutro (menus não ficam mais amarelos ao passar o mouse), bordas levemente mais suaves, raio 10px, curvas de easing (`--ease-out`, `--ease-spring`), scrollbar fina, seleção de texto na cor da marca. Utilitários novos: `.card-hover`, `.glass`, `.stagger` (entrada em cascata) e `.btn-shine`.
- **Telas:** barra superior em vidro; sublinhado deslizante no seletor de modo de criação; troca de modo com fade; botão "Gerar" com brilho; Dashboard com números animados (`CountUp`) e cards em cascata; menu do Admin com pílula deslizante e troca de seção animada.
- **Acessibilidade:** tudo respeita `prefers-reduced-motion` (animações desligadas para quem prefere).
