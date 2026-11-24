// =====================================================================
//  Moteur unique d'un projet injection : UNE définition (composants + procédés
//  + besoin client) → Chiffrage, CBN, Capacité, Planning et Gantt automatiques.
//  Formules reprises des classeurs : YZA089A (chiffrage), YZA067A (CBN),
//  KIKO YZA037 (capacité, planning, Gantt).
// =====================================================================
const n = (v) => Number(v) || 0
const norm = (s) => String(s ?? '').trim().toLowerCase()
export const findIn = (list, name) => (list || []).find((x) => norm(x.name) === norm(name))

export const CATEGORIES = {
  injection: 'Injection',
  decoration: 'Décoration SS/HS',
  painting: 'Peinture',
  metallization: 'Métallisation',
  assembly: 'Assemblage / soudure',
  packaging: 'Emballage',
}

/** Temps de cycle par pièce (s) d'une opération */
export function opCycle(op, comps) {
  if (op.category === 'injection') {
    const c = comps.find((x) => x.id === op.componentIds?.[0])
    return c ? n(c.cycle) / Math.max(1, n(c.cavities)) : 0
  }
  if (op.category === 'metallization' && n(op.speed) > 0) {
    // Excel KIKO : 60 / ((1000 / 44,45) / (sauts + 1) × vitesse)
    return 60 / (((1000 / (n(op.pitchMm) || 44.45)) / (n(op.jumps) + 1)) * n(op.speed))
  }
  return n(op.cycle)
}

const appliesTo = (op, compId) => !op.componentIds?.length || op.componentIds.includes(compId)

// ------------------------------------------------------------------ CHIFFRAGE
export function computeCosting(d, lib = {}) {
  const comps = d.components || []
  const ops = d.operations || []
  const missing = []

  const resin = comps.map((c) => {
    const injOp = ops.find((o) => o.category === 'injection' && o.componentIds?.[0] === c.id)
    const cav = Math.max(1, n(c.cavities))
    const unitWeight = n(c.netWeight) + n(c.runnerWeight) / cav // YZA089A : K = F + I / empreintes
    const mat = findIn(lib.materials, c.material)
    const mb = findIn(lib.masterbatches, c.masterbatch)
    if (!mat && c.material) missing.push(`Prix matière « ${c.material} » absent de la bibliothèque`)
    const share = n(c.mbShare)
    const base = (n(mat?.price) / 1000) * unitWeight * n(c.qtyPerProduct || 1) * (1 + n(c.rejectInjection))
    const mbCost = (n(mb?.price) / 1000) * unitWeight * n(c.qtyPerProduct || 1) * (1 + n(c.rejectInjection))
    const cost = (base * (1 - share) + mbCost * share) * (1 + n(c.asmReject))
    return { id: c.id, name: c.name, unitWeight, price: n(mat?.price), cost, injOp }
  })

  const machineOf = (name) => findIn(lib.machines, name)
  const opsCost = ops.filter((o) => o.category !== 'packaging').map((o) => {
    const cyc = opCycle(o, comps)
    const capacity = cyc > 0 ? 3600 / cyc : 0 // pièces / h pour UNE machine
    const m = o.category === 'assembly' ? (findIn(lib.assembly, o.step || o.label) || machineOf(o.machine)) : machineOf(o.machine)
    const labor = n(m?.labor ?? o.labor), machine = n(m?.machineCost ?? o.machineCost)
    let cost = 0
    if (n(o.unitCost) > 0) cost = n(o.unitCost) // coût saisi (ex. métallisation chiffrée dans l'espace Métallisation)
    else if (capacity > 0) {
      cost = (machine + labor * n(o.workers)) / capacity
      if (o.category === 'decoration') cost += (n(findIn(lib.inks, o.ink)?.price) * n(o.inkWeight)) / 1000
      if (o.category === 'injection') {
        const c = comps.find((x) => x.id === o.componentIds?.[0])
        cost *= (1 + n(c?.rejectInjection)) * (1 + n(o.asmReject)) // YZA089A : ×(1+rebut machine) ×(1+rebut assemblage)
      } else cost *= (1 + n(o.reject))
    } else if (o.category !== 'metallization') missing.push(`Cycle manquant : ${o.label}`)
    const qtyFactor = o.category === 'injection' ? n(comps.find((c) => c.id === o.componentIds?.[0])?.qtyPerProduct || 1) : 1
    return { id: o.id, label: o.label, category: o.category, capacity, labor, machineCost: machine, cost: cost * qtyFactor }
  })

  const purchased = (d.purchased || []).map((p) => {
    const unit = n(findIn(lib.components, p.name)?.price ?? p.unitCost)
    return { ...p, unit, cost: unit * n(p.qty) * (1 + n(p.reject)) }
  })

  const pk = d.packing || {}
  const perCarton = n(pk.layers) * n(pk.perLayer)
  const packItems = (pk.items || []).map((x) => { const unit = n(findIn(lib.packaging, x.name)?.price ?? x.unitCost); return { ...x, unit, total: unit * n(x.qty) } })
  const packing = perCarton ? packItems.reduce((a, x) => a + x.total, 0) / perCarton : 0

  const sumCat = (cat) => opsCost.filter((o) => o.category === cat).reduce((a, o) => a + o.cost, 0)
  const sections = {
    resin: resin.reduce((a, x) => a + x.cost, 0),
    injection: sumCat('injection'),
    decoration: sumCat('decoration') + sumCat('painting'),
    metallization: sumCat('metallization'),
    purchased: purchased.reduce((a, x) => a + x.cost, 0),
    assembly: sumCat('assembly'),
    packing,
    transport: n(d.transport),
  }
  const total = Object.values(sections).reduce((a, b) => a + b, 0)
  const qty = n(d.quantity)
  return { resin, ops: opsCost, purchased, packItems, perCarton, sections, total, salePrice: total * (1 + n(d.margin)), orderCost: total * qty, missing: [...new Set(missing)] }
}

export const SECTION_LABEL = {
  resin: 'Matière', injection: 'Injection', decoration: 'Décoration / peinture', metallization: 'Métallisation',
  purchased: 'Composants achetés', assembly: 'Assemblage', packing: 'Emballage', transport: 'Transport',
}

// ------------------------------------------------------------------ CBN (calcul des besoins nets)
export function computeCBN(d) {
  const ops = d.operations || []
  // Un taux par étape (comme YZA067A) : si plusieurs opérations d'une même famille, on retient le plus élevé
  const rej = (compId, cats) => Math.max(0, ...ops.filter((o) => cats.includes(o.category) && appliesTo(o, compId)).map((o) => n(o.reject)))
  const items = (d.components || []).map((c) => {
    const E = n(d.quantity) * n(c.qtyPerProduct || 1)
    const r = { injection: n(c.rejectInjection), decoration: rej(c.id, ['decoration']), painting: rej(c.id, ['painting', 'metallization']), assembly: rej(c.id, ['assembly']) }
    const H = E * r.injection
    const J = (E + H) * r.decoration
    const L = (E + H + J) * r.painting
    const M = (E + H + J + L) * r.assembly
    const toProduce = E + H + J + L + M
    const cav = Math.max(1, n(c.cavities))
    const shots = Math.ceil(toProduce / cav - 1e-9) + n(c.startupCycles)
    const shotWeight = n(c.netWeight) * cav + n(c.runnerWeight)
    const totalKg = (shots * shotWeight) / 1000
    const share = n(c.mbShare)
    return { id: c.id, name: c.name, reference: c.reference, material: c.material, masterbatch: c.masterbatch, planned: E, rates: r, scrap: { injection: H, decoration: J, painting: L, assembly: M }, toProduce, shots, shotWeight, totalKg, resinKg: totalKg * (1 - share), mbKg: totalKg * share }
  })
  const by = {}
  for (const it of items) {
    if (it.material) by[it.material] = (by[it.material] || 0) + it.resinKg
    if (it.masterbatch && it.mbKg) by[it.masterbatch] = (by[it.masterbatch] || 0) + it.mbKg
  }
  return { items, orders: Object.entries(by).map(([name, kg]) => ({ name, kg })), totalKg: items.reduce((a, x) => a + x.totalKg, 0) }
}

// ------------------------------------------------------------------ CAPACITÉ
export function computeCapacity(d, mode = 'excel') {
  const comps = d.components || []
  const S = d.schedule || {}
  const peak = Math.max(0, ...(d.weeks || []).map((w) => n(w.need)))
  const ops = (d.operations || []).map((o) => {
    const get = (k) => (n(o[k]) > 0 ? n(o[k]) : n(S[k])) // vide ou 0 = valeur par défaut du projet
    const cycle = opCycle(o, comps)
    const machines = Math.max(1, n(o.machines) || 1)
    const eff = get('efficiency')
    const hourly = cycle > 0 ? (3600 / cycle) * eff * machines : 0
    const double = mode === 'excel' && o.category === 'metallization' // Excel KIKO : efficacité appliquée 2× sur la métallisation
    const daily = hourly * get('hoursPerShift') * get('shiftsPerDay') * (double ? eff : 1)
    const weekly = daily * get('daysPerWeek')
    const objective = n(o.objective) || peak
    return { ...o, cycle, machines, efficiency: eff, hoursPerShift: get('hoursPerShift'), shiftsPerDay: get('shiftsPerDay'), daysPerWeek: get('daysPerWeek'),
      hourly, daily, weekly, objective, coverage: objective ? weekly / objective : null, mod: n(o.workers) * get('shiftsPerDay') * machines, doubleEff: double }
  })
  const bottleneck = ops.filter((o) => o.objective && o.weekly > 0).reduce((m, o) => (!m || o.coverage < m.coverage ? o : m), null)
  return { ops, peak, bottleneck }
}

// ------------------------------------------------------------------ PLANNING
export function computePlanning(d, cap) {
  const weeks = d.weeks || []
  const need = weeks.map((w) => n(w.need))
  const totalNeed = need.reduce((a, b) => a + b, 0)
  const plan = cap.ops.map((op) => {
    const start = Math.max(0, weeks.findIndex((w) => w.label === op.startWeek))
    const stopAt = op.endWeek ? weeks.findIndex((w) => w.label === op.endWeek) : -1 // semaine de fin optionnelle (ex. renfort)
    const target = totalNeed * (1 + n(op.reject))
    let made = 0, stock = 0
    const rows = weeks.map((w, i) => {
      let out = 0
      if (i >= start && (stopAt < 0 || i <= stopAt) && made < target && op.weekly > 0) out = Math.min(op.weekly * (i === start ? n(op.ramp ?? 1) || 1 : 1), target - made)
      made += out; stock += out - need[i]
      return { week: w.label, output: out, stock }
    })
    const endIdx = rows.reduce((acc, r, i) => (r.output > 0 ? i : acc), -1)
    const short = rows.find((r) => r.stock < -0.5)
    return { id: op.id, label: op.label, category: op.category, startIdx: start, endIdx, rows, made, target, shortage: short?.week || null, mod: op.mod }
  })
  const modPerWeek = weeks.map((_, i) => plan.reduce((a, p) => a + (p.rows[i].output > 0 ? p.mod : 0), 0))
  return { plan, need, totalNeed, modPerWeek }
}

// ------------------------------------------------------------------ GANTT (dates & jours ouvrés)
const DAY = 86400000
export const toDate = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`) : null)
export const iso = (dt) => (dt ? new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '')
export function isoWeek(dt) {
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7)
}
/** Jours ouvrés lun–ven (Excel NETWORKDAYS). Excel KIKO ne retire pas les jours fériés : option. */
export function workDays(start, end, holidays = [], withHolidays = false) {
  const a = toDate(start), b = toDate(end)
  if (!a || !b || b < a) return 0
  const H = new Set(withHolidays ? holidays.map((h) => String(h.date).slice(0, 10)) : [])
  let count = 0
  for (let t = a.getTime(); t <= b.getTime(); t += DAY) {
    const dt = new Date(t), wd = dt.getDay()
    if (wd !== 0 && wd !== 6 && !H.has(iso(dt))) count++
  }
  return count
}
/** Lundi de la semaine i à partir de la date de début du projet */
export const weekMonday = (startDate, i) => {
  const s = toDate(startDate) || new Date()
  const monday = new Date(s.getTime() - ((s.getDay() + 6) % 7) * DAY)
  return new Date(monday.getTime() + i * 7 * DAY)
}
/** Tâches de Gantt générées depuis le planning de production */
export function tasksFromPlanning(d, planning) {
  return planning.plan.filter((p) => p.endIdx >= 0).map((p) => ({
    id: `t-${p.id}`, group: CATEGORIES[p.category] || 'Autre', name: p.label, equipment: '',
    start: iso(weekMonday(d.startDate, p.startIdx)), end: iso(new Date(weekMonday(d.startDate, p.endIdx).getTime() + 4 * DAY)), progress: 0, auto: true,
  }))
}

/** Semaines du projet à partir de la date de début (étiquettes ISO W19, W20…) */
export function buildWeeks(startDate, count, prev = []) {
  return Array.from({ length: count }, (_, i) => {
    const label = `W${isoWeek(weekMonday(startDate, i))}`
    return { label, need: n(prev.find((w) => w.label === label)?.need ?? prev[i]?.need) }
  })
}

/** Tout le projet en une passe */
export function computeProject(d, lib, mode = 'excel') {
  const costing = computeCosting(d, lib)
  const cbn = computeCBN(d)
  const capacity = computeCapacity(d, mode)
  const planning = computePlanning(d, capacity)
  return { costing, cbn, capacity, planning }
}
