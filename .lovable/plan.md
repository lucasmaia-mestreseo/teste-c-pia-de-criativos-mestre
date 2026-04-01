

# Corrigir Dashboard — `created_by` NULL

## Problema raiz

A edge function `generate-creative` **não extrai o usuário autenticado** e insere criativos sem `created_by`. Todos os 29 criativos existentes têm `created_by = NULL`. O dashboard filtra por `created_by = user.id`, logo retorna zero.

## Correções

### 1. Edge function `generate-creative` — adicionar `created_by`

**Arquivo:** `supabase/functions/generate-creative/index.ts`

No início do handler (após `req.json()`), extrair o usuário autenticado do header de autorização (mesmo padrão já usado em `generate-dynamic-creative`):

```typescript
const authHeader = req.headers.get("Authorization");
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await anonClient.auth.getUser();
```

Na inserção (linha ~647), adicionar `created_by: user?.id ?? null`.

### 2. Migration — preencher `created_by` nos registros existentes

Criar migration que atualiza os registros NULL com base em algum critério. Como não há como saber quem gerou retroativamente, a abordagem mais segura é associar ao owner/admin. Alternativa: deixar como estão e ajustar o dashboard para também mostrar criativos sem `created_by`.

### 3. Dashboard — mostrar criativos sem `created_by` (solução imediata)

**Arquivo:** `src/hooks/useDashboardStats.ts`

Remover o filtro `.eq('created_by', user!.id)` de todas as queries. Isso faz o dashboard mostrar **todos os criativos visíveis** (RLS já controla acesso). Criativos antigos (sem `created_by`) e novos (com `created_by`) aparecerão.

Alternativamente, usar `.or(\`created_by.eq.${user!.id},created_by.is.null\`)` para incluir ambos.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/generate-creative/index.ts` — extrair user e passar `created_by` |
| Editar | `src/hooks/useDashboardStats.ts` — remover filtro por `created_by` ou usar `.or()` |

