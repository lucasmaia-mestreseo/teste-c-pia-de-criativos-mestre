

# Ajustes na área administrativa: Projetos e Uso do Sistema

## AJUSTE 01 — Projetos

### Filtros e paginação
- Adicionar campo de busca por nome de projeto (Input com ícone de lupa)
- Adicionar filtro por status: Todos / Ativos / Inativos (botões toggle ou Select)
- Implementar paginação client-side com estado `page` e `perPage`
- Dropdown para selecionar linhas por página: 25, 50, 100, 250
- Componente de paginação (Anterior/Próximo + indicador de página)

### Layout
- Separar o botão "Criar novo projeto" do filtro — colocá-lo acima ou ao lado direito, com os filtros em uma linha abaixo

### Lógica
- Filtrar `projects` localmente com `useMemo` baseado em busca + status
- Paginar o resultado filtrado com `slice()`

## AJUSTE 02 — Uso do Sistema

### Ordenação e filtro
- Ordenar por nome do usuário (alfabeticamente) em vez de por contagem
- Adicionar campo de busca para filtrar por nome/email do usuário

### Downloads
- Criar tabela `user_downloads` no banco com colunas: `id`, `user_id`, `creative_id`, `created_at`
- Adicionar RLS: usuários autenticados podem inserir seus próprios downloads; admins podem ver todos
- No frontend, registrar um INSERT nessa tabela toda vez que um download ocorrer (identificar onde o download acontece no código — provavelmente em `CreativesPanel` ou similar)
- No `UsageTab`, buscar contagem de downloads por usuário no período e exibir na listagem

### Favoritos
- No `UsageTab`, buscar contagem de `generated_creatives` com `favorite = true` por `created_by` e exibir na listagem

### Período
- Manter os filtros Hoje / Últimos 7 dias / Último mês (já existem)

## Migração de banco

```sql
CREATE TABLE public.user_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creative_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own downloads"
  ON public.user_downloads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all downloads"
  ON public.user_downloads FOR SELECT TO authenticated
  USING (has_any_admin_role(auth.uid()));
```

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Criar tabela `user_downloads` com RLS |
| Editar | `src/pages/Admin.tsx` — `ProjectsTab`: filtros, paginação, separar botão criar |
| Editar | `src/pages/Admin.tsx` — `UsageTab`: ordenar por nome, filtro busca, exibir downloads e favoritos |
| Editar | Componentes de download (identificar e adicionar INSERT em `user_downloads`) |
| Editar | `src/integrations/supabase/types.ts` — será atualizado automaticamente |

