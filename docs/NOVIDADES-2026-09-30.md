# Novidades — 30/09/2026: versão de testes para a equipe

| # | O quê | Onde |
|---|---|---|
| 1 | **Desdobramento em lote** (até 10 peças) e formato **1200×628** | Desdobramento |
| 2 | Desdobramento/Redimensionar com **Nano Banana 2** (cascata própria) | Admin → Modelos de IA |
| 3 | **Projetos organizados**: criar de qualquer ferramenta; Últimos editados / Meus / Todos | Tela inicial e seletor de projeto |
| 4 | **Guia de marca ativo** por campanha (manual da Criação de KVs) | KVs · selo em Gerar e Desdobramento |
| 5 | Correção: **permissões** de quem não é admin | Todos os botões |
| 6 | Aviso de **Versão de testes** e Notas de versão atualizadas | Cabeçalho e pop-up |

## Como colocar no ar (Lovable)

1. **Migration nova**: `20260930120000_projects_created_by.sql` — só adiciona a coluna
   `projects.created_by` (quem criou). Peça à Lovable para aplicar. Sem ela tudo funciona; "Meus
   projetos" mostra só os criados neste navegador.
2. **Edge Functions**: nova `my-permissions`; alteradas `transform-creative` (lote, 1200×628,
   guia de marca, cascata `image_unfold`) e `_shared/openrouter.ts`. Nova `_shared/imageFit.ts`
   (recorte exato, usa `imagescript` do deno.land).
3. **Secrets**: `OPENROUTER_API_KEY` (já configurada).
4. **Publicar** (botão Publish). A Edição de Vídeo aparece como **Em breve**.

## Contas de teste para a equipe

O login continua. Para criar as contas: **Admin → Usuários → Convidar usuário** com o e-mail
`@agenciamestre.com` de cada pessoa. O convite chega por e-mail (a pessoa define a senha) e a conta
já nasce **aprovada** com o papel *analyst*. Para que possam **criar projetos** e editar Brand Kit,
troque o papel para **manager** na mesma tela.

## Detalhes

### 1. Desdobramento em lote e 1200×628
- Várias peças-mãe (até 10), cada uma nos formatos marcados; o formato que a peça já tem é pulado.
  3 versões em paralelo, progresso por peça, botão para refazer só as que falharam.
- **1200×628**: os modelos só aceitam proporções padrão, então a peça é gerada em 16:9 com
  instrução de margem e recortada no servidor para 1200×628 exatos.

### 2. Nano Banana 2
Chave de modelos `image_unfold` (Desdobramento e Redimensionar): primário
`google/gemini-3.1-flash-image-preview`, fallback `openai/gpt-5.4-image-2`. Editável em
Admin → Modelos de IA → "Desdobramento e Redimensionar".

### 3. Projetos
- Um seletor único (Gerar, Desdobramento, KVs): **Criar novo projeto** no topo (só o nome), busca e
  abas **Recentes / Meus projetos / Todos**. O mesmo seletor abre pelo nome do projeto no topo.
- Tela inicial: seção **Projetos** com Últimos editados, Meus projetos, Todos e **Novo projeto**.
- Projeto novo abre direto na ferramenta: o onboarding (Brand Kit + contexto) só aparece em Gerar
  e Dinâmica. Trocar de projeto mantém a ferramenta aberta.

### 4. Guia de marca ativo (campanhas)
- Ao salvar o manual: nome da **campanha** (padrão "Guia principal") e **Usar como guia ativo**
  (ligado). Ativar leva cores, tipografia, logo, tom de voz e regras visuais ao Brand Kit/Contexto e
  tira o projeto do onboarding.
- KVs → "Guias de marca deste projeto": um por campanha, com **Ativar** para trocar.
- Selo "Guia: campanha · marca" no topo de Gerar e do Desdobramento; o Desdobramento usa as
  diretrizes do guia ao recompor (sem mudar os textos da peça).

### 5. Permissões
`role_permissions` só é legível por admins (RLS), então managers/analysts viam os botões
desativados. A nova função `my-permissions` devolve as permissões da própria pessoa.
