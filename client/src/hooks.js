import { useEffect, useState } from 'react'
import { api } from './lib/api.js'

// Loads JSON from the API and reports loading / error / data. `deps` re-fetches when they change.
export function useApi(path, deps = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    api(path).then((res) => {
      if (cancelled) return
      setState(res.ok ? { loading: false, error: '', data: res.data } : { loading: false, error: res.data.message || 'Could not load this page.', data: null })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])
  return state
}
