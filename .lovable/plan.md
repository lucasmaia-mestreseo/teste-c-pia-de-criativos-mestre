# Diagnóstico do erro 429 e plano de correção

## O que encontrei agora

Nos registros da aplicação, o erro recorrente não parece ser falta de saldo/crédito da conta. O padrão é outro:

- Nas últimas 12 horas há 11 ocorrências de erro `429` em `generate-creative`.
- O erro começou por volta de `30/04/2026 08:41` no horário local mostrado no admin.
- Os erros ficaram concentrados em alguns usuários/projetos:
  - `sofia.botelho@agenciamestre.com` — principalmente projeto `ILM`
  - `samara.dasmim@agenciamestre.com` — projeto `ForLife Imóveis`
  - `fabioricotta@agenciamestre.com` — projeto `Agência Mestre`
- Não encontrei criativos gerados nas últimas 12 horas, então a geração está falhando antes de salvar a imagem.
- Os logs técnicos da função mostram apenas `Attempt 1/3 with model google/gemini-3.1-flash-image-preview`, sem registrar o corpo real retornado pelo provedor de IA.

## Causa mais provável

O `429` está vindo do serviço de IA usado pela geração de imagem, não de uma regra de saldo da conta.

Hoje o fluxo faz isto:

1. A função `generate-creative` chama o modelo de imagem `google/gemini-3.1-flash-image-preview`.
2. Se a IA responde `429`, a função retorna imediatamente `429` para o frontend.
3. O frontend recebe apenas a mensagem genérica `Edge Function returned a non-2xx status code`.
4. O `invokeWithRetry` tenta chamar a edge function novamente, mas sem saber o motivo real e sem respeitar `Retry-After`.
5. O log administrativo salva só `status: 429`, sem o corpo do erro, sem modelo, sem etapa, sem request id e sem detalhes do provedor.

Ou seja: mesmo com saldo em dia, pode existir limite temporário/capacidade/congestionamento do modelo de imagem ou do gateway de IA. O app está mascarando esse detalhe e repetindo a chamada de uma forma pouco inteligente.

## Plano de correção

### 1. Melhorar o log dentro da função `generate-creative`

Editar `supabase/functions/generate-creative/index.ts` para capturar e registrar dados reais quando a chamada à IA falhar:

- status HTTP retornado pela IA
- corpo bruto do erro, quando existir
- cabeçalhos úteis, como `retry-after`, `x-request-id`, `x-ratelimit-*`, quando existirem
- modelo usado (`google/gemini-3.1-flash-image-preview` ou fallback)
- tentativa atual
- etapa do erro (`logo-analysis`, `image-generation`, `upload`, `database-insert`)
- modo de geração (`free`, `templates`, `swipe`)
- projeto e usuário
- quantidade de imagens de referência/anexos, sem salvar o prompt completo

Assim o admin deixa de mostrar só:

```json
{
  "status": 429,
  "original_message": "Edge Function returned a non-2xx status code"
}
```

e passa a mostrar algo como:

```json
{
  "source": "ai_gateway",
  "stage": "image-generation",
  "status": 429,
  "model": "google/gemini-3.1-flash-image-preview",
  "attempt": 1,
  "retry_after": "60",
  "provider_body": "...mensagem real retornada pela IA...",
  "request_id": "..."
}
```

### 2. Não retornar imediatamente no primeiro 429 da IA

Hoje a função aborta no primeiro `429`. Vou alterar para:

- Ler o corpo do erro da IA.
- Se for `429`, aguardar usando `Retry-After` quando o cabeçalho existir.
- Se não existir `Retry-After`, usar backoff progressivo curto.
- Tentar novamente com o próximo modelo/fallback dentro da própria função.
- Só retornar erro ao usuário depois de esgotar as tentativas internas.

Importante: isso não adiciona rate limiting no backend. É apenas retry/backoff para lidar melhor com falha temporária do provedor de IA.

### 3. Melhorar `invokeWithRetry` no frontend

Editar `src/lib/invokeWithRetry.ts` para extrair o corpo real de erro da edge function quando `supabase.functions.invoke()` retornar `FunctionsHttpError`.

Com isso, o log administrativo e o toast poderão usar a mensagem real da função, e não só:

`Edge Function returned a non-2xx status code`

Também vou incluir nos detalhes:

- status real
- payload retornado pela função
- correlation/request id, quando houver
- tentativa atual
- se o erro veio da função ou do provedor de IA

### 4. Evitar retries duplicados e agressivos em erro 429

Hoje há retry no frontend e tentativa dentro da função. Isso pode multiplicar chamadas quando o provedor já está limitando.

Vou ajustar para:

- A função cuidar dos retries do provedor de IA.
- O frontend só tentar novamente quando fizer sentido.
- Para `429`, respeitar `retry_after` se vier da função.
- Mostrar mensagem mais honesta ao usuário, por exemplo:

`O serviço de IA está temporariamente limitando novas gerações. Vamos tentar novamente automaticamente. Se persistir, aguarde alguns minutos.`

### 5. Expandir o log administrativo

Editar `src/pages/Admin.tsx` na aba `Logs de Erros` para facilitar debug:

- Mostrar badge de status (`429`, `402`, `500`, etc.) quando disponível.
- Mostrar origem do erro (`ai_gateway`, `edge_function`, `upload`, `database`).
- Mostrar etapa (`image-generation`, `logo-analysis`, etc.).
- Mostrar modelo usado.
- Mostrar usuário/projeto quando disponível.
- Adicionar filtro por status.
- Melhorar o campo de busca para procurar também dentro de `error_details`.

### 6. Opcional: adicionar colunas indexadas para consulta mais fácil

Criar uma migração para adicionar colunas auxiliares em `error_logs`, sem quebrar os logs antigos:

- `status_code integer`
- `source text`
- `stage text`
- `model text`
- `request_id text`

Manter `error_details jsonb` para o detalhe completo.

Isso melhora filtros e relatórios sem depender apenas de JSON.

## Arquivos envolvidos

| Ação | Arquivo |
|---|---|
| Editar | `supabase/functions/generate-creative/index.ts` |
| Editar | `src/lib/invokeWithRetry.ts` |
| Editar | `src/pages/Admin.tsx` |
| Migração | Atualizar `error_logs` com colunas de diagnóstico |

## Resultado esperado

Depois da alteração:

- Vamos saber se o `429` veio mesmo da IA e qual foi a mensagem exata.
- O admin terá logs muito mais úteis para suporte e investigação.
- A geração não vai abortar imediatamente no primeiro `429`.
- O app vai tentar contornar falhas temporárias com backoff/fallback.
- O usuário final verá uma mensagem mais clara e menos genérica.