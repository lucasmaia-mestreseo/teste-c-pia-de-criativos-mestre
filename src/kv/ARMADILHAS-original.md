# Armadilhas

Tudo aqui custou tempo de verdade na primeira vez. Nenhuma é óbvia e todas
mordem exatamente uma vez — leia antes de mexer no template ou no export.

## Exportação para PDF

**Não misture tamanhos de `@page`.** Com tamanhos diferentes de página no mesmo
documento, o motor perde o alinhamento e o conteúdo escorrega de uma página para
a outra: o PDF sai com menos páginas do que slides e tudo desalinhado. Se algum
conteúdo não couber em 16:9, divida em duas páginas 16:9 — não crie uma página
mais alta.

**Declare a página em px, não em polegadas.** `@page{size:1920px 1080px}`. Em
polegadas o resultado depende do mapeamento px→polegada do navegador, que nem
sempre é 96 px/in; quando não é, sobra uma faixa branca à direita e embaixo e o
conteúdo aparece reduzido a ~89%.

**Mockups usam `zoom`, nunca `transform: scale()`.** `transform` não reduz a
caixa de layout: um mock de 1920 px continua ocupando 1920 px no fluxo, o canvas
de impressão fica mais largo que a página e o navegador encolhe o **documento
inteiro** para caber. `zoom` reduz a caixa junto com o desenho.

**Nada de degradê com transparência.** `linear-gradient` com `rgba(...,0)` vira
um *shading* no PDF que nem todo rasterizador reproduz — já saiu uma foto inteira
em rosa choque. Véu sobre imagem: cor sólida com `rgba()`, sem degradê.

**A quebra de página fica no contêiner externo** (`.frame`), não no slide. Assim
não depende de como o motor trata `break-after` dentro de um elemento clipado.

## O script de export

**`Start-Process -Wait`, não `& $browser`.** Chamado direto, o Edge se desanexa e
o script segue antes do PDF existir.

**Aspas nos caminhos.** `--user-data-dir="$perfil"`. Sem aspas, um espaço no
caminho ("Lucas Maia", "Claude Code") quebra o argumento em dois e o navegador
responde *"Multiple targets are not supported in headless mode"*.

**Perfil descartável por execução.** Um perfil fixo fica travado por instâncias
headless anteriores e o navegador sai sem gerar nada.

**Não redirecione a saída para `$null`** no Windows PowerShell 5.1 — interfere na
execução do processo nativo. Capture em variável.

## Arquivos que o cliente envia

**Confira o que o arquivo é, não o que o nome diz.** `tools/sniff.mjs` lê os
primeiros bytes. Já chegaram: `.svg` que eram PNG, `.ai` que eram PNG, `.pdf` que
eram JPEG e `.eps` que eram SVG. Anexo solto em chat costuma ser transcodificado
— **peça sempre dentro de um `.zip`**.

**Teste as fontes antes de confiar.** `tools/probe-fonts.mjs`. Já veio um pacote
com Regular e Italic trocados: o `Regular.ttf` continha a itálica. O manual
inteiro saiu em itálico e ninguém notou de primeira. O script mostra quais
carregam e desenha um specimen de cada arquivo.

**Sem `format()` no `@font-face`.** Uma dica de formato errada (dizer
`truetype` para um arquivo OpenType/CFF) é motivo para o navegador descartar a
fonte. Deixe o navegador farejar.

## Layout

**`overflow:hidden` no corpo do slide.** É a trava: se um bloco crescer demais,
ele é cortado em vez de invadir o rodapé. A área útil é ~724 px (1080 − 130 de
rodapé − 170 de cabeçalho − 56 de respiro).

**Bloco de "Orientações de uso" é grid, não flex.** Com flex, um segundo `<p>`
vira mais uma *coluna* da linha e o texto se parte em duas colunas lado a lado.

**Logo: defina uma dimensão só.** Largura **ou** altura, nunca as duas — a outra
sai da proporção real medida com `tools/bands.mjs`. É o que impede o logo de
sair achatado.

**Recorte de foto se calcula, não se chuta.** Quando a caixa é mais larga que a
origem, o navegador usa a largura toda e corta a altura: só o eixo Y importa e
ele precisa ficar **acima** do topo da cabeça. Numa foto onde a cabeça começa a
25% da altura, ancorar em 30% (o valor intuitivo) corta a cabeça.

## Marcas com proporção diferente

**Meça cada variante, não uma só.** No pacote do CTD, o `viewBox` tinha folga
grande e **a posição da arte variava entre as variantes** — aplicar o recorte de
uma na outra desalinha. Meça arquivo por arquivo, sobre fundo cinza médio (assim
a mesma medição serve para arte escura e para a branca).

**Marca quase quadrada pede especificação por ALTURA.** Com razão perto de 1:1,
fixar largura produz alturas muito diferentes entre as versões com e sem slogan —
a marca perde peso visual constante e estoura contêineres de altura fixa, como o
cabeçalho de 100 px da landing page. Fixe altura e deixe a largura seguir.

**Nem toda marca tem símbolo isolado.** Se o símbolo é integrado ao lettering
(a seta do CTD atravessa o "d"), não existe recorte retangular que o separe. Nesse
caso a "versão reduzida" é a assinatura sem slogan — adapte as páginas em vez de
forçar um símbolo que a marca não tem.

**Cheque o contraste da cor de acento antes de usá-la em botão.** Laranja
`#F58634` com texto branco dá 2,4:1 e reprova; com o azul institucional dá 4,9:1.
Se a marca anterior usava vermelho escuro, o botão herdado vai parecer certo e
estar errado.

**Duplicação de assinatura nos mockups.** O template traz marca no topo e símbolo
no rodapé da mesma peça. Se a marca não tem símbolo e as duas posições recebem o
mesmo logotipo, a peça contradiz a norma que o próprio manual escreve na página
anterior. Revise cada mockup.

## Texto sobre fotografia

**Bloco de cor ao LADO da foto, não sobre ela.** Um painel sólido sobreposto tem
borda dura, e essa borda cai no meio de alguém — corta o retratado justamente na
página que ensina enquadramento. Em colunas separadas, a foto tem a própria caixa
e ninguém é fatiado. Véu por cima só quando o texto precisa mesmo ficar sobre a
imagem, e então cobrindo apenas a faixa do texto.

**Véu cobrindo a foto inteira anula a foto.** A 78% de opacidade a imagem vira um
retângulo colorido com pessoas fantasmas atrás. Se o objetivo da página é
demonstrar enquadramento, ela passa a não demonstrar nada.

**A legenda tem que descrever o que a página mostra.** Ao trocar véu por bloco
lateral, a legenda e a nota de orientação também mudam — senão o manual descreve
uma técnica e ilustra outra.

## Substituição de texto em lote

**Curinga não atravessa contexto impunemente.** `/\.btn\{([\s\S]*?)color:#fff;/`
parece seguro, mas se o bloco `.btn` já não contiver `color:#fff;` o curinga segue
documento adentro até achar o próximo — que pode ser o título de uma página, a
quilômetros de distância. Ancore no bloco, use limites estreitos ou faça a edição
pontual. Depois de qualquer substituição em lote, **procure o padrão antigo e
confirme quantas ocorrências sobraram.**

## Resíduo de marca anterior

**O template carrega texto de quem veio antes — procure antes de entregar.**
Marcadores `«»` só pegam o que alguém lembrou de marcar. O que ficou cravado na
prosa passa despercebido: "azul institucional", "arquétipo do Sábio", "No lugar
de Gotham", cards de landing page falando de ERP. Isso vazou para três manuais
seguidos antes de ser notado. Depois de preencher, rode:

```
grep -o -i -E "azul|Sábio|Gotham|Quicksand|ERP|SISPRO|<marca anterior>" index.html
```

Qualquer ocorrência que não seja da marca atual é resíduo.

**"Zero marcadores" não é "zero resíduo".** São verificações diferentes. Um
manual pode sair com 0 marcadores e ainda falar de uma cor que a marca não tem.

## Fotos vindas de PDF de gráfica

**Imagem CMYK extraída crua sai com as cores invertidas.** Portfólio feito no
InDesign embute JPEG em CMYK; `pdfimages -all` grava o arquivo original e o
navegador decodifica como negativo. Use `pdfimages -png`, que converte para RGB.

**Duas pessoas numa caixa larga podem simplesmente não caber.** Meça a altura que
os rostos ocupam na foto e compare com a altura que a caixa consegue mostrar
(largura da foto ÷ proporção da caixa). Se os rostos forem mais altos que isso,
nenhuma âncora resolve — mude a proporção da caixa. Chutar a âncora foi o que
cortou o rosto no story do Mundo Apto.

## Marca sem manual

**Quando só existe peça aprovada, a fonte embutida é a prova da tipografia.**
`pdffonts` lista as famílias de cada PDF; se o portfólio e o e-book usam a mesma,
isso é norma de fato. Registre de onde veio cada decisão — cor, fonte, logo — no
README, porque ninguém vai lembrar depois.

**Cor inferida é proposta, mesmo quando é óbvia.** Recolorir um PNG branco para
o laranja da marca funciona, mas não é arquivo oficial. Diga isso no documento.

**Criativo em imagem não tem fonte embutida.** Recorte uma linha do texto e
compare, na mesma escala, com as candidatas lado a lado. É inferência: diga isso
na p.08 e no README.

**A versão branca pode estar dentro de um criativo.** Quando só vem o logo
colorido, procure nas peças aprovadas: sobre um fundo liso, uma chave por
luminância tira a versão negativa que a marca realmente usa.

**Símbolo colado no logotipo: separe por componentes, não por retângulo.** Se o
símbolo encosta na primeira letra, um recorte reto leva um pedaço dela junto.
Rotule os componentes conectados do alfa e fique só com os que começam à
esquerda do limite.

**Guia em PDF com fonte Type 3 engana o render.** O `pdf-to-img` troca glifos
Type 3 sem nome por fonte de sistema — a amostra "Syne" sai em outra família.
Para ver a tipografia real, renderize com `pdftocairo -png`.

**PDF "compactado" do Canva é uma pilha de imagens.** `pdffonts` vem vazio e
`pdfimages -list` mostra uma imagem de 1920 × 1080 por página: não há vetor nem
texto. Ainda assim, hex e nomes de fonte costumam estar **escritos** na página —
leia, e confira a cor no pixel. Poppler também não abre caminho com parênteses
no nome ("(1).pdf"): copie para um nome simples antes.

**Logo de duas cores sobre branco: separe por tinta, não por limiar.** Para cada
pixel, resolva `pixel = a·tinta + (1−a)·branco` por mínimos quadrados para cada
cor da marca e fique com a de menor resíduo. Sai um alfa por cor, com
antisserrilhado — e as variantes (negativa, monocromática) viram só troca de cor
por camada.

**Recorte de diagrama traz as legendas junto.** Ao reaproveitar o desenho de uma
página de conceito como grafismo, apague as legendas antes: a 20% de opacidade
ninguém nota na hora, mas a palavra aparece no mockup.

## Ordem das trocas no script de preenchimento

**Uma troca feita antes de outra enxerga o HTML antigo.** Se o script converte
`.svg` → `.png` no meio do caminho, o padrão de uma troca anterior precisa casar
com `.svg`. Use `\.(?:svg|png)` ou rode a troca depois — e confira o log: um
`FALHOU` nunca é detalhe.

**Todo mockup de "baixo contraste" precisa mostrar alguma coisa.** Logo da mesma
cor do fundo não ilustra contraste baixo, ilustra um retângulo vazio. Escolha um
fundo próximo, não idêntico.

## Verificação

Depois de exportar, sempre:

```
node tools/render.mjs Manual.pdf ./out 1 40 0.9    # PDF -> PNG
node tools/sheet.mjs ./out ./sheet 3 2 620         # contact sheets
node tools/extent.mjs ./out/001.png                # deve dar 100% x 100%
```

`extent.mjs` abaixo de 100% significa que o documento foi encolhido — procure
algo mais largo que 1920 px (quase sempre um mock com `transform`).
