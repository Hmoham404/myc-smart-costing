// Tests de non-régression des modules projets (injection, besoin matière, capacité).
// Les données de référence sont privées (fixtures.private.json, généré par supabase/build_seed_projets.py).
import fs from 'fs'
import { computeInjection } from './injection.js'
import { computeMaterials } from './materials.js'
import { computeCapacity } from './capacity.js'

const path = new URL('./fixtures.private.json', import.meta.url)
if (!fs.existsSync(path)) {
  console.log('Fixtures privées absentes : tests projets ignorés (lancer supabase/build_seed_projets.py).')
  process.exit(0)
}
const F = JSON.parse(fs.readFileSync(path, 'utf8'))
let failed = 0
const near = (label, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${got} (attendu ${want})`)
}

// 1) Chiffrage injection YZA089A
const inj = computeInjection(F.injection.data)
near('YZA089A coût total / pièce (R43)', inj.total, F.injection.expected)
near('YZA089A matière (R9)', inj.sections.resin, 0.0525609)
near('YZA089A injection (R13)', inj.sections.injection, 0.07394473000000001)
near('YZA089A emballage (Q35)', inj.sections.packing, 0.0021466666666666665)

// 2) Besoin matière YZA067A
const mat = computeMaterials(F.materials.data)
const kg = Object.fromEntries(mat.orders.map((o) => [o.name, o.kg]))
const resinName = F.materials.data.items[0].resin, mbName = F.materials.data.items[0].masterbatch
near('YZA067A résine à commander (E33)', kg[resinName], F.materials.expected.resin)
near('YZA067A mélange maître (E34)', kg[mbName], F.materials.expected.mb)
near('YZA067A COVER qté à produire (O8)', mat.items[0].toProduce, 260615.3895)

// 3) Capacité KIKO
const cap = computeCapacity(F.capacity.data, 'excel')
for (const op of cap.ops) {
  const exp = F.capacity.expected[`${op.code}|${op.process}`]
  if (!exp) continue
  near(`KIKO ${op.process} ${op.code} cadence/h`, op.hourly, exp.hourly)
  near(`KIKO ${op.process} ${op.code} capacité/semaine`, op.weekly, exp.weekly)
}

console.log(failed ? `\n${failed} test(s) projets en échec` : '\nTests projets : tous OK ✔')
process.exit(failed ? 1 : 0)
