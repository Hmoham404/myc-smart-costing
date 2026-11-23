import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { ROLES, infoFor, latestPrices } from './paints'

/**
 * Catalogue peinture en ligne : factures, derniers prix par référence et couleurs (recettes).
 * colorToPaint(color) → { base, pigments } prêts pour le moteur (prix = dernière facture).
 */
export function usePaintCatalog() {
  const [invoices, setInvoices] = useState([])
  const [items, setItems] = useState([])
  const [colors, setColors] = useState([])
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('mc_paint_invoices').select('*').order('invoice_date'),
      supabase.from('mc_paint_items').select('*'),
      supabase.from('mc_colors').select('*').order('name'),
    ])
    setError(a.error?.message || c.error?.message || null)
    setInvoices(a.data || []); setItems(b.data || []); setColors(c.data || []); setLoaded(true)
  }, [])
  useEffect(() => { reload() }, [reload])

  const latest = useMemo(() => latestPrices(invoices, items), [invoices, items])

  const colorToPaint = useCallback((color) => {
    if (!color) return null
    const price = (code) => latest[code]?.price ?? 0
    return {
      base: (color.layers || []).map((l) => ({ name: `${ROLES[l.role] || l.role} ${l.code}`, code: l.code, price: price(l.code), cons: Number(l.cons) || 0 })),
      pigments: (color.pigments || []).map((g) => ({ name: infoFor(g.code).pigment || g.code, code: g.code, price: price(g.code), cons: Number(g.cons) || 0 })),
      include_pigments: (color.pigments || []).length > 0,
    }
  }, [latest])

  return { invoices, items, colors, latest, colorToPaint, reload, error, loaded }
}

/** Applique une couleur à une pièce (famille → grille commerciale, recette → peinture) */
export function applyColor(product, color, colorToPaint) {
  if (!color) {
    const { paint_override, color_id, color_name, color_hex, ...rest } = product
    return rest
  }
  return {
    ...product,
    color_id: color.id, color_name: color.name, color_hex: color.hex,
    color: color.family === 'special' ? 'special' : 'standard',
    paint_override: colorToPaint(color),
  }
}
