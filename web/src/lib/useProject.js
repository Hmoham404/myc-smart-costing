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

export const PROJECT_TYPES = {
  injection: { label: 'Chiffrage injection', desc: 'Matière, injection, décoration SS/HS, composants, assemblage, emballage, transport' },
  materials: { label: 'Besoin matière', desc: 'Quantités à produire avec rebuts en cascade et kg de résine / mélange maître à commander' },
  capacity: { label: 'Capacité & planning', desc: 'Cadences par procédé, capacité vs objectif, planning hebdomadaire, Gantt et MOD' },
}

/** Modèles vierges */
export function blankData(type, source) {
  if (type === 'injection') {
    return {
      client: '', reference: '', margin: 0, transport: 0,
      refs: source?.refs || { materials: [], masterbatches: [], machines: [], inks: [], components: [], assembly: [], packaging: [] },
      resin: [{ part: 'cap', material: '', color: '', netWeight: 0, runnerWeight: 0, rate: 1, reject: 0.03, assemblyReject: 0, masterbatch: '', mbRate: 0 }],
      injection: [{ part: 'cap', cycle: 30, cavity: 4, workers: 1, machine: '', reject: 0.03, assemblyReject: 0 }],
      decoration: [], components: [], assembly: [],
      packing: { layers: 1, perLayer: 1, items: [] },
    }
  }
  if (type === 'materials') {
    return { items: [{ name: 'PIÈCE', reference: '', planned: 100000, scrapInjection: 0.03, scrapDecoration: 0, scrapPainting: 0, scrapAssembly: 0.03, resin: '', masterbatch: '', resinShare: 0.97, unitWeight: 10, cavities: 4, runnerWeight: 0, recyclingRate: 0, startupCycles: 100 }], prices: {} }
  }
  return {
    totalPieces: 0,
    weeks: Array.from({ length: 12 }, (_, i) => ({ label: `w${i + 1}`, need: 0 })),
    operations: [{ id: `op${Date.now()}`, process: 'Injection', component: '', code: '', machine: 'Injection Machine', kind: 'injection', machines: 1, machineCycle: 30, cavities: 4, hoursPerShift: 7.5, shiftsPerDay: 3, daysPerWeek: 6, efficiency: 0.85, scrap: 0, modPerShift: 1, objective: 0, startWeek: 'w1', rampFirstWeek: 1 }],
  }
}
