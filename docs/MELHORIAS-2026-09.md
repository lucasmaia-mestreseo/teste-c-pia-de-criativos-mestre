# Melhorias — setembro/2026

Branch: `feature/redimensionar-desdobramento-custos-revisao`
Arquitetura geral: [ARQUITETURA.md](./ARQUITETURA.md)

## Resumo

| # | O quê | Tipo |
|---|---|---|
| 1 | Tela inicial **Ferramentas** (hub) | Feature |
| 2 | **Redimensionar** qualquer criativo gerado | Feature |
| 3 | **Desdobramento**: subir uma peça-mãe e gerar todos os formatos | Feature |
| 4 | **Revisão automática** de cada criativo + botão "Corrigir" | Feature |
| 5 | **Painel de Custos de IA** (Admin) | Feature |
| 6 | "Usar contexto" da aba Gerar passou a funcionar | Correção |
| 7 | Aba Dinâmica: formato, logo, briefing salvo e fim do estouro de tempo | Correção |
| 8 | Fim das novas tentativas multiplicadas (custo) | Correção |
| 9 | Formato enviado como parâmetro ao modelo de imagem | Melhoria |
| 10 | Cache da análise do logo | Melhoria (custo) |
| 11 | URLs de imagem assinadas no servidor (buckets privados) | Correção |
| 12 | Firecrawl/Perplexity funcionam com ou sem o gateway da Lovable | Melhoria |
| 13 | `extract-branding` por URL usa screenshot real | Correção |
| 14 | Botão "voltar" do navegador volta ao dashboard | Correção |
| 15 | Permissões nos botões da aba Dinâmica | Correção |
| 16 | Código compartilhado entre Edge Functions | Refatoração |

---

## Como colocar no ar (ordem importa)

1. **Aplicar a migration primeiro**:
   `supabase/migrations/20260929120000_resize_unfold_costs_review.sql`.
   As funções novas gravam colunas que só existem depois dela. Se o código for ao ar
   antes, **a geração de criativos falha** ao salvar no banco.
   - No Lovable: peça no chat *"aplique a migration
     supabase/migrations/20260929120000_resize_unfold_costs_review.sql"*, ou rode o
     SQL no editor SQL do Cloud.
   - A migration é idempotente (`IF NOT EXISTS`) e pode ser rodada de novo sem problema.
2. **Conferir o segredo `OPENROUTER_API_KEY`** no projeto. Na cópia de teste ele
   não foi salvo (ver `roadmap.md`), por isso nada de IA funciona lá ainda.
3. **Levar o código**: fazer merge do branch em `main` e dar push. A Lovable
   sincroniza o código e publica as Edge Functions, incluindo as novas
   `transform-creative` e `review-creative`.
4. **Regenerar os tipos (opcional)**: `src/integrations/supabase/types.ts` foi
   atualizado à mão com as colunas novas. Se a Lovable regenerar o arquivo depois
   da migration, o resultado deve ser equivalente.

### Como testar depois de publicar

- [ ] `/` mostra a tela Ferramentas; os cards abrem Geração de Criativos e Desdobramento (com escolha de projeto).
- [ ] Gerar um criativo → aparece o selo de revisão (girando, depois ✓ ou ⚠) na miniatura.
- [ ] Abrir o criativo → bloco **Revisão** com nota e problemas; **Corrigir** cria uma nova versão.
- [ ] **Redimensionar** → escolher 2 formatos → aparecem 2 criativos novos na galeria.
- [ ] Aba **Desdobramento** → subir uma imagem → formato detectado → gerar → resultados agrupados pela peça-mãe → "Baixar todos".
- [ ] Aba **Dinâmica** com 3+ criativos → barra de progresso, criativos aparecem um a um, no formato escolhido.
- [ ] Aba Gerar com **"Usar contexto"** ligado → o visual reflete o negócio do projeto.
- [ ] Admin → **Custos de IA** mostra gastos (só a partir desta versão).
- [ ] Botão "voltar" do navegador dentro de um projeto volta para a lista.

---

## Features

### 1. Tela inicial "Ferramentas"

Depois do login, `/` mostra cards com as ferramentas da plataforma: ícone, nome,
descrição e etiquetas, na identidade visual do app (fundo escuro, amarelo Mestre,
Space Grotesk). O dashboard de criativos passou para `/criativos`.

- **Adicionar uma ferramenta nova**: criar a ilustração em `src/components/ToolArt.tsx`
  e um item em `src/lib/tools.ts`. Com `path`, o card abre uma rota; com
  `projectPanel`, o card pede para escolher o projeto e abre `/project/:id/:painel`.
- O menu do usuário (avatar) virou `src/components/UserMenu.tsx`, reaproveitado no
  hub e no TopBar, e ganhou o item **Ferramentas**. O TopBar tem uma seta ‹ para
  voltar ao hub.

Arquivos: `src/pages/Home.tsx`, `src/lib/tools.ts`, `src/components/ToolArt.tsx`,
`src/components/UserMenu.tsx`, `src/App.tsx`, `src/components/TopBar.tsx`, `src/pages/Index.tsx`.

### 2. Redimensionar

No modal de qualquer criativo: **Redimensionar** → escolher formatos → (ajustes
opcionais) → cada formato vira um criativo novo, ligado ao original por
`parent_creative_id`.

- A IA recebe a peça original e instruções de **recomposição** (não é corte nem
  esticamento): mesmos textos, logo, pessoas, cores e hierarquia, com dicas por
  formato. No 9:16, por exemplo, os elementos ficam fora das zonas cobertas pela
  interface dos apps.
- Até 2 formatos são gerados em paralelo, cada um numa chamada separada, para não
  estourar o limite de tempo das funções.

Arquivos: `src/components/ResizeDialog.tsx`, `supabase/functions/transform-creative/` (`operation: "resize"`).

### 3. Desdobramento

Aba nova no projeto e card no hub. Sobe-se uma **peça-mãe**, que pode ser uma
imagem externa ou um criativo do projeto; o formato dela é detectado; escolhem-se
os formatos de saída; a IA gera a mesma peça em cada um.

- O upload vai para `generated-creatives/{projectId}/sources/…`.
- Os resultados (`kind = 'unfold'`) ficam agrupados pela peça-mãe
  (`source_image_url`), com **Baixar todos**.
- O servidor só aceita imagens de origem da pasta do próprio projeto.

Arquivos: `src/components/UnfoldPanel.tsx`, `src/components/UnfoldResultsPanel.tsx`,
`supabase/functions/transform-creative/` (`operation: "unfold"`).

### 4. Revisão automática

Cada criativo novo (Gerar, Dinâmica, Redimensionar, Desdobramento, Correção) passa
em segundo plano por uma IA de visão que confere:

- formato e cortes nas bordas;
- erros de texto, letras deformadas, "texto de IA";
- textos pedidos (prompt original ou briefing da Dinâmica);
- logo completo (quando foi pedido) e pessoa sem deformações;
- cores e tipografia do brand kit (só desvios evidentes);
- nos redimensionados e desdobrados, fidelidade à peça-mãe.

O resultado fica em `generated_creatives.review` / `review_status`
(`pending` → `approved` | `issues` | `error`). Um criativo é aprovado quando não
tem nenhum problema de severidade **alta**.

- **Selo na miniatura**: ✓ verde, ⚠ amarelo, girando = revisando.
- **Modal**: nota, resumo, lista de problemas, **Corrigir** (gera uma versão
  editada com `kind = 'fix'`, que também é revisada) e **Revisar de novo**.
- A revisão usa a vaga `vision_analysis` (modelo barato) e **nunca bloqueia** a
  geração: se falhar, o status vira `error` e é possível tentar de novo.

Arquivos: `supabase/functions/review-creative/`, `src/components/CreativeInsights.tsx`,
`src/lib/creativeOps.ts`.

### 5. Painel de Custos de IA (Admin → Custos de IA)

Versão leve: período de 7, 30 ou 90 dias; cards com gasto total, chamadas (e
quantas deram erro), criativos gerados e custo médio por criativo; tabelas por
projeto, por recurso, por modelo e por origem do criativo.

- Toda chamada ao OpenRouter pede `usage: { include: true }` e grava uma linha em
  `ai_usage` com custo, tokens e duração. Uma falha nesse registro nunca quebra
  a geração.
- `generated_creatives.cost_usd` guarda o custo da imagem de cada criativo, com
  todas as tentativas. O custo aparece também no modal do criativo.
- Só administradores leem `ai_usage` (RLS). Os dados começam a partir desta versão.

Arquivos: `src/components/admin/CostsTab.tsx`, `src/pages/Admin.tsx`, `_shared/openrouter.ts`.

---

## Correções e melhorias

### 6. "Usar contexto" na aba Gerar
**Antes:** a tela enviava `ignoreContext`, mas o `generate-creative` nunca lia o
contexto nem o tom de voz do projeto. **Agora:** quando ligado, entra no prompt
uma seção "Contexto do projeto" (resumida), com a instrução de **não** inventar
textos a partir dela.

### 7. Aba Dinâmica
- **Antes:** até 15 criativos em sequência numa única chamada, que caía no limite
  de ~150 s. **Agora:** uma chamada por criativo (2 em paralelo), com barra de
  progresso; os criativos aparecem conforme ficam prontos e uma falha não derruba
  o lote. A função também tem uma trava de tempo para lotes antigos.
- O **formato** escolhido agora vai para a IA de imagem; antes só era salvo no banco.
- **Logo** do brand kit incluído (opção "Incluir logo").
- **Briefing completo** salvo em `generated_creatives.briefing` (antes só o título).
- O placeholder de "gerando" agora aparece no painel de resultados.

### 8. Novas tentativas multiplicadas
**Antes:** o front tentava de novo até 2 vezes, e em cada vez o servidor testava
até 4 modelos, ou seja, até 8 gerações de imagem pagas por clique.
**Agora:** quando o servidor já esgotou a cascata de modelos, o front não repete
(`src/lib/invokeWithRetry.ts`). Erros de rede e limite de requisições (429) continuam
sendo repetidos.

### 9. Formato como parâmetro
Todas as gerações de imagem enviam `image_config.aspect_ratio` (ex.: `9:16`), além
do texto no prompt. Modelos que aceitam o parâmetro respeitam o formato com mais
precisão; os outros ignoram.

### 10. Cache da análise do logo
**Antes:** cada geração com logo pagava uma chamada de visão para descrever o
logo. **Agora:** a análise fica em `brand_kits.logo_analysis`, com a chave
`logo_analysis_source` apontando para o arquivo, e só é refeita quando o logo muda.

### 11. URLs assinadas no servidor
Os buckets são privados. Anexos do Prompt Livre eram enviados em formato de URL
pública, que o provedor de IA não consegue abrir. O `generate-creative` agora
assina no servidor as URLs de imagem **da pasta do próprio projeto**. URLs de outros
projetos não são assinadas, para não dar acesso cruzado.

### 12. Firecrawl / Perplexity
`_shared/connectors.ts` usa o gateway de conectores da Lovable quando
`LOVABLE_API_KEY` existe e cai para a API direta quando não existe ou falha.
O `extract-context` deixou de exigir `LOVABLE_API_KEY`, o Perplexity virou
opcional, e contexto e tom de voz são gerados em paralelo (mais rápido).
O `extract-design-system` usa o mesmo helper (Firecrawl v2).

### 13. `extract-branding` por URL
Quando recebia uma URL, mandava só o texto do endereço para a IA, que não navega
e acabava inventando as cores. Agora tira um screenshot do site com o Firecrawl.
Hoje a interface só usa esse caminho com screenshot; o fluxo por URL passa pelo
`extract-design-system`.

### 14. Botão voltar
Em `Index.tsx`, voltar de `/project/...` para a lista não limpava o projeto
selecionado (havia um `if` vazio). Corrigido, e o reset de estado repetido virou
uma função só.

### 15. Permissões na aba Dinâmica
Os botões Favoritar, Download e Excluir apareciam para todos. Agora seguem as
mesmas permissões dos outros painéis.

### 16. Código compartilhado nas Edge Functions
- `_shared/http.ts`: CORS e respostas JSON.
- `_shared/storage.ts`: upload, assinatura de URLs e limpeza de metadados de PNG
  (antes copiada em 2 funções; a Dinâmica nem limpava).
- `_shared/openrouter.ts`: `generateImageWithCascade` substitui 4 laços de geração
  quase iguais; `parseToolCall` lê respostas estruturadas.

---

## Banco de dados (migration `20260929120000`)

- `generated_creatives`: + `kind`, `parent_creative_id`, `source_image_url`,
  `model_used`, `cost_usd`, `briefing`, `generation_meta`, `review`, `review_status`
  (com checks e índices). Os criativos antigos da Dinâmica recebem `kind = 'dynamic'`.
- `brand_kits`: + `logo_analysis`, `logo_analysis_source`.
- Nova tabela `ai_usage` com RLS: leitura só para administradores; escrita só pelas
  Edge Functions (service role).

## Verificação feita

- `tsc` do frontend: sem erros.
- Checagem de tipos das Edge Functions (Deno simulado): sem erros nos arquivos
  alterados. Os 2 erros restantes (`admin-resend-confirmation`, `admin-reset-password`)
  já existiam.
- `eslint`: nenhum arquivo existente ganhou erro; os arquivos novos estão limpos.
- `vite build`: ok.
- `vitest`: 5 testes passando (4 novos em `src/test/creativeOps.test.ts`).
- Revisão visual: tela Ferramentas (desktop e celular), Desdobramento, bloco de
  revisão e Painel de Custos (com dados fictícios).
- **Ainda não testado de ponta a ponta com a IA**: a cópia não tem
  `OPENROUTER_API_KEY` e a migration não foi aplicada. Use o checklist acima.

## Limitações e próximos passos

- A qualidade do Redimensionar e do Desdobramento depende do modelo de imagem. Vale
  comparar os modelos em Admin → Modelos de IA com peças reais.
- A revisão aponta problemas, mas a correção é outra geração e pode introduzir
  novos detalhes. Por isso ela também é revisada.
- Gerações longas continuam dependentes de a aba ficar aberta. O próximo passo
  natural é uma **fila de geração em segundo plano**.
- Custos anteriores a esta versão não existem no painel.
