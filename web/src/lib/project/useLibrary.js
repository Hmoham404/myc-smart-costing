import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

export const LIBRARY_KINDS = {
  materials: { label: 'Matières', cols: [['name', 'Matière', 'text'], ['price', 'Prix $/kg', 'num'], ['density', 'Densité g/cm³', 'num'], ['supplier', 'Fournisseur', 'text']] },
  masterbatches: { label: 'Mélanges maîtres', cols: [['name', 'Mélange maître', 'text'], ['price', 'Prix $/kg', 'num']] },
  machines: { label: 'Machines', cols: [['name', 'Machine', 'text'], ['category', 'Catégorie', 'text'], ['labor', 'MOD $/h', 'num'], ['machineCost', 'Machine $/h', 'num']] },
  inks: { label: 'Encres / films', cols: [['name', 'Encre / film', 'text'], ['price', 'Prix $/kg', 'num']] },
  components: { label: 'Composants achetés', cols: [['name', 'Composant', 'text'], ['price', 'Prix $/u', 'num']] },
  packaging: { label: 'Emballages', cols: [['name', 'Article', 'text'], ['price', 'Prix $/u', 'num']] },
  assembly: { label: "Étapes d'assemblage", cols: [['name', 'Étape', 'text'], ['machineCost', 'Machine $/h', 'num'], ['labor', 'MOD $/h', 'num']] },
}

/** Bibliothèque partagée (table mc_library : une ligne par type) */
export function useLibrary() {
  const [lib, setLib] = useState({})
  const [error, setError] = useState(null)
  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('mc_library').select('*')
    setError(e?.message || null)
    setLib(Object.fromEntries((data || []).map((r) => [r.kind, r.items || []])))
  }, [])
  useEffect(() => { reload() }, [reload])
  const save = useCallback(async (kind, items) => {
    setLib((l) => ({ ...l, [kind]: items }))
    const { error: e } = await supabase.from('mc_library').upsert({ kind, items, updated_at: new Date().toISOString() })
    if (e) setError(e.message)
  }, [])
  return { lib, save, reload, error }
}
