// Tests du moteur unique de projet contre les 3 classeurs d'exemple
// (fixtures privées générées par supabase/build_seed_projets.py — non versionnées).
import fs from 'fs'
import { computeProject, workDays } from './project/engine.js'

const path = new URL('./fixtures.private.json', import.meta.url)
if (!fs.existsSync(path)) {
  console.log('Fixtures privées absentes : tests projets ignorés (lancer supabase/build_seed_projets.py).')
  process.exit(0)
}
const F = JSON.parse(fs.readFileSync(path, 'utf8'))
const lib = F.library
let failed = 0
const near = (label, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${got} (attendu ${want})`)
}

// 1) SEPHORA YZA089A → onglet Chiffrage
const r1 = computeProject(F.p1.data, lib)
near('YZA089A coût / pièce (R43)', r1.costing.total, F.p1.expected.total)
near('YZA089A matière (R9)', r1.costing.sections.resin, F.p1.expected.resin)
near('YZA089A injection (R13)', r1.costing.sections.injection, F.p1.expected.injection)
near('YZA089A emballage (Q35)', r1.costing.sections.packing, F.p1.expected.packing)

// 2) YZA067A → onglet CBN
const r2 = computeProject(F.p2.data, lib)
const kg = Object.fromEntries(r2.cbn.orders.map((o) => [o.name, o.kg]))
const c0 = F.p2.data.components[0]
near('YZA067A COVER à produire (O8)', r2.cbn.items[0].toProduce, F.p2.expected.cover_to_produce)
near('YZA067A résine (E33)', kg[c0.material], F.p2.expected.resin)
near('YZA067A mélange maître (E34)', kg[c0.masterbatch], F.p2.expected.mb)

// 3) KIKO YZA037 → onglets Capacité, Planning, Gantt
const r3 = computeProject(F.p3.data, lib, 'excel')
const compRef = Object.fromEntries(F.p3.data.components.map((c) => [c.id, c.reference]))
for (const op of r3.capacity.ops) {
  const proc = op.label.split(' — ')[0]
  const codes = op.componentIds.map((id) => compRef[id])
  const key = Object.keys(F.p3.expected).find((k) => k.endsWith(`|${proc}`) && codes.every((c) => k.includes(c)) && (codes.length || !k.startsWith('YZA037FA & YZA037BA|')))
  if (!key) continue
  near(`KIKO ${op.label} cadence/h`, op.hourly, F.p3.expected[key].hourly)
  near(`KIKO ${op.label} capacité/semaine`, op.weekly, F.p3.expected[key].weekly)
}
near('KIKO besoin total', r3.planning.totalNeed, 650000)
for (const t of F.p3.data.tasks) near(`Gantt ${t.name.trim()} jours ouvrés`, workDays(t.start, t.end, F.p3.data.holidays, false), t.excelWorkDays)

console.log(failed ? `\n${failed} test(s) projets en échec` : '\nTests projets : tous OK ✔')
process.exit(failed ? 1 : 0)
