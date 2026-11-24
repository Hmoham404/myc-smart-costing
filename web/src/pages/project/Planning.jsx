import { useState } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Wand2 } from 'lucide-react'
import { NumInput } from '../../components/ui'
import { buildWeeks } from '../../lib/project/engine'
import { spreadNeed } from '../../lib/project/templates'
import { useViz, axisProps, VizTooltip, Legend } from '../../components/viz'
import { num } from '../../lib/format'

/** Onglet Planning (KIKO « Capacity Planning Summary ») */
export default function Planning({ data, setData, res }) {
  const c = useViz()
  const weeks = data.weeks || []
  const pl = res.planning
  const [fill, setFill] = useState({ from: 0, to: Math.max(0, weeks.length - 1) })
  const [ref, setRef] = useState(null)
  const setWeeks = (w) => setData((d) => ({ ...d, weeks: w }))
  const setOp = (id, patch) => setData((d) => ({ ...d, operations: d.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
  const rebuild = (count) => setWeeks(buildWeeks(data.startDate, Math.max(1, Math.min(60, count)), weeks))
  const tracked = pl.plan.find((p) => p.id === ref) || pl.plan[pl.plan.length - 1]
  const maxOut = Math.max(1, ...pl.plan.flatMap((p) => p.rows.map((x) => x.output)))
  let cn = 0, co = 0
  const chart = weeks.map((w, i) => { cn += pl.need[i]; co += tracked?.rows[i]?.output || 0; return { week: w.label, need: pl.need[i], cumNeed: cn, cumOut: co } })

  return (
    <>
      <div className="card">
        <div className="grid g4" style={{ alignItems: 'end' }}>
          <div className="field"><label>Date de début</label><input type="date" value={data.startDate || ''} onChange={(e) => setData((d) => ({ ...d, startDate: e.target.value, weeks: buildWeeks(e.target.value, weeks.length || 12, d.weeks) }))} /></div>
          <div className="field"><label>Nombre de semaines</label><NumInput value={weeks.length} onChange={(v) => rebuild(Math.round(v))} /></div>
          <div className="kpi"><div className="k-label">Besoin total planifié</div><div className="k-value">{num(pl.totalNeed)}</div><div className="k-delta flat">quantité projet : {num(data.quantity)}</div></div>
          <div className="kpi"><div className="k-label">MOD max / semaine</div><div className="k-value">{num(Math.max(0, ...pl.modPerWeek))}</div></div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Wand2 size={15} /> Répartir la quantité projet ({num(data.quantity)}) de
          <select className="input" style={{ width: 90 }} value={fill.from} onChange={(e) => setFill({ ...fill, from: +e.target.value })}>{weeks.map((w, i) => <option key={i} value={i}>{w.label}</option>)}</select>
          à
          <select className="input" style={{ width: 90 }} value={fill.to} onChange={(e) => setFill({ ...fill, to: +e.target.value })}>{weeks.map((w, i) => <option key={i} value={i}>{w.label}</option>)}</select>
          <button className="btn btn-soft" onClick={() => setWeeks(spreadNeed(weeks, data.quantity || 0, fill.from, fill.to - fill.from + 1))}>Répartir</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Planning de production hebdomadaire</div>
        <div className="table-wrap">
          <table className="t gantt">
            <thead><tr><th>Opération</th><th>Début</th><th>Fin</th><th className="num">1ʳᵉ sem. %</th>{weeks.map((w) => <th key={w.label} className="num">{w.label}</th>)}<th className="num">Total</th></tr></thead>
            <tbody>
              <tr className="need-row"><td><b>Besoin client</b></td><td /><td /><td />{weeks.map((w, i) => (
                <td key={i}><NumInput className="input wk-in" value={w.need} onChange={(v) => setWeeks(weeks.map((x, j) => (j === i ? { ...x, need: Math.round(v) } : x)))} /></td>
              ))}<td className="num"><b>{num(pl.totalNeed)}</b></td></tr>
              {pl.plan.map((p) => {
                const op = data.operations.find((o) => o.id === p.id)
                return (
                  <tr key={p.id}>
                    <td className="gantt-label" title={p.label}>{p.label}{p.shortage && <span className="pill refuse" style={{ marginInlineStart: 6 }}>rupture {p.shortage}</span>}</td>
                    <td><select className="input" style={{ width: 84 }} value={op?.startWeek || ''} onChange={(e) => setOp(p.id, { startWeek: e.target.value })}>{weeks.map((w) => <option key={w.label} value={w.label}>{w.label}</option>)}</select></td>
                    <td><select className="input" style={{ width: 84 }} value={op?.endWeek || ''} onChange={(e) => setOp(p.id, { endWeek: e.target.value })}><option value="">—</option>{weeks.map((w) => <option key={w.label} value={w.label}>{w.label}</option>)}</select></td>
                    <td><NumInput className="input wk-in" style={{ width: 62 }} value={+((op?.ramp ?? 1) * 100).toFixed(1)} onChange={(v) => setOp(p.id, { ramp: Math.max(0, Math.min(100, v)) / 100 })} /></td>
                    {p.rows.map((x, i) => (
                      <td key={i} className="gantt-cell" title={`Production ${num(x.output)} · stock ${num(x.stock)}`}>
                        {x.output > 0 && <div className={`gantt-bar k-${p.category}`} style={{ opacity: 0.35 + 0.65 * (x.output / maxOut) }}>{num(x.output / 1000, 0)}k</div>}
                      </td>
                    ))}
                    <td className="num">{num(p.made)}</td>
                  </tr>
                )
              })}
              <tr><td><b>MOD / semaine</b></td><td /><td /><td />{pl.modPerWeek.map((m, i) => <td key={i} className="num">{m || ''}</td>)}<td /></tr>
            </tbody>
          </table>
        </div>
        <div className="card-sub" style={{ marginTop: 6 }}>Chaque opération produit à sa capacité hebdomadaire (onglet Capacité) à partir de sa semaine de début (jusqu'à sa semaine de fin si renseignée, ex. renfort), jusqu'au besoin total + rebut. « Rupture » : production cumulée inférieure au besoin cumulé.</div>
      </div>

      <div className="card">
        <div className="card-title">Production cumulée vs besoin cumulé
          <span className="spacer" />
          <select className="input" style={{ width: 300 }} value={tracked?.id || ''} onChange={(e) => setRef(e.target.value)}>{pl.plan.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </div>
        <Legend items={[['Besoin hebdo', c.s3], ['Besoin cumulé', c.s2], ['Production cumulée', c.s1]]} />
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 10, right: 16, left: 4 }}>
              <CartesianGrid stroke={c.grid} vertical={false} /><XAxis dataKey="week" {...axisProps(c)} />
              <YAxis {...axisProps(c)} width={56} tickFormatter={(v) => `${num(v / 1000, 0)}k`} />
              <Tooltip content={<VizTooltip fmt={(v) => `${num(v)} pcs`} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
              <Bar isAnimationActive={false} dataKey="need" name="Besoin hebdo" fill={c.s3} radius={[4, 4, 0, 0]} barSize={18} />
              <Line isAnimationActive={false} type="monotone" dataKey="cumNeed" name="Besoin cumulé" stroke={c.s2} strokeWidth={2} dot={{ r: 3 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="cumOut" name="Production cumulée" stroke={c.s1} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
