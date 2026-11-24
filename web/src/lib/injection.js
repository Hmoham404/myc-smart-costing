// =====================================================================
//  Chiffrage injection plastique — reproduit « Product Costing Analysis Sheet »
//  (YZA089A : matière, injection, SS/HS, composants, assemblage, emballage, transport)
// =====================================================================
const n = (v) => Number(v) || 0
const find = (list, key, field = 'name') => (list || []).find((x) => String(x[field]).trim().toLowerCase() === String(key || '').trim().toLowerCase())

/**
 * @param {object} d  { refs:{materials,masterbatches,machines,inks,components,assembly,packaging},
 *                      resin:[], injection:[], decoration:[], components:[], assembly:[], packing:{...}, transport }
 */
export function computeInjection(d) {
  const R = d.refs || {}
  const injByPart = Object.fromEntries((d.injection || []).map((x) => [String(x.part).trim().toLowerCase(), x]))

  // 1. Matière : poids unitaire = net + carotte / nb empreintes ; coût = prix/1000 × poids × taux × (1+rebut)
  const resin = (d.resin || []).map((x) => {
    const cav = n(injByPart[String(x.part).trim().toLowerCase()]?.cavity) || 1
    const unitWeight = n(x.netWeight) + n(x.runnerWeight) / cav
    const price = n(find(R.materials, x.material)?.price ?? x.price)
    const mbPrice = n(find(R.masterbatches, x.masterbatch)?.price)
    const cost = (price / 1000) * unitWeight * n(x.rate || 1) * (1 + n(x.reject))
      + (mbPrice / 1000) * unitWeight * n(x.mbRate) * (1 + n(x.reject))
    const total = cost * (1 + n(x.assemblyReject))
    return { ...x, unitWeight, price, cost: total }
  })

  // 2. Injection : capacité/h = 3600 / cycle × empreintes ; coût = (machine + MOD × opérateurs) / capacité × (1+rebut) × (1+rebut assemblage)
  const injection = (d.injection || []).map((x) => {
    const m = find(R.machines, x.machine)
    const capacity = (3600 / n(x.cycle)) * n(x.cavity)
    const labor = n(m?.labor ?? x.labor), machine = n(m?.machineCost ?? x.machineCost)
    const cost = ((machine + labor * n(x.workers)) / capacity) * (1 + n(x.reject)) * (1 + n(x.assemblyReject))
    return { ...x, capacity, labor, machineCost: machine, cost }
  })

  // 3. Décoration SS/HS : capacité/h = 3600 / cycle ; coût = (machine + MOD × op.) / capacité + prix encre × poids / 1000
  const decoration = (d.decoration || []).map((x) => {
    const m = find(R.machines, x.machine)
    const ink = n(find(R.inks, x.ink)?.price ?? x.inkPrice)
    const capacity = 3600 / n(x.cycle)
    const labor = n(m?.labor ?? x.labor), machine = n(m?.machineCost ?? x.machineCost)
    const cost = (((machine + labor * n(x.workers)) / capacity) + (ink * n(x.inkWeight)) / 1000) * (1 + n(x.reject))
    return { ...x, capacity, ink, cost }
  })

  // 4. Composants achetés
  const components = (d.components || []).map((x) => {
    const unit = n(find(R.components, x.name)?.price ?? x.unitCost)
    return { ...x, unit, cost: unit * n(x.qty) * (1 + n(x.reject)) }
  })

  // 5. Assemblage : capacité/h = 3600 / cycle ; coût = (machine + MOD × op.) / capacité × (1+rebut)
  const assembly = (d.assembly || []).map((x) => {
    const step = find(R.assembly, x.operation)
    const capacity = 3600 / n(x.cycle)
    const labor = n(step?.labor ?? x.labor), machine = n(step?.machineCost ?? x.machineCost)
    return { ...x, capacity, labor, machineCost: machine, cost: ((machine + labor * n(x.workers)) / capacity) * (1 + n(x.reject)) }
  })

  // 6. Emballage : pièces par carton = couches × pièces par couche ; coût = Σ(prix × qté) / pièces par carton
  const pk = d.packing || {}
  const perCarton = n(pk.layers) * n(pk.perLayer)
  const packItems = (pk.items || []).map((x) => {
    const unit = n(find(R.packaging, x.name)?.price ?? x.unitCost)
    return { ...x, unit, total: unit * n(x.qty) }
  })
  const packing = perCarton ? packItems.reduce((a, x) => a + x.total, 0) / perCarton : 0

  const sum = (arr) => arr.reduce((a, x) => a + x.cost, 0)
  const sections = {
    resin: sum(resin), injection: sum(injection), decoration: sum(decoration),
    components: sum(components), assembly: sum(assembly), packing, transport: n(d.transport),
  }
  const total = Object.values(sections).reduce((a, b) => a + b, 0)
  const margin = n(d.margin)
  return { resin, injection, decoration, components, assembly, packItems, perCarton, sections, total, salePrice: total * (1 + margin) }
}

export const SECTION_LABEL = {
  resin: 'Matière', injection: 'Injection', decoration: 'Décoration SS/HS', components: 'Composants',
  assembly: 'Assemblage', packing: 'Emballage', transport: 'Transport',
}
