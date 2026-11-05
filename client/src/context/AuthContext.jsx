import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// The server is the source of truth for "who is logged in". The browser only asks /api/auth/me.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api('/api/auth/me').then((res) => {
      if (!cancelled) { setUser(res.ok ? res.data.user : null); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await api('/api/auth/login', { method: 'POST', body: credentials })
    if (res.ok) setUser(res.data.user)
    return res
  }, [])

  const register = useCallback(async (details) => {
    const res = await api('/api/auth/register', { method: 'POST', body: details })
    if (res.ok) setUser(res.data.user)
    return res
  }, [])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  // Re-read the logged-in user from the server (e.g. after the semester or name changes).
  const refresh = useCallback(async () => {
    const res = await api('/api/auth/me')
    setUser(res.ok ? res.data.user : null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
