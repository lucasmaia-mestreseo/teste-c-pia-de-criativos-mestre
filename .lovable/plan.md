

# Ajustes no painel de geração + URLs por seção/projeto

## Mudanças

### 1. Configurações Avançadas — melhor espaçamento e botões (`GenerationControls.tsx`)

- **Remover espaço vazio** entre "Sugerir Criativos com IA" e "Configurações Avançadas" — o Collapsible fica logo abaixo do conteúdo do modo, sem margin/padding extra
- **Logo**: trocar Checkbox por botão toggle (estilo pill). Desmarcado por padrão (`includeLogo = false`). Ao ativar, exibir grid 3x3 e tamanho com elementos ligeiramente maiores (w-7 h-7 no grid, botões de tamanho maiores)
- **Pessoa**: mesmo padrão — botão toggle em vez de checkbox, desmarcado por padrão
- **Brand Kit e Contexto**: trocar Checkbox por botões toggle (pills) que funcionam como on/off, mantendo marcados por padrão

### 2. PositionGrid maior (`PositionGrid.tsx`)

- Aumentar de `w-5 h-5` para `w-7 h-7`, gap de `gap-1`, dot de `w-2 h-2`

### 3. Formato como dropdown ao lado do botão Gerar (`GenerationControls.tsx`)

- Remover a seção de botões de formato
- No footer fixo, colocar um `Select` de formato (dropdown) ao lado esquerdo do botão "Gerar Criativo"
- Pré-selecionar `9:16` como padrão (`useState('9:16')`)
- O último valor selecionado persiste durante a sessão (já é o comportamento atual com `useState`)

### 4. URLs por seção e projeto (`App.tsx`, `Index.tsx`, `TopBar.tsx`)

Estrutura de rotas:

| URL | Conteúdo |
|-----|----------|
| `/` | Dashboard (sem projeto) |
| `/project/:projectId` | Projeto com painel padrão (generate) |
| `/project/:projectId/generate` | Gerar |
| `/project/:projectId/dynamic` | Dinâmica |
| `/project/:projectId/creatives` | Criativos |
| `/project/:projectId/brandkit` | Brand Kit |
| `/project/:projectId/context` | Contexto |
| `/project/:projectId/history` | Histórico |
| `/profile` | Perfil (já existe) |
| `/admin` | Admin (já existe) |
| `/admin/users` | Admin Usuários |
| `/admin/prompts` | Admin Prompts |

**Implementação:**
- `App.tsx`: Adicionar rota `/project/:projectId/:panel?` apontando para `Index`
- `Index.tsx`: Usar `useParams` para ler `projectId` e `panel` da URL. Usar `useNavigate` para sincronizar mudanças de projeto/painel com a URL
- `TopBar.tsx`: Ao trocar de projeto ou painel, navegar para a URL correta em vez de apenas setar estado
- Ao entrar numa URL com projeto/painel, carregar diretamente no estado correto

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/GenerationControls.tsx` — layout, botões toggle, formato dropdown no footer |
| Editar | `src/components/PositionGrid.tsx` — tamanhos maiores |
| Editar | `src/App.tsx` — novas rotas por projeto/painel |
| Editar | `src/pages/Index.tsx` — sync URL ↔ estado via useParams/useNavigate |
| Editar | `src/components/TopBar.tsx` — navegação por URL |

