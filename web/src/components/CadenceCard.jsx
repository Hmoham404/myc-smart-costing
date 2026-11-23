import { useMemo } from 'react'
import { Timer } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { NumInput } from './ui'
import { useViz, axisProps, VizTooltip } from './viz'
import { num } from '../lib/format'

/** Cadence horaire : pcs/h théorique, chaîne, retenue, machine + production cumulée heure par heure */
export default function CadenceCard({ r, P, product, onCadence }) {
  const c = useViz()
  const cad = r.capacity.cadence
  const hours = P.shift_hours
  const total = r.totals.totalQty
  const prodHours = r.totals.productionHours

  // Production cumulée par heure (pause entre postes non comptée), jusqu'à atteindre la quantité
  const data = useMemo(() => {
    const out = [{ h: 0, cumul: 0 }]
    const step = Math.max(1, Math.ceil(prodHours / 40))
    for (let h = step; h <= prodHours + step; h += step) {
      out.push({ h, cumul: Math.min(total, Math.round(cad.effective * h)) })
      if (cad.effective * h >= total) break
    }
    return out
  }, [cad.effective, total, prodHours])

  const shifts = total / (cad.effective * hours)
  const rows = [
    ['Théorique (sans arrêt)', cad.theoretical, 'vitesse ÷ pas × sauts'],
    ['Chaîne (après efficacité)', cad.line, `× efficacité ${P.lines[product.process].efficiency}`],
    ['Machine de métallisation', cad.machine, `${num(r.capacity.machine.capacity)} pcs / ${P.vacuum_machine.hours} h`],
    ['Retenue pour le chiffrage', cad.effective, cad.source === 'measured' ? 'cadence mesurée saisie' : `${num(r.capacity.capacity)} pcs / ${hours} h`],
  ]
  const bottleneck = product.process === 'vacuum' && cad.machine < cad.effective

  return (
    <div className="card">
      <div className="card-title"><Timer size={17} /> Cadence horaire</div>
      <div className="kpis">
        <div className="kpi hero"><div className="k-label">Cadence retenue</div><div className="k-value">{num(cad.effective, 0)} pcs/h</div>
          <div className="k-delta" style={{ color: '#d6e6fa' }}>{cad.source === 'measured' ? 'mesurée' : 'calculée'} · {num(cad.effective / 60, 1)} pcs/min</div></div>
        <div className="kpi"><div className="k-label">Par poste ({hours} h)</div><div className="k-value">{num(r.capacity.capacity)} pcs</div></div>
        <div className="kpi"><div className="k-label">Durée commande</div><div className="k-value">{prodHours} h</div><div className="k-delta flat">{num(shifts, 1)} poste(s) · {num(total)} pcs</div></div>
      </div>
      <table className="t" style={{ marginTop: 12 }}>
        <tbody>
          {rows.map(([label, v, hint]) => (
            <tr key={label}><td>{label}<div className="card-sub">{hint}</div></td><td className="num"><b>{num(v, 0)}</b> pcs/h</td></tr>
          ))}
        </tbody>
      </table>
      {bottleneck && <div className="alert warning" style={{ marginTop: 10 }}><div><b>Goulot : machine de métallisation</b>{num(cad.machine, 0)} pcs/h &lt; cadence retenue {num(cad.effective, 0)} pcs/h.</div></div>}
      {onCadence && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>Cadence réelle mesurée (pcs/h) — vide = calcul théorique</label>
          <NumInput value={product.cadence_per_hour || ''} placeholder={num(cad.line, 0)} onChange={(v) => onCadence(v > 0 ? v : null)} />
        </div>
      )}
      <div style={{ height: 190, marginTop: 12 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="h" type="number" domain={[0, 'dataMax']} {...axisProps(c)} tickFormatter={(v) => `${v} h`} />
            <YAxis {...axisProps(c)} width={52} tickFormatter={(v) => (v >= 1000 ? `${num(v / 1000, 0)}k` : v)} />
            <Tooltip content={<VizTooltip labelFmt={(h) => `Après ${h} h`} fmt={(v) => `${num(v)} pcs`} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
            <ReferenceLine y={total} stroke={c.s2} strokeDasharray="6 4" label={{ value: `objectif ${num(total)} pcs`, position: 'insideTopLeft', fill: c.axis, fontSize: 11 }} />
            <Area isAnimationActive={false} type="linear" dataKey="cumul" name="Production cumulée" stroke={c.s1} fill={c.s1} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card-sub">Production cumulée heure par heure à la cadence retenue (rebut inclus).</div>
    </div>
  )
}
