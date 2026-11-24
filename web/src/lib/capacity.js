// =====================================================================
//  Capacité & planning projet — reproduit « Project management » (KIKO 650K)
//  Cadence/h = 3600 / temps de cycle × efficacité × nb machines
//  (injection : cycle machine / empreintes ; métallisation : vitesse chaîne et sauts)
// =====================================================================
const n = (v) => Number(v) || 0

export function cycleOf(op) {
  if (op.kind === 'injection') return n(op.machineCycle) / Math.max(1, n(op.cavities))
  if (op.kind === 'metallization') {
    // Excel : 60 / ((1000 / 44,45) / (sauts + 1) × vitesse)
    const pitch = n(op.pitchMm) || 44.45
    return 60 / (((1000 / pitch) / (n(op.jumps) + 1)) * n(op.speed))
  }
  return n(op.cycle)
}

export function computeCapacity(d, mode = 'excel') {
  const ops = (d.operations || []).map((op) => {
    const cycle = cycleOf(op)
    const machines = Math.max(1, n(op.machines))
    const hourly = cycle > 0 ? (3600 / cycle) * n(op.efficiency) * machines : 0
    // Excel applique l'efficacité une 2e fois sur la capacité journalière des lignes de métallisation
    const double = mode === 'excel' && op.kind === 'metallization'
    const daily = hourly * n(op.hoursPerShift) * n(op.shiftsPerDay) * (double ? n(op.efficiency) : 1)
    const weekly = daily * n(op.daysPerWeek)
    const objective = n(op.objective)
    const mod = n(op.modPerShift) * n(op.shiftsPerDay) * machines
    return { ...op, cycle, hourly, daily, weekly, objective, coverage: objective ? weekly / objective : null, mod, doubleEff: double }
  })

  // Planning : besoin client par semaine ; chaque opération produit à sa cadence à partir de sa semaine de démarrage
  const weeks = d.weeks || []
  const need = weeks.map((w) => n(w.need))
  const totalNeed = need.reduce((a, b) => a + b, 0)
  const plan = ops.map((op) => {
    const startIdx = Math.max(0, weeks.findIndex((w) => w.label === op.startWeek))
    const target = totalNeed * (1 + n(op.scrap))
    let made = 0, stock = 0
    const rows = weeks.map((w, i) => {
      let out = 0
      if (i >= startIdx && made < target) {
        const ramp = i === startIdx ? n(op.rampFirstWeek ?? 1) : 1
        out = Math.min(op.weekly * ramp, target - made)
      }
      made += out
      stock += out - need[i]
      return { week: w.label, output: out, stock, mod: out > 0 ? op.mod : 0 }
    })
    const endIdx = rows.reduce((acc, r, i) => (r.output > 0 ? i : acc), -1)
    const shortage = rows.find((r) => r.stock < -0.5) // tolérance d'arrondi
    return { id: op.id, label: `${op.process} — ${op.component}`, kind: op.kind, startIdx, endIdx, rows, made, target, shortage: shortage ? shortage.week : null }
  })

  const modPerWeek = weeks.map((w, i) => plan.reduce((a, p, k) => a + (p.rows[i].output > 0 ? ops[k].mod : 0), 0))
  const bottleneck = ops.filter((o) => o.objective).reduce((min, o) => (!min || o.coverage < min.coverage ? o : min), null)
  return { ops, plan, need, totalNeed, modPerWeek, bottleneck }
}
