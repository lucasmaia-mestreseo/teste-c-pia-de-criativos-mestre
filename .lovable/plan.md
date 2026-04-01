

# Corrigir tela travada no loading

## Problema
No `AuthContext.tsx`, tanto o `onAuthStateChange` quanto o `getSession` chamam `fetchProfile` e só executam `setLoading(false)` depois. Se `fetchProfile` lançar um erro (RLS, rede, etc.), o `catch` nunca é tratado e `loading` permanece `true` para sempre, travando a tela no spinner.

## Solução

### Modificar: `src/contexts/AuthContext.tsx`
1. Envolver as chamadas a `fetchProfile` em try-catch tanto no callback do `onAuthStateChange` quanto no `.then()` do `getSession`
2. Garantir que `setLoading(false)` **sempre** seja executado, mesmo em caso de erro
3. Adicionar um bloco `finally` ou `catch` que defina `loading = false`

```typescript
// No onAuthStateChange:
async (_event, sess) => {
  setSession(sess);
  setUser(sess?.user ?? null);
  if (sess?.user) {
    try {
      await fetchProfile(sess.user.id, sess.user.email, sess.user.user_metadata?.name);
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  } else {
    setProfile(null);
    setRole(null);
  }
  setLoading(false);  // sempre executa
}

// No getSession:
supabase.auth.getSession().then(({ data: { session: s } }) => {
  setSession(s);
  setUser(s?.user ?? null);
  if (s?.user) {
    fetchProfile(s.user.id, s.user.email, s.user.user_metadata?.name)
      .catch(e => console.error('Failed to fetch profile:', e))
      .finally(() => setLoading(false));
  } else {
    setLoading(false);
  }
}).catch(() => setLoading(false));
```

## Arquivo a modificar
- `src/contexts/AuthContext.tsx` — adicionar tratamento de erro nas chamadas a fetchProfile

