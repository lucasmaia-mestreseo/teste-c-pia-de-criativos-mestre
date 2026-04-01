

# Corrigir Perfil, Roles e Renomear Sistema

## Problemas Identificados

1. **Perfil não existe no banco**: A tabela `profiles` está vazia para o usuário `fabioricotta@agenciamestre.com` (user_id: `ec840b7c-dad1-4196-bbd5-0b966ab4cffa`). O signup provavelmente falhou no insert do profile porque o RLS exige `auth.uid() = user_id`, mas durante o signup com confirmação de email, a sessão não está ativa até o email ser confirmado.

2. **Trigger nunca disparou**: O trigger `trg_auto_owner_fabioricotta` existe na tabela `profiles`, mas como nenhum profile foi inserido, ele nunca executou → sem role `owner` → sem acesso ao painel admin.

3. **Projeto existe mas não aparece**: O projeto "Workshop IA na Prática" existe, mas o RLS de `projects` exige `is_approved(auth.uid())`, que verifica `profiles.approved` → sem perfil, retorna false.

4. **Nome do sistema**: Ainda diz "Clonador Mestre" em vários lugares.

## Solução

### 1. Inserir dados do usuário owner via SQL (insert tool)
- INSERT na tabela `profiles`: user_id `ec840b7c-...`, name "Fabio Ricotta", email "fabioricotta@agenciamestre.com", approved = true
- INSERT na tabela `user_roles`: user_id `ec840b7c-...`, role "owner"

### 2. Corrigir race condition no signup (`Auth.tsx`)
O problema raiz: o insert do profile usa o client autenticado, mas durante signup com confirmação de email, o usuário ainda não tem sessão. Solução: mover a criação do profile para o `AuthContext` — ao detectar um login (onAuthStateChange), verificar se o profile existe; se não, criá-lo usando dados do `user.user_metadata` (name, email).

### 3. Criar profile automaticamente no login (`AuthContext.tsx`)
No `fetchProfile`, se a query retornar 0 rows, fazer um INSERT automático usando `user.user_metadata.name` e `user.email`. Isso garante que mesmo usuários que fizeram signup antes do fix terão profile criado.

### 4. Renomear "Clonador Mestre" → "Criativos Mestre"
Arquivos a alterar:
- `src/pages/Auth.tsx` (linha 117)
- `src/components/TopBar.tsx` (título no header)
- `index.html` (title e meta tags)

## Arquivos a modificar
- **`src/contexts/AuthContext.tsx`** — adicionar auto-criação de profile no fetchProfile
- **`src/pages/Auth.tsx`** — renomear sistema
- **`src/components/TopBar.tsx`** — renomear sistema
- **`index.html`** — renomear título e metas
- **SQL insert** — dados do owner

