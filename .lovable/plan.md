
## Painel de Análises (Admin)

Nova seção no Admin com duas sub-telas navegáveis por abas/rotas: **Análise de Time** e **Análise de Clientes**. Dados vêm de `generated_creatives` cruzado com `projects` (nome) e `profiles` (nome do analista via `created_by`).

Visível somente para `owner`/`admin` (mesma regra dos outros tabs restritos).

---

### 1. Estrutura de navegação

- Adicionar item **"Análises"** na navegação do `src/pages/Admin.tsx` (owner/admin).
- Duas sub-abas internas:
  - `Análise de Time`
  - `Análise de Clientes`
- Componentes novos em `src/components/admin/`:
  - `AnalyticsTeamTab.tsx`
  - `AnalyticsClientsTab.tsx`
  - `AnalyticsFilters.tsx` (compartilhado: período + projeto + usuário)

### 2. Filtros compartilhados (`AnalyticsFilters`)

- **Período**: botões rápidos `Hoje | 7D | 30D | 90D | Personalizado`. Personalizado abre `DateRangePicker` (shadcn Calendar em `mode="range"`).
- **Projeto**: combobox com busca (padrão do TopBar) listando projetos ativos.
- **Usuário**: combobox com busca listando perfis (`profiles.name`).
- Estado local por tab; padrão inicial `30D`, projeto = todos, usuário = todos.

### 3. Fonte de dados

Uma query base em `generated_creatives` por tab, filtrando `created_at` no intervalo + `project_id` (se selecionado) + `created_by` (se selecionado). Join manual client-side:

- `projects`: `id, name, active` (já cacheado via `useProjects`).
- `profiles`: `user_id, name` (novo hook `useProfilesLite`).

Sem migração de banco — todos os dados já existem. Agregação feita no cliente com `useMemo` (volume esperado: baixo, filtrado por período).

### 4. Tela: Análise de Time

Três gráficos usando `recharts` (já no projeto via shadcn):

1. **Criativos por dia** — `LineChart` (ou `BarChart`) com uma barra/ponto por dia no período selecionado. Bucket por dia local; dias sem dados = 0.
2. **Top 10 clientes** — `BarChart` horizontal: eixo Y = nome do projeto, eixo X = contagem de criativos no período.
3. **Top 10 analistas** — `BarChart` horizontal: eixo Y = nome do analista (`profiles.name`), eixo X = contagem.

Cabeçalho com KPIs simples: total de criativos, analistas ativos, projetos ativos no período.

### 5. Tela: Análise de Clientes

- **Criativos por dia** — mesmo gráfico da tela de time, respeitando os filtros.
- **Saúde dos clientes** — lista/tabela de **todos os projetos ativos** (`projects.active = true`) com a data do último criativo (`max(created_at)` em `generated_creatives` por `project_id`, sem aplicar o filtro de período — precisa da visão histórica pra classificar).

Classificação por dias desde o último criativo:
- `≤ 14 dias` → badge verde **Dentro do esperado**
- `> 14 e ≤ 30 dias` → badge amarelo **Atenção**
- `> 30 dias ou nenhum criativo` → badge vermelho **Crítico / Abandonado**

Colunas: Projeto | Último criativo (data + "há X dias" ou "nunca") | Status. Ordenação padrão: mais críticos primeiro. Agrupar visualmente em três seções colapsáveis por status, com contagem no header.

Observação: nesta tela o filtro de período afeta apenas o gráfico "Criativos por dia"; o filtro de projeto filtra a tabela; o filtro de usuário afeta o gráfico (não a tabela de saúde).

### 6. Detalhes técnicos

- Queries via `@tanstack/react-query` com `queryKey` incluindo período/projeto/usuário para cache correto.
- Datas: usar `date-fns` (já no projeto): `startOfDay`, `subDays`, `format`, `differenceInDays`.
- Gráficos: `recharts` (`ResponsiveContainer`, `BarChart`, `LineChart`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`) com cores do design system (`hsl(var(--primary))`, `hsl(var(--muted-foreground))`).
- Sem hardcode de cor; nada de `text-white`/`bg-black`.
- Restrição de acesso: reaproveitar checagem `role === 'owner' || role === 'admin'` já usada no Admin.

### 7. Arquivos

- `src/pages/Admin.tsx` — novo item de menu "Análises" + roteamento das sub-abas.
- `src/components/admin/AnalyticsFilters.tsx` — novo.
- `src/components/admin/AnalyticsTeamTab.tsx` — novo.
- `src/components/admin/AnalyticsClientsTab.tsx` — novo.
- `src/hooks/useAnalytics.ts` — novo (queries `generated_creatives` por período + hook `useProfilesLite`).
