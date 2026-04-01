

# Ajustes 01, 02 e 03

## AJUSTE 01 — Admin: telas full-width + tabela de usuários alinhada

**Problema:** O conteúdo admin tem `max-w-4xl` que limita a largura. A lista de usuários usa cards independentes sem alinhamento em colunas.

**Arquivo:** `src/pages/Admin.tsx`

1. Linha 137: remover `max-w-4xl` do `<main>`, substituir por `max-w-6xl` ou remover completamente para ocupar tela toda
2. **UsersTab** (linhas 423-470): substituir os cards individuais por uma tabela HTML (`<Table>` do shadcn) com colunas fixas: Nome/Email | Cargo | Status | Ações. Isso alinha tudo corretamente como no screenshot de referência.

Estrutura da tabela:
```text
| Nome / Email          | Cargo      | Status   | Nível (select) | Ações        |
|-----------------------|------------|----------|----------------|--------------|
| Fabio Ricotta         | Owner      | Aprovado | Owner ▼        | ✏️           |
| fabio@agencia...      |            |          |                |              |
```

- Usar `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` de `@/components/ui/table`
- Manter a seção de convite acima da tabela

**ProjectsTab** e demais tabs: mesma abordagem — remover `max-w-4xl` para mais espaço.

## AJUSTE 02 — Logo "Criativos Mestre" leva ao dashboard

**Arquivo:** `src/components/RightSidebar.tsx` (linha 89-93)

- Importar `useNavigate` (já importado)
- O logo/nome já está na linha 91-92. Envolver em um `<button>` ou `<div onClick>` que:
  - Chama `onSelectProject('')` ou um novo callback `onGoHome` para limpar o `projectId`
  - Isso fará `showDashboard = !projectId` ser `true` no `Index.tsx`

Solução mais simples: aceitar a prop `onSelectProject` que já existe e chamar com valor que limpa a seleção. No `Index.tsx`, o `handleProjectChange` espera um ID válido, então precisamos de um callback dedicado. Alternativa: no click do logo, simplesmente setar `projectId` para `null` via nova prop `onGoToDashboard`.

- Adicionar prop `onGoToDashboard?: () => void` ao `RightSidebar`
- No `Index.tsx`, passar `onGoToDashboard={() => setProjectId(null)}`
- No logo, `onClick={onGoToDashboard}` com `cursor-pointer`

## AJUSTE 03 — Hover nos projetos do dashboard igual ao menu

**Arquivo:** `src/components/DashboardPanel.tsx` (linha 105)

Atualmente: `hover:bg-accent` (fundo amarelo sólido).

Mudar para: `border border-transparent hover:border-primary/50 hover:text-primary` (linha fina + texto colorido, padrão do sidebar).

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Admin.tsx` — remover max-w-4xl, converter UsersTab para tabela |
| Editar | `src/components/RightSidebar.tsx` — logo clicável + nova prop |
| Editar | `src/pages/Index.tsx` — passar `onGoToDashboard` |
| Editar | `src/components/DashboardPanel.tsx` — hover padronizado nos projetos |

