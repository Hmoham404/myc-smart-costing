import { computeCosting, detectAnomalies, optimizationHints, coefForQuantity } from '../lib/engine'
import { solveGoal, metricByKey } from '../lib/levers'
import { fmtMetric } from './WhatIf'
import { PROCESS_LABEL } from '../lib/defaults'
import { money, num, pct } from '../lib/format'

/**
 * Réponses de secours (hors ligne, sans IA) quand la fonction mc-ai n'est pas joignable.
 * Toutes ses réponses proviennent du moteur de calcul validé (engine.js).
 */
export function offlineAnswer(text, ctx) {
  const { product, P, r, other } = ctx
  const t = text.toLowerCase()
  const T = r.totals
  const qtyMatch = t.match(/(\d[\d\s.]*)\s*(k|000|pcs|pièces)?/)

  // Objectif : « objectif 0,45 », « prix sous 0.45 », « marge 45 % », « capacité 15000 »
  const goalNum = t.match(/(\d+[.,]?\d*)/)
  if (/objectif|cible|atteindre|sous |viser|goal/.test(t) && goalNum) {
    const target = parseFloat(goalNum[1].replace(',', '.'))
    let metric = 'finalPrice'
    if (/marge/.test(t)) metric = 'marginPct'
    else if (/revient|co[uû]t/.test(t)) metric = 'unitCost'
    else if (/capacit/.test(t)) metric = 'capacity'
    else if (/heure/.test(t)) metric = 'productionHours'
    const m = metricByKey[metric]
    const comparator = m.better === 'down' ? '<=' : '>='
    const s = solveGoal(product, P, { metric, comparator, target }, r.mode)
    if (s.already) return `✅ Objectif déjà atteint : ${m.label.toLowerCase()} = ${fmtMetric(m, s.current)} (cible ${comparator === '<=' ? '≤' : '≥'} ${fmtMetric(m, target)}).`
    if (!s.single.length && !s.combo) return `❌ ${m.label} ${comparator === '<=' ? '≤' : '≥'} ${fmtMetric(m, target)} n'est pas atteignable avec les leviers disponibles (actuel ${fmtMetric(m, s.current)}).`
    return `🎯 Objectif : ${m.label.toLowerCase()} ${comparator === '<=' ? '≤' : '≥'} ${fmtMetric(m, target)} (actuel ${fmtMetric(m, s.current)}).\n\n` +
      'Solutions avec un seul levier (du plus petit changement au plus grand) :\n' +
      s.single.slice(0, 6).map((x) => `• ${x.label} : ${num(x.from, x.dec)} → ${num(x.to, x.dec)} ${x.unit} (${x.rel > 0 ? '+' : ''}${num(x.rel * 100, 1)} %) → ${fmtMetric(m, x.result)}`).join('\n') +
      (s.combo ? `\n\nPlan combiné (≈ ${s.combo.pct} % chacun) : ${s.combo.changes.map((x) => `${x.label} ${num(x.from, x.dec)} → ${num(x.to, x.dec)}`).join(' ; ')} → ${fmtMetric(m, s.combo.result)}` : '') +
      '\n\nPour l\'enregistrer et suivre sa progression : page « Objectifs & IA ».'
  }

  if (/anomal|erreur|incoh|contr[oô]l|v[ée]rif/.test(t)) {
    return detectAnomalies(product, P, r).map((a) => `• ${a.title} — ${a.text}`).join('\n')
  }
  if (/optim|r[ée]duire|baisser|gagner|am[ée]lior/.test(t)) {
    const h = optimizationHints(product, P, r.mode)
    return 'Leviers testés sur le moteur (impact sur le prix de vente) :\n' +
      h.map((x) => `• ${x.label} : ${money(x.price)} (${x.delta >= 0 ? '+' : ''}${pct(x.pct, 1)})`).join('\n') +
      '\n\nCes simulations ne modifient pas les paramètres officiels.'
  }
  if (/compar|excel|corrig/.test(t)) {
    return `Mode Excel : ${money(r.mode === 'excel' ? T.finalPrice : other.totals.finalPrice)} / pièce\n` +
      `Mode corrigé : ${money(r.mode === 'corrected' ? T.finalPrice : other.totals.finalPrice)} / pièce\n\n` +
      'Le mode corrigé (1) divise par l\'efficacité au lieu de la multiplier, (2) n\'applique l\'efficacité chaîne qu\'une fois, (3) répartit le rebut sur les pièces bonnes, (4) inclut le prix des pigments. À valider avec Slah avant usage officiel.'
  }
  if (/rebut|scrap|d[ée]chet/.test(t)) {
    return `Rebut saisi : ${pct(T.scrap)} → ${num(T.totalQty)} pièces à produire pour ${num(T.quantity)} commandées.\n` +
      `Règle MYC (conditions 25TN008) : diamètre < ${P.scrap_rule.threshold_mm} mm → ${pct(P.scrap_rule.below)}, sinon ${pct(P.scrap_rule.above)}. Pour cette pièce (diag. ${num(r.geometry.diagonal, 1)} mm) : ${pct(r.suggestedScrap)}.\n` +
      (r.mode === 'excel' ? 'Dans Excel, le rebut agit sur les heures de production mais pas sur le prix unitaire.' : 'En mode corrigé, le coût unitaire est multiplié par (1 + rebut).')
  }
  if (/peinture|paint|consommation/.test(t)) {
    return `Conso : ${num(r.paint.consPerPiece, 3)} g/pièce (somme des couches × coef. surface ${num(r.paint.surfaceCoef, 3)}).\n` +
      `Prix peinture : ${num(r.paint.pricePerKg, 3)} $/kg → ${money(r.paint.costPerPiece, 'USD', 5)}/pièce, soit ${money(r.paint.paintShift, 'USD', 2)} par poste.\n` +
      `La peinture représente ${pct(r.breakdown['Peinture'] / T.unitCost, 1)} du prix de revient.`
  }
  if (/mod|main|op[ée]rateur|ouvrier|labor/.test(t)) {
    return `${r.labor.workers} opérateurs × ${P.hourly.labor_per_worker} $/h × ${P.shift_hours} h = ${money(r.labor.laborShift, 'USD', 2)} par poste → ${money(r.breakdown["Main-d'œuvre (MOD)"], 'USD', 5)} par pièce.`
  }
  if (/capacit|cadence|heure|temps|vitesse/.test(t)) {
    return `Chaîne ${PROCESS_LABEL[product.process]} : ${num(r.capacity.perHour, 0)} pcs/h, ${num(r.capacity.capacity)} pcs/poste (${r.geometry.jumps} saut(s), pas ${P.lines[product.process].spacing_mm} mm, ${P.lines[product.process].speed_m_min} m/min).\n` +
      `Production de ${num(T.totalQty)} pcs : ${T.productionHours} h (${num(T.shifts, 1)} postes).\nCapacité machine de métallisation : ${num(r.capacity.machine.capacity)} pcs/poste.`
  }
  if (/quantit|prix pour|combien/.test(t) && qtyMatch) {
    let q = parseFloat(qtyMatch[1].replace(/\s/g, '').replace(',', '.'))
    if (qtyMatch[2] === 'k') q *= 1000
    if (q > 0) {
      const c = coefForQuantity(q, P, product.client_type, product.color)
      return `Pour ${num(q)} pièces : coefficient ${c} × X (${money(T.finalPrice)}) = ${money(T.finalPrice * c)} / pièce, total ${money(T.finalPrice * c * q, 'USD', 2)}${q < P.handling_cost.below_qty ? ` + ${P.handling_cost.amount} $ de handling` : ''}.`
    }
  }
  if (/expli|pourquoi|comment|d[ée]tail|prix/.test(t)) {
    return `Prix de vente ${money(T.finalPrice)} pour ${product.client} / ${product.reference} :\n` +
      `1. Coût par poste de ${P.shift_hours} h = process ${money(r.process.total, 'USD', 2)} + MOD ${money(r.labor.laborShift, 'USD', 2)} + peinture ${money(r.paint.paintShift, 'USD', 2)} = ${money(T.totalShift, 'USD', 2)}\n` +
      `2. Capacité = ${num(r.capacity.capacity)} pièces par poste\n` +
      `3. Prix de revient = ${money(T.unitCost, 'USD', 5)} (${r.mode === 'excel' ? `× efficacité ${P.daily_efficiency}` : `÷ efficacité ${P.daily_efficiency}, × (1+rebut)`})\n` +
      `4. Prix client = revient × ${num(T.commercialFactor, 3)}${product.jig_price ? ` + gabarit ${product.jig_price}` : ''}${product.color_coef !== 1 ? ` × coef couleur ${product.color_coef}` : ''}`
  }
  return "Je peux : expliquer le prix, détecter les anomalies, comparer Excel / corrigé, proposer des optimisations, détailler peinture, MOD, capacité, rebut, calculer le prix pour une quantité (ex. « prix pour 15000 pièces ») ou trouver comment atteindre un objectif (ex. « objectif prix 0,45 », « objectif marge 45 % », « objectif capacité 15000 »)."
}

