// =====================================================================
//  Besoin matière injection — reproduit « Injection molding material requirements worksheet »
//  (YZA067A). Rebuts en cascade injection → SS/HS → peinture → assemblage,
//  puis kg = (⌈qté / empreintes⌉ + cycles de démarrage) × (poids × empreintes + carotte) / 1000 × %.
// =====================================================================
const n = (v) => Number(v) || 0

export function computeMaterials(d) {
  const items = (d.items || []).map((it) => {
    const E = n(it.planned)
    const H = E * n(it.scrapInjection)
    const J = (E + H) * n(it.scrapDecoration)
    const L = (E + H + J) * n(it.scrapPainting)
    const M = (E + H + J + L) * n(it.scrapAssembly)
    const toProduce = E + H + J + L + M
    const shots = Math.ceil(toProduce / Math.max(1, n(it.cavities)) - 1e-9) + n(it.startupCycles)
    const shotWeight = n(it.unitWeight) * n(it.cavities) + n(it.runnerWeight) // g par injection
    const totalKg = (shots * shotWeight) / 1000
    const resinKg = totalKg * n(it.resinShare)
    const mbKg = totalKg * (1 - n(it.resinShare))
    // Le taux de recyclage est saisi dans Excel mais n'entre pas dans la formule : on l'affiche à part
    const recyclable = n(it.runnerWeight) * shots / 1000 * n(it.recyclingRate)
    return { ...it, scrap: { injection: H, decoration: J, painting: L, assembly: M }, toProduce, shots, shotWeight, totalKg, resinKg, mbKg, recyclable }
  })
  const byMaterial = {}
  for (const it of items) {
    const add = (name, kg) => { if (!name) return; byMaterial[name] = (byMaterial[name] || 0) + kg }
    add(it.resin, it.resinKg); add(it.masterbatch, it.mbKg)
  }
  const orders = Object.entries(byMaterial).map(([name, kg]) => {
    const price = n((d.prices || {})[name])
    return { name, kg, price, amount: kg * price }
  })
  return {
    items, orders,
    totalKg: items.reduce((a, x) => a + x.totalKg, 0),
    totalAmount: orders.reduce((a, x) => a + x.amount, 0),
  }
}
