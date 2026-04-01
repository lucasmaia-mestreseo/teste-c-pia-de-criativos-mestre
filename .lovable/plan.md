

# Fix Persistent Loading Screen

## Root Cause

The `onAuthStateChange` callback is `async` and `await`s Supabase queries (`fetchProfile`). Per official Supabase documentation, **awaiting Supabase API calls inside `onAuthStateChange` causes a deadlock** — the auth state listener blocks itself, preventing `setLoading(false)` from ever executing.

## Solution

Refactor `src/contexts/AuthContext.tsx` to follow the recommended pattern:

1. **Remove `async/await` from `onAuthStateChange`** — only set session/user synchronously in the callback
2. **Use `setTimeout` to offload `fetchProfile`** outside the auth listener lock
3. **Use `getSession()` as the primary initialization path** — it resolves the session from storage first, then triggers profile fetch
4. **Ensure `setLoading(false)` is always reached** via `finally` blocks

```typescript
useEffect(() => {
  let initialDone = false;

  // 1. Initial session restore
  supabase.auth.getSession().then(({ data: { session: s } }) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
      fetchProfile(s.user.id, s.user.email, s.user.user_metadata?.name)
        .catch(e => console.error('Failed to fetch profile:', e))
        .finally(() => { initialDone = true; setLoading(false); });
    } else {
      initialDone = true;
      setLoading(false);
    }
  }).catch(() => { initialDone = true; setLoading(false); });

  // 2. Subsequent auth changes — NO async, NO await
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Fire and forget — offload to avoid deadlock
        setTimeout(() => {
          fetchProfile(sess.user.id, sess.user.email, sess.user.user_metadata?.name)
            .catch(e => console.error('Failed to fetch profile:', e))
            .finally(() => { if (!initialDone) { initialDone = true; setLoading(false); } });
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        if (!initialDone) { initialDone = true; setLoading(false); }
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

## File to modify
- **`src/contexts/AuthContext.tsx`** — refactor useEffect to eliminate async deadlock

