import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

/** Charge un projet et l'enregistre automatiquement (0,8 s après la dernière modification). */
export function useProject(id) {
  const [project, setProject] = useState(null)
  const [error, setError] = useState(null)
  const [saveState, setSaveState] = useState('saved') // saved | pending | saving | error
  const timer = useRef(null)
  const latest = useRef(null)

  useEffect(() => {
    let alive = true
    supabase.from('mc_projects').select('*').eq('id', id).maybeSingle().then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(e.message)
      setProject(data); latest.current = data
    })
    return () => { alive = false }
  }, [id])

  const flush = useCallback(async () => {
    const p = latest.current
    if (!p) return
    setSaveState('saving')
    const { error: e } = await supabase.from('mc_projects')
      .update({ title: p.title, client: p.client, reference: p.reference, status: p.status, data: p.data, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    setSaveState(e ? 'error' : 'saved')
    if (e) setError(e.message)
  }, [])

  const update = useCallback((patch) => {
    setProject((cur) => {
      const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch }
      latest.current = next
      return next
    })
    setSaveState('pending')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 800)
  }, [flush])

  const setData = useCallback((fn) => update((cur) => ({ ...cur, data: typeof fn === 'function' ? fn(cur.data) : { ...cur.data, ...fn } })), [update])

  // Enregistre avant de quitter la page
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush() } }, [flush])

  return { project, error, saveState, update, setData, flush }
}
