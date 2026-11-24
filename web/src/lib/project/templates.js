// Création automatique d'un projet : composants + procédés choisis → opérations, semaines, besoin client
import { buildWeeks } from './engine.js'

export const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`

export const DEFAULT_SCHEDULE = { hoursPerShift: 7.5, shiftsPerDay: 3, daysPerWeek: 6, efficiency: 0.85 }

export const newComponent = (i = 1) => ({
  id: uid('c'), name: `Pièce ${i}`, reference: '', material: '', color: '', masterbatch: '', mbShare: 0,
  netWeight: 0, runnerWeight: 0, cavities: 4, cycle: 30, qtyPerProduct: 1, rejectInjection: 0.03, asmReject: 0,
  startupCycles: 100, recyclingRate: 0, processes: { decoration: false, painting: false, metallization: false },
})

/** Procédés globaux (tous composants) proposés à la création */
export const GLOBAL_PROCESSES = [
  { key: 'welding', label: 'Soudure ultrason', category: 'assembly', cycle: 15, reject: 0.03 },
  { key: 'assembly', label: 'Assemblage', category: 'assembly', cycle: 6, reject: 0.03 },
  { key: 'inspection', label: 'Contrôle', category: 'assembly', cycle: 6, reject: 0 },
  { key: 'packaging', label: 'Emballage', category: 'assembly', cycle: 6, reject: 0 },
]

/** Génère les opérations : 1 injection par composant + décoration/peinture/métallisation cochées + procédés globaux */
export function generateOperations(components, globals = {}, firstWeek = '', machine = '') {
  const ops = []
  for (const c of components) {
    ops.push({ id: uid('o'), category: 'injection', label: `Injection ${c.name}`, componentIds: [c.id], machine, machines: 1, workers: 1, asmReject: 0, startWeek: firstWeek, ramp: 1 })
  }
  const per = (key, category, label, extra) => {
    const list = components.filter((c) => c.processes?.[key])
    if (list.length) ops.push({ id: uid('o'), category, label: `${label} ${list.map((c) => c.name).join(' & ')}`, componentIds: list.map((c) => c.id), machines: 1, workers: 1, reject: 0.03, startWeek: firstWeek, ramp: 1, ...extra })
  }
  per('decoration', 'decoration', 'Sérigraphie', { cycle: 6, ink: '', inkWeight: 0.025 })
  per('painting', 'painting', 'Peinture', { cycle: 2, reject: 0.06 })
  per('metallization', 'metallization', 'Métallisation', { speed: 9, jumps: 1, pitchMm: 44.45, hoursPerShift: 6.5, shiftsPerDay: 1, daysPerWeek: 3, efficiency: 0.8, workers: 23, reject: 0.06 })
  for (const g of GLOBAL_PROCESSES) {
    if (globals[g.key]) ops.push({ id: uid('o'), category: g.category, label: g.label, step: '', componentIds: [], machines: 1, workers: 1, cycle: g.cycle, reject: g.reject, startWeek: firstWeek, ramp: 1 })
  }
  return ops
}

/** Répartit la quantité totale sur les semaines (après une période de préparation) */
export function spreadNeed(weeks, total, startIdx = 0, prodWeeks = weeks.length) {
  const end = Math.min(weeks.length, startIdx + Math.max(1, prodWeeks))
  const per = Math.round(total / Math.max(1, end - startIdx))
  return weeks.map((w, i) => ({ ...w, need: i >= startIdx && i < end ? (i === end - 1 ? total - per * (end - startIdx - 1) : per) : 0 }))
}

export function newProjectData({ quantity, startDate, weeksCount, components, globals, schedule, prepWeeks = 2 }) {
  let weeks = buildWeeks(startDate, weeksCount)
  weeks = spreadNeed(weeks, quantity, prepWeeks, weeksCount - prepWeeks)
  const first = weeks[Math.min(prepWeeks, weeks.length - 1)]?.label || ''
  return {
    quantity, startDate, schedule: { ...DEFAULT_SCHEDULE, ...schedule }, components,
    operations: generateOperations(components, globals, first), purchased: [], packing: { layers: 1, perLayer: 100, items: [] },
    transport: 0, margin: 0.3, weeks, holidays: [], tasks: [], models: {},
  }
}
