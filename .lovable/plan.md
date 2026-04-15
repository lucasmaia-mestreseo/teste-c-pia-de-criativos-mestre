

# Corrigir Upload de Imagens para Analistas

## Problema
As políticas de INSERT e DELETE nos buckets de storage (`logos`, `swipe-files`, `brand-photos`, `people-photos`) usam a função `has_project_access()`, que verifica se o cargo é `owner`, `admin` ou `manager`. Analistas são bloqueados no nível do banco, mesmo sendo usuários aprovados.

## Solução
Trocar `has_project_access(auth.uid())` por `is_approved(auth.uid())` nas políticas de INSERT e DELETE de todos os buckets. Qualquer usuário aprovado poderá fazer upload e deletar arquivos em todos os buckets.

## Migração SQL
Uma única migração que:
1. Remove as políticas atuais de INSERT e DELETE em `storage.objects` para os 5 buckets
2. Recria com `is_approved(auth.uid())` no lugar de `has_project_access(auth.uid())`

Buckets afetados: `logos`, `swipe-files`, `brand-photos`, `people-photos`, `generated-creatives`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Atualizar políticas de storage para usar `is_approved` |

