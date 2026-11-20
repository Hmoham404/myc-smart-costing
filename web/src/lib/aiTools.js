// =====================================================================
//  Outils de l'assistant IA — exécutés dans le navigateur.
//  Claude choisit l'outil ; le calcul est fait par le moteur validé.
// =====================================================================
import { computeCosting, detectAnomalies, coefForQuantity } from './engine.js'
import { LEVERS, METRICS, leverByKey, metricByKey, applyLevers, currentLeverValues, solveGoal, tornado, sweep } from './levers.js'
import { PROCESS_LABEL } from './defaults.js'

const r4 = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)
const metricsOf = (r) => Object.fromEntries(METRICS.map((m) => [m.key, r4(m.get(r))]))
const MODES = ['excel', 'corrected']

function check(cond, msg) { if (!cond) throw new Error(msg) }

/**
 * ctx = { product, P, products: [{reference, product}], goals, setProduct(p), saveGoal(row) }
 * Retourne { content (JSON pour Claude), chart? (pour affichage) }
 */
export async function runTool(name, input, ctx) {
  const { P } = ctx
  const product = ctx.getProduct()
  switch (name) {
    case 'get_context': {
      const r = computeCosting(product, P, 'excel')
      return {
        content: {
          product: { client: product.client, reference: product.reference, material: product.material, shape: product.shape,
            dimensions_mm: product.shape === 'circular' ? { d1: product.d1, d2: product.d2, height: product.height } : { length: product.length, width: product.width, height: product.height },
            process: PROCESS_LABEL[product.process], color: product.color, client_type: product.client_type, quantity: product.quantity, scrap_pct: product.scrap * 100 },
          levers: LEVERS.map((l) => ({ key: l.key, label: l.label, unit: l.unit, current: r4(currentLeverValues(product, P, 'excel')[l.key]), min: l.min, max: l.max })),
          metrics_excel: metricsOf(r),
          metrics_corrected: metricsOf(computeCosting(product, P, 'corrected')),
          anomalies: detectAnomalies(product, P, r).map((a) => `${a.title} : ${a.text}`),
          parameters: { coefficient: P.coefficient, pricing_mode: P.pricing_mode, daily_efficiency: P.daily_efficiency, shift_hours: P.shift_hours, currency: P.currency },
          available_products: ctx.products.map((p) => p.reference),
          saved_goals: ctx.goals.map((g) => ({ title: g.title, metric: g.metric, comparator: g.comparator, target: g.target, status: g.status })),
        },
      }
    }
    case 'select_product': {
      const found = ctx.products.find((p) => p.reference.toLowerCase() === String(input.reference).toLowerCase())
      check(found, `Référence inconnue. Disponibles : ${ctx.products.map((p) => p.reference).join(', ')}`)
      ctx.setProduct(found.product)
      return { content: { selected: found.reference, metrics_excel: metricsOf(computeCosting(found.product, P, 'excel')) } }
    }
    case 'simulate': {
      check(MODES.includes(input.mode), 'mode invalide')
      check(Array.isArray(input.changes), 'changes doit être une liste')
      const values = {}
      for (const c of input.changes) {
        const l = leverByKey[c.lever]
        check(l, `levier inconnu : ${c.lever}`)
        check(typeof c.value === 'number' && Number.isFinite(c.value), `valeur invalide pour ${c.lever}`)
        values[c.lever] = Math.min(l.max, Math.max(l.min, l.int ? Math.round(c.value) : c.value))
      }
      const before = computeCosting(product, P, input.mode)
      const { r } = applyLevers(product, P, values, input.mode)
      return { content: { mode: input.mode, applied: values, before: metricsOf(before), after: metricsOf(r), note: 'Valeurs bornées aux plages autorisées des leviers.' } }
    }
    case 'solve_goal': {
      check(metricByKey[input.metric] && ['<=', '>='].includes(input.comparator) && MODES.includes(input.mode), 'paramètres invalides')
      const s = solveGoal(product, P, { metric: input.metric, comparator: input.comparator, target: input.target }, input.mode)
      return {
        content: {
          metric: s.metric.label, current: r4(s.current), target: input.target, already_met: s.already,
          single_lever_solutions: s.single.map((x) => ({ lever: x.key, label: x.label, unit: x.unit, from: r4(x.from), to: r4(x.to), change_pct: r4(x.rel * 100), resulting_value: r4(x.result) })),
          combined_plan: s.combo ? { step_pct: s.combo.pct, changes: s.combo.changes.map((x) => ({ lever: x.key, from: r4(x.from), to: r4(x.to) })), resulting_value: r4(s.combo.result) } : null,
          excluded: input.mode === 'excel' ? ['daily_eff (anomalie W7 : effet inversé)'] : [],
        },
      }
    }
    case 'sensitivity': {
      check(metricByKey[input.metric] && MODES.includes(input.mode), 'paramètres invalides')
      const t = tornado(product, P, input.metric, input.mode, 10)
      return { content: { metric: metricByKey[input.metric].label, variation: '±10 %', ranking: t.map((d) => ({ lever: d.key, label: d.label, effect_minus10: r4(d.low), effect_plus10: r4(d.high) })) } }
    }
    case 'sweep': {
      const l = leverByKey[input.lever]; const m = metricByKey[input.metric]
      check(l && m && MODES.includes(input.mode), 'paramètres invalides')
      const pts = sweep(product, P, input.lever, input.mode, 40)
      const cur = currentLeverValues(product, P, input.mode)[input.lever]
      const sample = pts.filter((_, i) => i % 4 === 0 || i === pts.length - 1).map((p) => ({ [input.lever]: r4(p.x), [input.metric]: r4(p[input.metric]) }))
      return {
        content: { lever: l.label, unit: l.unit, metric: m.label, current_lever_value: r4(cur), points: sample, shown_to_user: true },
        chart: { lever: input.lever, metric: input.metric, current: cur, data: pts.map((p) => ({ x: p.x, y: p[input.metric] })) },
      }
    }
    case 'price_for_quantity': {
      check(input.quantity > 0, 'quantité invalide')
      const base = computeCosting({ ...product, quantity: 50000 }, P, 'excel').totals.finalPrice
      const coef = coefForQuantity(input.quantity, P, input.client_type, input.color)
      const handling = input.quantity < P.handling_cost.below_qty ? P.handling_cost.amount : 0
      return { content: { base_price_50k: r4(base), coefficient: coef, unit_price: r4(base * coef), handling_cost: handling, total: r4(base * coef * input.quantity + handling), currency: P.currency } }
    }
    case 'calculation_detail': {
      check(MODES.includes(input.mode), 'mode invalide')
      const r = computeCosting(product, P, input.mode)
      return {
        content: {
          mode: input.mode,
          surface_mm2: r4(r.geometry.surface), surface_coef: r4(r.geometry.surfaceCoef), diagonal_mm: r4(r.geometry.diagonal), jumps: r.geometry.jumps,
          line_capacity_per_hour: r4(r.capacity.perHour), capacity_per_shift: r.capacity.capacity, machine_capacity_per_shift: r.capacity.machine.capacity,
          paint_price_per_kg: r4(r.paint.pricePerKg), paint_g_per_piece: r4(r.paint.consPerPiece), paint_cost_per_piece: r4(r.paint.costPerPiece), paint_cost_per_shift: r4(r.paint.paintShift),
          workers: r.labor.workers, labor_cost_per_shift: r4(r.labor.laborShift),
          process_cost_per_shift: r4(r.process.total), process_items: Object.fromEntries(Object.entries(r.process.items).map(([k, v]) => [k, r4(v)])),
          total_cost_per_shift: r4(r.totals.totalShift), daily_efficiency: P.daily_efficiency,
          unit_cost: r4(r.totals.unitCost), commercial_factor: r4(r.totals.commercialFactor), final_price: r4(r.totals.finalPrice),
          unit_cost_breakdown: Object.fromEntries(Object.entries(r.breakdown).map(([k, v]) => [k, r4(v)])),
          quantity_to_produce: r4(r.totals.totalQty), production_hours: r.totals.productionHours,
          formula_unit_cost: input.mode === 'excel' ? 'total/poste ÷ capacité × efficacité journalière (W7, anomalie)' : 'total/poste ÷ (capacité × efficacité journalière) × (1 + rebut)',
        },
      }
    }
    case 'save_goal': {
      check(metricByKey[input.metric] && ['<=', '>='].includes(input.comparator) && MODES.includes(input.mode), 'paramètres invalides')
      const baseline = metricByKey[input.metric].get(computeCosting(product, P, input.mode))
      await ctx.saveGoal({ title: input.title, metric: input.metric, comparator: input.comparator, target: input.target, mode: input.mode,
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(input.deadline || '') ? input.deadline : null, baseline, product })
      return { content: { saved: true, title: input.title, baseline: r4(baseline) } }
    }
    default:
      throw new Error(`Outil inconnu : ${name}`)
  }
}

export const TOOL_LABEL = {
  get_context: 'Lecture du contexte', select_product: 'Changement de pièce', simulate: 'Simulation',
  solve_goal: "Recherche de solutions pour l'objectif", sensitivity: 'Analyse de sensibilité', sweep: 'Tracé de courbe',
  price_for_quantity: 'Prix par quantité', calculation_detail: 'Détail du calcul', save_goal: "Enregistrement de l'objectif",
}
