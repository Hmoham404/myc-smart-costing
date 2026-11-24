import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { RotateCcw } from 'lucide-react'
import { computeProject, SECTION_LABEL } from '../../lib/project/engine'
import { useViz, axisProps, VizTooltip, Legend } from '../../components/viz'
import { money, num, pct } from '../../lib/format'

const LEVERS = [
  { key: 'qty', label: 'Quantité', unit: '%', min: 25, max: 300, step: 5 },
  { key: 'matPrice', label: 'Prix matière', unit: '%', min: 50, max: 150, step: 1 },
  { key: 'cycle', label: 'Temps de cycle', unit: '%', min: 50, max: 150, step: 1 },
  { key: 'labor', label: 'Taux horaire MOD', unit: '%', min: 50, max: 200, step: 1 },
  { key: 'machine', label: 'Coût machine / h', unit: '%', min: 50, max: 200, step: 1 },
  { key: 'eff', label: 'Efficacité', unit: '%', min: 50, max: 100, step: 1 },
  { key: 'reject', label: 'Rebuts', unit: '%', min: 0, max: 300, step: 5 },
]
const BASE = { qty: 100, matPrice: 100, cycle: 100, labor: 100, machine: 100, eff: 0, reject: 100 }
const clone = (o) => JSON.parse(JSON.stringify(o))

/** Applique les leviers à une copie du projet et de la bibliothèque */
function apply(data, lib, v) {
  const d = clone(data), L = clone(lib)
  const k = (x) => x / 100
  d.quantity = Math.round((d.quantity || 0) * k(v.qty))
  d.weeks = (d.weeks || []).map((w) => ({ ...w, need: Math.round((w.need || 0) * k(v.qty)) }))
  ;(L.materials || []).forEach((m) => { m.price = (m.price || 0) * k(v.matPrice) })
  ;(L.masterbatches || []).forEach((m) => { m.price = (m.price || 0) * k(v.matPrice) })
  d.components = d.components || []; d.operations = d.operations || []
  d.components.forEach((c) => { c.cycle = (c.cycle || 0) * k(v.cycle); c.rejectInjection = (c.rejectInjection || 0) * k(v.reject) })
  d.operations.forEach((o) => {
    if (o.cycle) o.cycle *= k(v.cycle)
    if (o.speed) o.speed /= k(v.cycle)
    o.reject = (o.reject || 0) * k(v.reject)
    if (v.eff) o.efficiency = v.eff / 100
  })
  for (const list of [L.machines, L.assembly]) (list || []).forEach((m) => { m.labor = (m.labor || 0) * k(v.labor); m.machineCost = (m.machineCost || 0) * k(v.machine) })
  return { d, L }
}
const weeksToFinish = (r) => Math.max(-1, ...r.planning.plan.map((p) => p.endIdx)) + 1

/** Onglet Analyse : scénarios « et si », sensibilité, comparaison */
export default function Analysis({ data, lib, res, mode }) {
  const c = useViz()
  const [v, setV] = useState(BASE)
  const scen = useMemo(() => { const { d, L } = apply(data, lib, v); return computeProject(d, L, mode) }, [data, lib, v, mode])
  const changed = JSON.stringify(v) !== JSON.stringify(BASE)

  const kpis = [
    ['Coût / pièce', res.costing.total, scen.costing.total, (x) => money(x), 'down'],
    ['Coût de la commande', res.costing.orderCost, scen.costing.orderCost, (x) => money(x, 'USD', 0), 'down'],
    ['Matière à commander', res.cbn.totalKg, scen.cbn.totalKg, (x) => `${num(x, 0)} kg`, 'down'],
    ['Couverture du goulot', res.capacity.bottleneck?.coverage || 0, scen.capacity.bottleneck?.coverage || 0, (x) => pct(x, 0), 'up'],
    ['Semaines de production', weeksToFinish(res), weeksToFinish(scen), (x) => num(x), 'down'],
  ]

  // Sensibilité du coût / pièce à ±10 % de chaque facteur
  const tornado = useMemo(() => LEVERS.filter((l) => !['qty', 'eff'].includes(l.key)).map((l) => {
    const lo = computeProject(apply(data, lib, { ...BASE, [l.key]: 90 }).d, apply(data, lib, { ...BASE, [l.key]: 90 }).L, mode).costing.total
    const hi = computeProject(apply(data, lib, { ...BASE, [l.key]: 110 }).d, apply(data, lib, { ...BASE, [l.key]: 110 }).L, mode).costing.total
    return { label: l.label, low: lo - res.costing.total, high: hi - res.costing.total, span: Math.abs(hi - lo) }
  }).sort((a, b) => b.span - a.span), [data, lib, mode, res])

  const sections = Object.keys(SECTION_LABEL).map((k) => ({ name: SECTION_LABEL[k], ref: +res.costing.sections[k].toFixed(5), sc: +scen.costing.sections[k].toFixed(5) })).filter((x) => x.ref || x.sc)

  return (
    <div className="dash">
      <div className="card span-4" style={{ alignSelf: 'start' }}>
        <div className="card-title">Scénario « et si »<span className="spacer" /><button className="btn btn-light" onClick={() => setV(BASE)}><RotateCcw size={14} /> Référence</button></div>
        {LEVERS.map((l) => {
          const val = l.key === 'eff' ? (v.eff || 0) : v[l.key]
          return (
            <div key={l.key} className="lever">
              <div className="lever-top"><span>{l.label}</span>
                <b className={val !== BASE[l.key] ? 'changed' : ''}>{l.key === 'eff' ? (v.eff ? `${v.eff} %` : 'par opération') : `${val} %`}</b></div>
              <input type="range" min={l.key === 'eff' ? 0 : l.min} max={l.max} step={l.step} value={val} onChange={(e) => setV({ ...v, [l.key]: Number(e.target.value) })} />
            </div>
          )
        })}
        <div className="card-sub">100 % = valeurs du projet. Efficacité : force une efficacité unique pour toutes les opérations.</div>
      </div>

      <div className="span-8" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Résultat du scénario {changed && <span className="pill envoye">modifié</span>}</div>
          <div className="kpis">
            {kpis.map(([label, a, b, f, better], i) => {
              const d = b - a
              const good = better === 'down' ? d < 0 : d > 0
              return (
                <div key={label} className={`kpi ${i === 0 ? 'hero' : ''}`}>
                  <div className="k-label">{label}</div><div className="k-value">{f(b)}</div>
                  <div className={`k-delta ${Math.abs(d) < 1e-9 ? 'flat' : good ? 'up-good' : 'up-bad'}`} style={i === 0 ? { color: '#e3f5ee' } : null}>{Math.abs(d) < 1e-9 ? '= référence' : `réf. ${f(a)}`}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Coût / pièce par poste : référence vs scénario</div>
          <Legend items={[['Référence', c.s1], ['Scénario', c.s2]]} />
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={sections} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke={c.grid} vertical={false} /><XAxis dataKey="name" {...axisProps(c)} interval={0} />
                <YAxis {...axisProps(c)} width={56} tickFormatter={(x) => x.toFixed(3)} />
                <Tooltip content={<VizTooltip fmt={(x) => money(x)} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey="ref" name="Référence" fill={c.s1} radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="sc" name="Scénario" fill={c.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Sensibilité du coût / pièce (±10 % sur chaque facteur)</div>
          <Legend items={[['Facteur −10 %', c.s1], ['Facteur +10 %', c.s2]]} />
          <div style={{ height: Math.max(180, tornado.length * 36) }}>
            <ResponsiveContainer>
              <BarChart data={tornado} layout="vertical" margin={{ left: 10, right: 24 }} barGap={2}>
                <CartesianGrid stroke={c.grid} horizontal={false} />
                <XAxis type="number" {...axisProps(c)} tickFormatter={(x) => (x > 0 ? '+' : '') + x.toFixed(4)} />
                <YAxis type="category" dataKey="label" width={150} {...axisProps(c)} axisLine={false} />
                <ReferenceLine x={0} stroke={c.ref} />
                <Tooltip content={<VizTooltip fmt={(x) => `${x >= 0 ? '+' : '−'}${money(Math.abs(x))}`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey="low" name="Facteur −10 %" fill={c.s1} radius={4} barSize={10} />
                <Bar isAnimationActive={false} dataKey="high" name="Facteur +10 %" fill={c.s2} radius={4} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
