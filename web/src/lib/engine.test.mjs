// Tests de non-régression : le moteur doit retrouver les valeurs des classeurs Excel.
import { computeCosting, commercialTiers } from './engine.js'
import { DEFAULT_PARAMS, DEFAULT_PRODUCT } from './defaults.js'

let failed = 0
const near = (label, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${got} (attendu ${want})`)
}

// 1) PUPA — FICHE QUANTIFICATION ... PUPA 05-11-26 / FEUILLE CHIFFREAGE MYC TN
const pupa = computeCosting({ ...DEFAULT_PRODUCT, jumps: 4 }, DEFAULT_PARAMS, 'excel')
near('PUPA surface coef (B24)', pupa.geometry.surfaceCoef, 10.658315684419193)
near('PUPA capacité/poste (K16)', pupa.capacity.capacity, 12000)
near('PUPA prix peinture $/kg (K17)', pupa.paint.pricePerKg, 8.320035743920343)
near('PUPA conso g/pièce (K18)', pupa.paint.consPerPiece, 33.3967663655591)
near('PUPA coût process/poste (R7)', pupa.process.total, 944.8117647058823)
near('PUPA MOD/poste (Q8)', pupa.labor.laborShift, 200)
near('PUPA total/poste (T7)', pupa.totals.totalShift, 4479.159243419584)
near('PUPA prix de revient (W7)', pupa.totals.unitCost, 0.29861061622797225)
near('PUPA prix final (AD7)', pupa.totals.finalPrice, 0.4927075167761542)
near('PUPA heures (V9)', pupa.totals.productionHours, 38)
near('PUPA capacité machine (I26)', pupa.capacity.machine.capacity, 12000)

// 2) BELOTTI — RICHIESTA QUOTAZIONE D&G / FEUILLE CHIFFREAGE MYC TN
const P2 = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
P2.capacity_method = 'simple'
P2.lines.vacuum = { jumps: 4, spacing_mm: 44.5, speed_m_min: 9, efficiency: 0.8 }
P2.workers.vacuum = 24
P2.paint = { base: [{ name: 'T', price: 4.9, cons: 2 }, { name: 'P', price: 6.3, cons: 3 }, { name: 'Top', price: 6.8, cons: 4 }],
  pigments: [], shipment_coef: 1.5, include_pigments: false, use_surface_coef: false }
P2.pricing_mode = 'margin'; P2.margin = 0.8
const bel = computeCosting({ ...DEFAULT_PRODUCT, client: 'BELOTTI', length: 90.5, width: 70.5, quantity: 40000, scrap: 0.15, jumps: 4 }, P2, 'excel')
near('BELOTTI capacité/poste (J16)', bel.capacity.capacity, 19000)
near('BELOTTI total/poste (S7)', bel.totals.totalShift, 3169.0117647058823)
near('BELOTTI prix revient (V7)', bel.totals.unitCost, 0.1334320743034056)
near('BELOTTI prix client (X7)', bel.totals.finalPrice, 0.24017773374613005)
near('BELOTTI heures (U9)', bel.totals.productionHours, 20)

// 3) Grille D&G 25TN008-TN Standard : X = 0,492 → 5K = 0,8856
const t = commercialTiers(0.492, DEFAULT_PARAMS, 'known', 'standard')
near('D&G 5K', t[0].unit, 0.8856)
near('D&G 10K', t[1].unit, 0.5904)
near('D&G 100K', t[4].unit, 0.4674)

console.log(failed ? `\n${failed} test(s) en échec` : '\nTous les tests passent ✔')
process.exit(failed ? 1 : 0)
