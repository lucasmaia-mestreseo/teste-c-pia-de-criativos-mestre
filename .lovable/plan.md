
# Onboarding de Projeto — Plano de Implementação

## 1. Migration — coluna `onboarding_completed`

**Arquivo:** `supabase/migrations/20260401190000_add_onboarding_completed.sql`

```sql
ALTER TABLE public.projects ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
UPDATE public.projects SET onboarding_completed = true;
```

Projetos existentes ficam marcados como concluídos. Novos projetos começam com `false`.

## 2. Hook `useProject.ts` (novo)

**Arquivo:** `src/hooks/useProject.ts`

- `useProject(projectId)` — retorna dados do projeto incluindo `onboarding_completed`
- `useCompleteOnboarding()` — mutation que faz `UPDATE projects SET onboarding_completed = true WHERE id = ?`

## 3. Componente `ProjectOnboarding.tsx` (novo)

**Arquivo:** `src/components/ProjectOnboarding.tsx`

Wizard de 3 etapas com stepper visual no topo:

| Etapa | Conteúdo | Condição para avançar |
|-------|----------|----------------------|
| 1 — Brand Kit | Renderiza `<BrandKitPanel>` embutido | Botão "Próximo" manual |
| 2 — Contexto | Renderiza `<ContextPanel>` embutido | Botão "Próximo" manual |
| 3 — Concluir | Mensagem de sucesso + botão "Começar a criar" | Marca `onboarding_completed = true` e redireciona para "Gerar" |

- Stepper mostra passos 1/2/3 com indicador visual do passo atual
- Botão "Voltar" disponível nos passos 2 e 3
- Sem opção de pular

## 4. Editar `Index.tsx`

Quando `projectId` está selecionado:
- Usar `useProject(projectId)` para checar `onboarding_completed`
- Se `false` → renderizar `<ProjectOnboarding projectId={projectId} onComplete={() => ...} />` no lugar de todo o conteúdo principal
- Se `true` → fluxo normal atual
- Passar callback `onComplete` que invalida queries e muda `activePanel` para `'generate'`

## 5. Editar `RightSidebar.tsx`

- Aceitar nova prop `onboardingPending?: boolean`
- Quando `true`, os `navItems` ficam desabilitados (opacity reduzida, pointer-events none)
- Badge "Configurar" ao lado do nome do projeto no selector

## Arquivos totais

| Ação | Arquivo |
|------|---------|
| Migration | `supabase/migrations/20260401190000_add_onboarding_completed.sql` |
| Criar | `src/hooks/useProject.ts` |
| Criar | `src/components/ProjectOnboarding.tsx` |
| Editar | `src/pages/Index.tsx` |
| Editar | `src/components/RightSidebar.tsx` |
