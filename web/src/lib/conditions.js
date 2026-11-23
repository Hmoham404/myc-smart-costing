// Conditions MYC applicables à une pièce (classeurs de Slah : 25TN008, QUOTATION STANDARD FORMULA, TEST RESULT)
import { num } from './format.js'

/**
 * @returns [{ group, title, text, status: 'applies'|'ok'|'warn'|'info' }]
 */
export function conditionsFor(piece, product, r, P, quantity) {
  const out = []
  const add = (group, status, title, text) => out.push({ group, status, title, text })
  const diag = r.geometry.diagonal
  const rule = P.scrap_rule

  // ---- Production ----
  const scrapRule = diag < rule.threshold_mm ? rule.below : rule.above
  add('Production', Math.abs(scrapRule - product.scrap) < 1e-9 ? 'ok' : 'warn', `Rebut autorisé : ${num(scrapRule * 100, 0)} %`,
    `Diamètre / diagonale ${num(diag, 1)} mm ${diag < rule.threshold_mm ? '<' : '≥'} ${rule.threshold_mm} mm → ${num(scrapRule * 100, 0)} %` +
    (Math.abs(scrapRule - product.scrap) > 1e-9 ? ` (le calcul utilise ${num(product.scrap * 100, 0)} %).` : '.'))
  add('Production', 'info', `Pas de chaîne : ${r.geometry.jumps} saut(s)`,
    `Diagonale ÷ pas ${P.lines[product.process].spacing_mm} mm = ${num(diag / P.lines[product.process].spacing_mm, 2)} → ${r.geometry.autoJumps} saut(s). ${r.capacity.machine.pcsPerSteel} pièces par carré acier.`)
  add('Production', r.capacity.machine.capacity < r.capacity.capacity ? 'warn' : 'ok', `Capacité : ${num(r.capacity.capacity)} pcs / poste`,
    `Chaîne ${num(r.capacity.capacity)} pcs, machine de métallisation ${num(r.capacity.machine.capacity)} pcs` +
    (r.capacity.machine.capacity < r.capacity.capacity ? ' → la machine est le goulot.' : '.') + ` Production : ${r.totals.productionHours} h pour ${num(r.totals.totalQty)} pcs.`)
  add('Production', r.capacity.cadence.source === 'measured' ? 'applies' : 'info', `Cadence : ${num(r.capacity.cadence.effective, 0)} pcs / h`,
    r.capacity.cadence.source === 'measured' ? 'Cadence réelle mesurée saisie (remplace le calcul théorique).' : `Calculée : ${num(r.capacity.capacity)} pcs par poste de ${P.shift_hours} h (chaîne ${num(r.capacity.cadence.line, 0)} pcs/h, machine ${num(r.capacity.cadence.machine, 0)} pcs/h).`)
  add('Production', 'info', `Peinture : ${num(r.paint.consPerPiece, 2)} g / pièce`,
    `Surface ${num(r.geometry.surface, 0)} mm² (${product.surface_override ? 'mesurée sur le modèle 3D' : 'formule Excel'}), coef. ${num(r.geometry.surfaceCoef, 2)} × réf. PUPA. Consommation théorique, à confirmer par essai.`)

  // ---- Commercial ----
  const handling = quantity < P.handling_cost.below_qty
  add('Commercial', handling ? 'applies' : 'ok', handling ? `Frais de handling : +${P.handling_cost.amount} $` : 'Pas de frais de handling',
    `Quantité ${num(quantity)} ${handling ? '<' : '≥'} ${num(P.handling_cost.below_qty)} pcs.` + (handling ? ' Une pré-série peut être absorbée en répartissant ces 300 $ sur la quantité.' : ''))
  add('Commercial', 'applies', `Frais d'artwork : ${P.artwork_cost} $ par référence`, 'Artwork Origination Costs (conditions 25TN008).')
  if (product.color === 'special') {
    add('Commercial', 'applies', 'Couleur spéciale', 'Grille « special color » ; prix × 1,15 au lieu de 1,05 uniquement avec accord DG (note 25TN008-TN).')
  } else {
    add('Commercial', 'ok', 'Couleur standard (or / argent)', 'Grille « standard color » : 5K 1,8X · 10K 1,2X · 25K 1,1X · 50K X · 100K 0,95X.')
  }
  add('Commercial', 'info', 'Incoterm & paiement', 'EXW Tunisia · 30 % à la commande, solde avant expédition (ou 60 jours fin de mois selon RFQ).')
  add('Commercial', 'info', 'Délais & validité', '3 semaines pour la PPS après validation artwork, puis 9 à 10 semaines · offre valable 60 jours (révision si change / matière > 5 %).')
  add('Commercial', 'info', 'Qualité', 'Tolérance quantité ±5 % · AQL critique 0,65 · tests de compatibilité à la charge du client.')

  // ---- Spécifiques à la pièce ----
  ;(piece?.notes || []).forEach((n) => {
    const i = n.indexOf(':')
    if (i > 0) add('Pièce', 'info', n.slice(0, i).trim(), n.slice(i + 1).trim())
    else add('Pièce', 'info', n, '')
  })
  if (piece?.samples) {
    const s = piece.samples
    const gap = s.received - s.ok - s.nok
    add('Pièce', gap ? 'warn' : 'ok', `Échantillons : ${s.ok} OK / ${s.received} reçus`,
      `${s.nok} non OK, taux OK ${num((s.ok / s.received) * 100, 1)} %` + (gap ? ` · ${gap} pièce(s) non classée(s).` : '.'))
  }
  return out
}
