# Onboarding de Projeto

## Conceito

Quando um projeto é selecionado e ainda não tem o onboarding completo, o usuário vê um wizard de 3 passos em vez das funcionalidades normais. Só após concluir o onboarding o projeto fica liberado.

## Database

**Migration:** Adicionar coluna `onboarding_completed boolean NOT NULL DEFAULT false` na tabela `projects`.

Projetos existentes serão marcados como `true` automaticamente na migration para não bloquear quem já usa.

```sql
ALTER TABLE public.projects ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
UPDATE public.projects SET onboarding_completed = true;
```

## Novo componente: `ProjectOnboarding.tsx`

Wizard com 3 etapas:

1. **Brand Kit** — Exibe o `BrandKitPanel` existente com botão "Próximo" ao salvar pelo menos a cor primária ou logo
2. **Contexto e Tom de Voz** — Exibe o `ContextPanel` existente com botão "Próximo" ao salvar contexto
3. **Gerar primeiro criativo** — Redireciona para o painel "Gerar" e marca `onboarding_completed = true`

Cada etapa mostra um stepper visual (indicador de progresso 1/2/3) no topo. O usuário pode voltar a etapas anteriores mas não pode pular para frente sem completar.

O botão "Pular" não existirá — o onboarding é obrigatório.

## Lógica em `Index.tsx`

Quando `projectId` está selecionado:
- Buscar o projeto e checar `onboarding_completed`
- Se `false` → renderizar `<ProjectOnboarding>` no lugar do conteúdo principal
- Se `true` → renderizar normalmente
- O sidebar de navegação (Gerar, Dinâmica, etc.) fica desabilitado/oculto durante o onboarding

## Hook: `useProject(projectId)`

Novo hook simples que retorna os dados de um projeto específico (incluindo `onboarding_completed`). Usado pelo Index para decidir o fluxo.

## Sidebar (`RightSidebar.tsx`)

Quando o projeto selecionado tem `onboarding_completed === false`:
- Os itens de navegação ficam desabilitados (cinza, sem click)
- Mostra badge "Configurar" ao lado do nome do projeto

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migration | Adicionar `onboarding_completed` em `projects` |
| Criar | `src/components/ProjectOnboarding.tsx` |
| Criar | `src/hooks/useProject.ts` |
| Editar | `src/pages/Index.tsx` — condicional de onboarding |
| Editar | `src/components/RightSidebar.tsx` — desabilitar nav durante onboarding |
| Editar | `src/hooks/useProjects.ts` — adicionar mutation para marcar onboarding completo |
