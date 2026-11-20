// =====================================================================
//  Leviers (valeurs modifiables) + indicateurs + solveur d'objectifs
//  Tout passe par computeCosting : aucun prix n'est inventé.
// =====================================================================
import { computeCosting } from './engine.js'

const clone = (o) => JSON.parse(JSON.stringify(o))
const scaleList = (list, k, f) => list.map((x) => ({ ...x, [k]: x[k] * f }))

/** Chaque levier lit/écrit une valeur sur une copie (P, product). */
export const LEVERS = [
  { key: 'speed', label: 'Vitesse chaîne', unit: 'm/min', min: 4, max: 12, step: 0.01, dec: 2,
    get: (P, x) => P.lines[x.process].speed_m_min, set: (P, x, v) => { P.lines[x.process].speed_m_min = v } },
  { key: 'workers', label: 'Opérateurs', unit: 'pers.', min: 4, max: 30, step: 1, dec: 0, int: true,
    get: (P, x) => P.workers[x.process], set: (P, x, v) => { P.workers[x.process] = v } },
  { key: 'line_eff', label: 'Efficacité chaîne', unit: '', min: 0.6, max: 1, step: 0.01, dec: 2,
    get: (P, x) => P.lines[x.process].efficiency, set: (P, x, v) => { P.lines[x.process].efficiency = v } },
  { key: 'daily_eff', label: 'Efficacité journalière', unit: '', min: 0.6, max: 1, step: 0.01, dec: 2,
    get: (P) => P.daily_efficiency, set: (P, x, v) => { P.daily_efficiency = v } },
  { key: 'paint_price', label: 'Prix peinture', unit: '%', min: 60, max: 140, step: 1, dec: 0, base: 100,
    get: () => 100, set: (P, x, v) => { P.paint.base = scaleList(P.paint.base, 'price', v / 100); P.paint.pigments = scaleList(P.paint.pigments, 'price', v / 100) } },
  { key: 'paint_cons', label: 'Consommation peinture', unit: '%', min: 50, max: 150, step: 1, dec: 0, base: 100,
    get: () => 100, set: (P, x, v) => { P.paint.base = scaleList(P.paint.base, 'cons', v / 100); P.paint.pigments = scaleList(P.paint.pigments, 'cons', v / 100) } },
  { key: 'labor_rate', label: 'Taux MOD', unit: '$/h', min: 1, max: 6, step: 0.05, dec: 2,
    get: (P) => P.hourly.labor_per_worker, set: (P, x, v) => { P.hourly.labor_per_worker = v } },
  { key: 'amort', label: 'Amortissement UV + vide', unit: '$/h', min: 20, max: 100, step: 0.25, dec: 2,
    get: (P) => P.hourly.amort_uv_vacuum, set: (P, x, v) => { P.hourly.amort_uv_vacuum = v } },
  { key: 'jumps', label: 'Sauts (pas)', unit: '', min: 1, max: 8, step: 1, dec: 0, int: true,
    get: (P, x, r) => r.geometry.jumps, set: (P, x, v) => { x.jumps = v } },
  { key: 'coef', label: 'Coefficient commercial', unit: '×', min: 1.2, max: 2.4, step: 0.01, dec: 2,
    get: (P) => (P.pricing_mode === 'margin' ? 1 + P.margin : P.coefficient),
    set: (P, x, v) => { if (P.pricing_mode === 'margin') P.margin = v - 1; else P.coefficient = v } },
  { key: 'scrap', label: 'Rebut', unit: '%', min: 0, max: 30, step: 0.5, dec: 1,
    get: (P, x) => x.scrap * 100, set: (P, x, v) => { x.scrap = v / 100 } },
  { key: 'quantity', label: 'Quantité', unit: 'pcs', min: 5000, max: 200000, step: 1000, dec: 0, int: true,
    get: (P, x) => x.quantity, set: (P, x, v) => { x.quantity = v } },
]
export const leverByKey = Object.fromEntries(LEVERS.map((l) => [l.key, l]))

export const METRICS = [
  { key: 'finalPrice', label: 'Prix de vente unitaire', unit: '$', dec: 4, better: 'down', get: (r) => r.totals.finalPrice },
  { key: 'unitCost', label: 'Prix de revient unitaire', unit: '$', dec: 4, better: 'down', get: (r) => r.totals.unitCost },
  { key: 'marginPct', label: 'Marge brute', unit: '%', dec: 1, better: 'up',
    get: (r) => (r.totals.finalPrice ? ((r.totals.finalPrice - r.totals.unitCost) / r.totals.finalPrice) * 100 : 0) },
  { key: 'capacity', label: 'Capacité par poste', unit: 'pcs', dec: 0, better: 'up', get: (r) => r.capacity.capacity },
  { key: 'productionHours', label: 'Heures de production', unit: 'h', dec: 0, better: 'down', get: (r) => r.totals.productionHours },
  { key: 'totalAmount', label: 'Montant total HT', unit: '$', dec: 0, better: 'up', get: (r) => r.totals.totalAmount },
]
export const metricByKey = Object.fromEntries(METRICS.map((m) => [m.key, m]))

/** Applique un ensemble de valeurs de leviers { key: value } et recalcule. */
export function applyLevers(product, P, values = {}, mode = 'excel') {
  const P2 = clone(P)
  const x2 = clone(product)
  const r0 = computeCosting(product, P, mode)
  for (const [k, v] of Object.entries(values)) {
    const l = leverByKey[k]
    if (l && v != null && v !== l.get(P, product, r0)) l.set(P2, x2, v)
  }
  return { P: P2, product: x2, r: computeCosting(x2, P2, mode) }
}

export function currentLeverValues(product, P, mode = 'excel') {
  const r = computeCosting(product, P, mode)
  return Object.fromEntries(LEVERS.map((l) => [l.key, l.get(P, product, r)]))
}

/** Balayage d'un levier : points { x, metric1, metric2… } pour tracer une courbe. */
export function sweep(product, P, leverKey, mode = 'excel', points = 60, values = {}) {
  const l = leverByKey[leverKey]
  const out = []
  const n = l.int ? Math.min(points, l.max - l.min + 1) : points
  for (let i = 0; i < n; i++) {
    const v = l.int ? Math.round(l.min + ((l.max - l.min) * i) / Math.max(1, n - 1)) : l.min + ((l.max - l.min) * i) / (n - 1)
    const { r } = applyLevers(product, P, { ...values, [leverKey]: v }, mode)
    const row = { x: +v.toFixed(l.dec + 2) }
    METRICS.forEach((m) => { row[m.key] = m.get(r) })
    out.push(row)
  }
  return out
}

/** Sensibilité : effet d'une variation de ±pct % de chaque levier sur un indicateur. */
export function tornado(product, P, metricKey, mode = 'excel', pct = 10, values = {}) {
  const m = metricByKey[metricKey]
  const base = m.get(applyLevers(product, P, values, mode).r)
  const cur = { ...currentLeverValues(product, P, mode), ...values }
  return LEVERS.filter((l) => !['quantity', 'coef'].includes(l.key) || metricKey === 'totalAmount' || l.key === 'coef' && ['finalPrice', 'marginPct'].includes(metricKey))
    .map((l) => {
      const v0 = cur[l.key]
      const clamp = (v) => Math.min(l.max, Math.max(l.min, l.int ? Math.round(v) : v))
      const lo = clamp(v0 * (1 - pct / 100)), hi = clamp(v0 * (1 + pct / 100))
      const mLo = m.get(applyLevers(product, P, { ...values, [l.key]: lo }, mode).r)
      const mHi = m.get(applyLevers(product, P, { ...values, [l.key]: hi }, mode).r)
      return { key: l.key, label: l.label, low: mLo - base, high: mHi - base, span: Math.abs(mHi - mLo) }
    })
    .filter((d) => d.span > 1e-9)
    .sort((a, b) => b.span - a.span)
}

const meets = (v, cmp, target) => (cmp === '<=' ? v <= target + 1e-12 : v >= target - 1e-12)

/**
 * Solveur d'objectif : pour chaque levier, trouve la valeur la plus proche de l'actuelle
 * qui atteint la cible (balayage fin, robuste aux paliers FLOOR/ROUNDUP d'Excel).
 */
export function solveGoal(product, P, goal, mode = 'excel', allowed = null) {
  const m = metricByKey[goal.metric]
  const cur = currentLeverValues(product, P, mode)
  const current = m.get(computeCosting(product, P, mode))
  const already = meets(current, goal.comparator, goal.target)
  // En mode Excel, l'efficacité journalière agit à l'envers (anomalie W7) : on ne la propose pas
  const levers = LEVERS.filter((l) => (allowed ? allowed.includes(l.key) : !['quantity'].includes(l.key)))
    .filter((l) => !(mode === 'excel' && l.key === 'daily_eff'))
  const single = []
  for (const l of levers) {
    const steps = l.int ? l.max - l.min : 400
    let best = null
    for (let i = 0; i <= steps; i++) {
      const v = l.int ? l.min + i : l.min + ((l.max - l.min) * i) / steps
      const val = m.get(applyLevers(product, P, { [l.key]: v }, mode).r)
      if (meets(val, goal.comparator, goal.target)) {
        const dist = Math.abs(v - cur[l.key])
        if (!best || dist < best.dist) best = { v, val, dist }
      }
    }
    if (best) {
      const rel = cur[l.key] ? (best.v - cur[l.key]) / Math.abs(cur[l.key]) : 0
      single.push({ key: l.key, label: l.label, unit: l.unit, dec: l.dec, from: cur[l.key], to: best.v, rel, result: best.val })
    }
  }
  single.sort((a, b) => Math.abs(a.rel) - Math.abs(b.rel))

  // Plan combiné : on avance tous les leviers « favorables » ensemble, par petits pas
  let combo = null
  const fav = levers.filter((l) => !['coef', 'scrap'].includes(l.key)).map((l) => {
    const up = m.get(applyLevers(product, P, { [l.key]: Math.min(l.max, cur[l.key] * 1.05 + (l.int ? 1 : 0)) }, mode).r)
    const dn = m.get(applyLevers(product, P, { [l.key]: Math.max(l.min, cur[l.key] * 0.95 - (l.int ? 1 : 0)) }, mode).r)
    const goodUp = goal.comparator === '<=' ? up < dn : up > dn
    return { l, dir: goodUp ? 1 : -1, gain: Math.abs(up - dn) }
  }).filter((f) => f.gain > 1e-12).sort((a, b) => b.gain - a.gain).slice(0, 4)
  if (fav.length && !already) {
    for (let s = 1; s <= 30; s++) {
      const values = {}
      fav.forEach(({ l, dir }) => {
        let v = cur[l.key] * (1 + dir * 0.01 * s)
        v = Math.min(l.max, Math.max(l.min, v)); if (l.int) v = Math.round(v)
        values[l.key] = v
      })
      const val = m.get(applyLevers(product, P, values, mode).r)
      if (meets(val, goal.comparator, goal.target)) {
        combo = { pct: s, values, result: val, changes: fav.map(({ l }) => ({ key: l.key, label: l.label, unit: l.unit, dec: l.dec, from: cur[l.key], to: values[l.key] })).filter((x) => Math.abs(x.to - x.from) > 1e-9) }
        break
      }
    }
  }
  return { metric: m, current, already, single, combo, gap: goal.target - current }
}
