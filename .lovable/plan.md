

# Melhor Tratamento de Erros + Log Administrativo

## Problema
1. Erros de edge functions mostram apenas "Edge Function returned a non-2xx status code" — sem contexto
2. As chamadas a `generate-creative` e `generate-dynamic-creative` no frontend **não usam** `invokeWithRetry` — falham na primeira tentativa sem retry
3. Não existe log de erros para debugging futuro

## Solução

### 1. Tabela `error_logs` no banco
Nova tabela para registrar todos os erros de geração:

| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| user_id | uuid |
| project_id | uuid (nullable) |
| function_name | text |
| error_message | text |
| error_details | jsonb (nullable) |
| created_at | timestamptz |

RLS: SELECT apenas para admins (`has_any_admin_role`). INSERT para qualquer autenticado.

### 2. Melhorar `invokeWithRetry` para logar erros
Após esgotar todas as tentativas, registrar o erro automaticamente na tabela `error_logs` com: função, mensagem, detalhes (status code, attempt count).

### 3. Usar `invokeWithRetry` em `GenerationControls.tsx` e `DynamicGeneratePanel.tsx`
Substituir as chamadas diretas a `supabase.functions.invoke` por `invokeWithRetry`, ganhando retries automáticos + log de erros.

### 4. Mensagens de erro mais descritivas no frontend
Mapear erros conhecidos (429 = rate limit, 402 = créditos, 500 = erro interno) para mensagens amigáveis em português.

### 5. Seção "Logs de Erros" no painel admin
Adicionar nova seção na sidebar do Admin (`error-logs`) com:
- Lista paginada dos erros mais recentes
- Filtro por função e por usuário
- Exibição de detalhes em JSON expandível

## Arquivos

| Acao | Arquivo |
|------|---------|
| Migração | Criar tabela `error_logs` + RLS |
| Editar | `src/lib/invokeWithRetry.ts` — adicionar log de erro no banco após falha |
| Editar | `src/components/GenerationControls.tsx` — usar `invokeWithRetry` |
| Editar | `src/components/DynamicGeneratePanel.tsx` — usar `invokeWithRetry` |
| Editar | `src/pages/Admin.tsx` — adicionar seção "Logs de Erros" |

