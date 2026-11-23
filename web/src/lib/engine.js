// =====================================================================
//  MYC Smart Costing — moteur de calcul de chiffrage métallisation
//  Reproduit les formules Excel de Slah Dridi (mode "excel")
//  et propose une variante corrigée (mode "corrected") à valider.
// =====================================================================

export const ENGINE_VERSION = 'myc-metal-1.0.0'

const PI_EXCEL = 3.14159 // valeur utilisée dans COST PAINT-VACCUM!B20
const floorTo = (x, step) => Math.floor(x / step) * step // Excel FLOOR(x; step)
const roundUp = (x, d = 0) => { const f = 10 ** d; return Math.ceil(x * f - 1e-9) / f } // Excel ROUNDUP
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0)

export function surfaceOf(shape, { length = 0, width = 0, height = 0, d1 = 0, d2 = 0 }) {
  if (shape === 'circular') {
    // (π * ((D1+D2)/2) * H) + (π * D1 * D2 / 2)
    return PI_EXCEL * ((d1 + d2) / 2) * height + (PI_EXCEL * d1 * d2) / 2
  }
  // 2 * (L*l + L*H + l*H)
  return 2 * (length * width + length * height + width * height)
}

export function diagonalOf(shape, { length = 0, width = 0, d1 = 0, d2 = 0 }) {
  if (shape === 'circular') return Math.max(d1, d2)
  return Math.sqrt(length * length + width * width) // SQRT(F10²+H10²)
}

export function lineCapacity(line, hours, method, mode, jumpsOverride) {
  const spacing = line.spacing_mm / 1000
  const jumps = jumpsOverride ?? line.jumps
  const eff = line.efficiency
  let distance, perHour, perShift
  if (method === 'pitch') {
    // E16 = C16*(B16+1) ; H16 = (3600/G16)*J16 ; K16 = FLOOR(J16*I16*H16; 1000)
    distance = spacing * (jumps + 1)
    const rawPerHour = (60 * line.speed_m_min) / distance
    perHour = rawPerHour * eff
    // En mode Excel l'efficacité est appliquée deux fois (H16 et K16)
    perShift = floorTo((mode === 'excel' ? eff : 1) * hours * perHour, 1000)
  } else {
    // E16 = C16*B16 ; G16 = F16/E16 ; J16 = FLOOR(I16*H16*G16; 1000)
    distance = spacing * jumps
    perHour = (60 * line.speed_m_min) / distance
    perShift = floorTo(eff * hours * perHour, 1000)
  }
  return { jumps, distance, perHour, perShift, secondsPerPiece: 3600 / perHour }
}

export function vacuumMachineCapacity(vm, jumps, method) {
  const pcsPerSteel = Math.floor(vm.steel_length / (method === 'pitch' ? jumps + 1 : jumps))
  const capacity = floorTo(
    pcsPerSteel * vm.square_steel_per_turntable * vm.turntables_per_machine * vm.machines *
      vm.cycles_per_hour * vm.hours * vm.efficiency, 100)
  return { pcsPerSteel, capacity }
}

export function paintCost(paint, surfaceCoef, mode) {
  const base = paint.base || []
  const pig = paint.pigments || []
  const sumBase = sum(base.map((p) => p.cons))
  const sumPig = sum(pig.map((p) => p.cons))
  const sumAll = sumBase + sumPig
  const coef = paint.use_surface_coef ? surfaceCoef : 1
  const consPerPiece = sumAll * coef // K18 (g)
  const shareBase = sumAll ? sumBase / sumAll : 0 // B19
  const includePig = mode === 'corrected' ? true : !!paint.include_pigments
  const sharePig = sumAll && includePig ? sumPig / sumAll : 0 // E19 (×0 dans Excel)
  const maxBase = Math.max(0, ...base.map((p) => p.price))
  const maxPig = pig.length ? Math.max(0, ...pig.map((p) => p.price)) : 0
  // Méthode Excel (K17) : prix max des couches × part ; méthode « weighted » : moyenne pondérée par la consommation (coût réel)
  const weighted = (paint.price_method === 'weighted' || mode === 'corrected')
  const sumW = (list) => list.reduce((acc, p) => acc + (Number(p.price) || 0) * (Number(p.cons) || 0), 0)
  const rawPrice = weighted
    ? (sumAll ? (sumW(base) + (includePig ? sumW(pig) : 0)) / (sumBase + (includePig ? sumPig : 0)) : 0)
    : maxBase * shareBase + maxPig * sharePig
  const moqFactor = paint.below_moq ? 1 + (Number(paint.moq_surcharge) || 0) : 1
  const pricePerKg = rawPrice * paint.shipment_coef * moqFactor // K17
  const costPerPiece = (pricePerKg / 1000) * consPerPiece // P8
  return { sumBase, sumPig, consPerPiece, shareBase, sharePig, pricePerKg, costPerPiece, surfaceCoef: coef, method: weighted ? 'weighted' : 'max', moqFactor }
}

export function processCostPerShift(P, process) {
  const h = P.shift_hours
  const c = P.consumables
  const hr = P.hourly
  const consumablesTotal = sum(Object.values(c)) // I7
  if (process === 'vacuum') {
    // K11 = B12 + E12 + F12 + G12
    const items = {
      'Amortissement UV + vide': hr.amort_uv_vacuum * h,
      'Location': hr.location * h,
      'Autres (électricité…)': hr.other_elec * h,
      'Consommables vide': consumablesTotal,
    }
    return { total: sum(Object.values(items)), items, consumablesTotal }
  }
  // L11 = A7+B7+E7+F7+G7 + C12 + E12 + F12
  const items = {
    'Consommables cabine': c.spray_booth_filters + c.other_consumables + c.gun_cleaning_fluid + c.filters + c.oil_pipes,
    'Amortissement peinture': hr.amort_paint * h,
    'Location': hr.location * h,
    'Autres (électricité…)': hr.other_elec * h,
  }
  return { total: sum(Object.values(items)), items, consumablesTotal }
}

export function suggestedScrap(P, diagonal) {
  const r = P.scrap_rule
  return diagonal < r.threshold_mm ? r.below : r.above
}

/**
 * Calcul complet d'une pièce.
 * @param {object} product  caractéristiques de la pièce (voir DEFAULT_PRODUCT)
 * @param {object} P        jeu de paramètres (voir DEFAULT_PARAMS)
 * @param {'excel'|'corrected'} mode
 */
export function computeCosting(product, P, mode = 'excel') {
  const process = product.process
  const hours = P.shift_hours
  // surface_override : surface réelle mesurée sur le modèle 3D (optionnel, sinon formule Excel)
  const surface = Number(product.surface_override) > 0 ? Number(product.surface_override) : surfaceOf(product.shape, product)
  const diagonal = diagonalOf(product.shape, product)
  const refSurface = surfaceOf(P.reference_surface.shape, {
    length: P.reference_surface.l, width: P.reference_surface.w, height: P.reference_surface.h,
    d1: P.reference_surface.d1, d2: P.reference_surface.d2,
  })
  const surfaceCoef = refSurface ? surface / refSurface : 1 // B24

  const line = P.lines[process]
  const quotient = roundUp(diagonal / line.spacing_mm, 1) // A16 = ROUNDUP((J7/C16)/1000;1)
  const autoJumps = Math.max(1, Math.ceil(diagonal / line.spacing_mm - 1e-9))
  const jumps = product.jumps ? Number(product.jumps) : autoJumps
  const cap = lineCapacity(line, hours, P.capacity_method, mode, jumps)
  // Cadence réelle mesurée (pcs/h) : remplace la capacité théorique de la chaîne si elle est saisie
  const measured = Number(product.cadence_per_hour) > 0 ? Number(product.cadence_per_hour) : 0
  const capacity = measured ? Math.round(measured * hours) : cap.perShift // N7
  const machine = vacuumMachineCapacity(P.vacuum_machine, jumps, P.capacity_method)
  const cadence = {
    theoretical: (60 * line.speed_m_min) / cap.distance, // pcs/h sans arrêt
    line: cap.perHour, // pcs/h après efficacité chaîne
    effective: capacity / hours, // pcs/h retenus pour le chiffrage (capacité / heures du poste)
    machine: machine.capacity / (P.vacuum_machine.hours || hours), // pcs/h de la métallisation sous vide
    measured: measured || null,
    source: measured ? 'measured' : 'computed',
  }

  const paint = paintCost(P.paint, surfaceCoef, mode)
  const paintShift = paint.costPerPiece * capacity // O8
  const workers = P.workers[process] // Q7
  const laborShift = P.hourly.labor_per_worker * workers * hours // Q8
  const proc = processCostPerShift(P, process) // R7
  const totalShift = proc.total + laborShift + paintShift // T7
  const perHour = totalShift / hours // V7

  const scrap = Number(product.scrap) || 0
  const qty = Number(product.quantity) || 0
  const totalQty = qty + qty * scrap // E7
  const eff = P.daily_efficiency // S7

  let unitCost
  if (mode === 'excel') {
    unitCost = capacity ? (totalShift / capacity) * eff : 0 // W7 = T7/N7*S7
  } else {
    // Corrigé : l'efficacité réduit la production réelle → divise ; le rebut est réparti sur les bonnes pièces
    unitCost = capacity ? (totalShift / (capacity * eff)) * (1 + scrap) : 0
  }
  const factor = capacity ? (mode === 'excel' ? eff / capacity : (1 + scrap) / (capacity * eff)) : 0
  const breakdown = {
    'Process / machines': proc.total * factor,
    "Main-d'œuvre (MOD)": laborShift * factor,
    'Peinture': paintShift * factor,
  }

  const commercialFactor = P.pricing_mode === 'margin' ? 1 + P.margin : P.coefficient
  const pricePerClient = unitCost * commercialFactor // Y7
  const withJig = pricePerClient + (Number(product.jig_price) || 0) // AA7
  const finalPrice = withJig * (Number(product.color_coef) || 1) // AD7

  const productionHours = capacity ? roundUp((totalQty / capacity) * hours, 0) : 0 // V9
  const shifts = capacity ? totalQty / capacity : 0

  return {
    engine: ENGINE_VERSION,
    mode,
    geometry: { surface, refSurface, surfaceCoef, diagonal, quotient, autoJumps, jumps },
    capacity: { ...cap, capacity, machine, cadence },
    paint: { ...paint, paintShift },
    labor: { workers, laborShift },
    process: proc,
    totals: {
      totalShift, perHour, unitCost, commercialFactor, pricePerClient, withJig, finalPrice,
      quantity: qty, totalQty, scrap, productionHours, shifts,
      totalAmount: finalPrice * qty,
      totalProductionCost: unitCost * qty,
      grossMargin: (finalPrice - unitCost) * qty,
    },
    breakdown,
    suggestedScrap: suggestedScrap(P, diagonal),
  }
}

/** Grille de prix commerciale (QUOTATION STANDARD FORMULA) à partir de X = prix TN 50K */
export function commercialTiers(basePrice50k, P, clientType = 'known', color = 'standard') {
  const key = `${clientType === 'new' ? 'new' : 'known'}_${color === 'special' ? 'special' : 'standard'}`
  const coefs = P.commercial_grid[key]
  return P.tiers.map((t, i) => {
    const unit = basePrice50k * coefs[i]
    const handling = t.qty < P.handling_cost.below_qty ? P.handling_cost.amount : 0
    return { ...t, coef: coefs[i], unit, handling, total: unit * t.qty + handling }
  })
}

/** Prix au volume pour une quantité quelconque (interpolation par palier inférieur) */
export function coefForQuantity(qty, P, clientType, color) {
  const key = `${clientType === 'new' ? 'new' : 'known'}_${color === 'special' ? 'special' : 'standard'}`
  const coefs = P.commercial_grid[key]
  let idx = 0
  P.tiers.forEach((t, i) => { if (qty >= t.qty) idx = i })
  return coefs[idx]
}

/** Assistant de contrôle : détection d'anomalies (règles métier) */
export function detectAnomalies(product, P, r) {
  const out = []
  const add = (level, title, text) => out.push({ level, title, text })

  if (P.capacity_method === 'pitch' && r.mode === 'excel') {
    add('warning', 'Efficacité appliquée deux fois',
      `La capacité chaîne applique l'efficacité ${P.lines[product.process].efficiency} dans H16 et dans K16. Capacité réelle possible sans double application : ${floorTo(r.capacity.perHour * P.shift_hours, 1000).toLocaleString('fr-FR')} pcs/poste.`)
  }
  if (r.mode === 'excel') {
    add('warning', 'Efficacité journalière multipliée',
      `W7 = T7/N7 × ${P.daily_efficiency}. Une baisse d'efficacité diminue le coût unitaire, ce qui est contre-intuitif. Mode corrigé : diviser par l'efficacité.`)
    if (r.totals.scrap > 0) {
      add('info', 'Rebut non intégré au prix',
        `Le rebut de ${(r.totals.scrap * 100).toFixed(0)} % sert uniquement à calculer la quantité à produire (${Math.round(r.totals.totalQty).toLocaleString('fr-FR')} pcs) et les heures, pas le prix unitaire.`)
    }
  }
  if (!P.paint.include_pigments && (P.paint.pigments || []).some((p) => p.cons > 0) && r.mode === 'excel') {
    add('warning', 'Pigments exclus du prix peinture',
      `E19 est multiplié par 0 : ${r.paint.sumPig.toFixed(4)} g de pigments sont consommés mais leur coût n'est pas compté.`)
  }
  const sugg = r.suggestedScrap
  if (Math.abs(sugg - r.totals.scrap) > 1e-6) {
    add('info', 'Taux de rebut différent de la règle commerciale',
      `Diagonale ${r.geometry.diagonal.toFixed(1)} mm → règle MYC : ${(sugg * 100).toFixed(0)} % (saisi : ${(r.totals.scrap * 100).toFixed(0)} %).`)
  }
  if (product.jumps && Number(product.jumps) !== r.geometry.autoJumps) {
    add('info', 'Nombre de sauts saisi manuellement',
      `Suggestion d'après diagonale/pas : ${r.geometry.autoJumps} saut(s) ; valeur utilisée : ${product.jumps}.`)
  }
  if (product.process === 'vacuum' && r.capacity.machine.capacity < r.capacity.capacity) {
    add('danger', 'Goulot : machine de métallisation',
      `Capacité machine (${r.capacity.machine.capacity.toLocaleString('fr-FR')} pcs/poste) inférieure à la capacité chaîne (${r.capacity.capacity.toLocaleString('fr-FR')}).`)
  }
  if (r.geometry.surfaceCoef > 5 && P.paint.use_surface_coef) {
    add('info', 'Surface très supérieure à la référence',
      `Coefficient de surface ${r.geometry.surfaceCoef.toFixed(2)} → consommation ${r.paint.consPerPiece.toFixed(2)} g/pièce. À confirmer par essai.`)
  }
  if (r.capacity.capacity <= 0) add('danger', 'Capacité nulle', 'Vérifier la vitesse, le pas et le nombre de sauts.')
  const marginPct = r.totals.finalPrice ? (r.totals.finalPrice - r.totals.unitCost) / r.totals.finalPrice : 0
  if (marginPct < 0.2) add('danger', 'Marge faible', `Marge brute ${(marginPct * 100).toFixed(1)} % (< 20 %).`)
  if (!out.length) add('success', 'Aucune anomalie', 'Les paramètres sont cohérents avec les règles connues.')
  return out
}

/** Suggestions d'optimisation : sensibilité du prix à chaque levier */
export function optimizationHints(product, P, mode) {
  const base = computeCosting(product, P, mode).totals.finalPrice
  const clone = (o) => JSON.parse(JSON.stringify(o))
  const tests = [
    ['Vitesse chaîne +10 %', (p) => { p.lines[product.process].speed_m_min *= 1.1 }],
    ['1 opérateur de moins', (p) => { p.workers[product.process] -= 1 }],
    ['Consommation peinture −10 %', (p) => { p.paint.base.forEach((x) => { x.cons *= 0.9 }) }],
    ['Prix peinture −5 %', (p) => { p.paint.base.forEach((x) => { x.price *= 0.95 }) }],
    ['Efficacité chaîne 0,95', (p) => { p.lines[product.process].efficiency = 0.95 }],
  ]
  return tests.map(([label, fn]) => {
    const p = clone(P); fn(p)
    const v = computeCosting(product, p, mode).totals.finalPrice
    return { label, price: v, delta: v - base, pct: base ? (v - base) / base : 0 }
  }).sort((a, b) => a.delta - b.delta)
}
