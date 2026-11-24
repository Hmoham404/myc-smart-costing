import { useMemo, useState } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Plus } from 'lucide-react'
import { computeCapacity } from '../../lib/capacity'
import EditTable from '../../components/EditTable'
import { NumInput, Seg } from '../../components/ui'
import { useViz, axisProps, VizTooltip, Legend } from '../../components/viz'
import { num, pct } from '../../lib/format'

const KIND = [{ value: 'injection', label: 'Injection' }, { value: 'metallization', label: 'Métallisation' }, { value: 'cycle', label: 'Autre (cycle)' }]

export default function CapacityProject({ data, setData }) {
  const c = useViz()
  const [mode, setMode] = useState('excel')
  const [ref, setRef] = useState(null)
  const r = useMemo(() => computeCapacity(data, mode), [data, mode])
  const weeks = data.weeks || []
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: v }))
  const setWeek = (i, k, v) => setData((d) => ({ ...d, weeks: d.weeks.map((w, j) => (j === i ? { ...w, [k]: v } : w)) }))

  // Courbe : besoin cumulé vs production cumulée de l'opération suivie (par défaut la dernière : assemblage)
  const tracked = r.plan.find((p) => p.id === ref) || r.plan[r.plan.length - 1]
  const chart = weeks.map((w, i) => {
    const cumNeed = r.need.slice(0, i + 1).reduce((a, b) => a + b, 0)
    const cumOut = tracked ? tracked.rows.slice(0, i + 1).reduce((a, x) => a + x.output, 0) : 0
    return { week: w.label, need: r.need[i], cumNeed, cumOut, mod: r.modPerWeek[i] }
  })
  const maxOut = Math.max(1, ...r.plan.flatMap((p) => p.rows.map((x) => x.output)))

  return (
    <>
      <div className="dash">
        <div className="card span-12">
          <div className="kpis">
            <div className="kpi hero"><div className="k-label">Besoin client total</div><div className="k-value">{num(r.totalNeed)} pcs</div></div>
            <div className="kpi"><div className="k-label">Goulot (capacité / objectif)</div><div className="k-value">{r.bottleneck ? pct(r.bottleneck.coverage, 0) : '—'}</div>
              <div className="k-delta flat">{r.bottleneck ? `${r.bottleneck.process} — ${r.bottleneck.component}` : ''}</div></div>
            <div className="kpi"><div className="k-label">MOD max / semaine</div><div className="k-value">{num(Math.max(0, ...r.modPerWeek))}</div></div>
            <div className="kpi"><div className="k-label">Opérations</div><div className="k-value">{r.ops.length}</div></div>
            <div className="kpi"><div className="k-label">Calcul</div><Seg value={mode} onChange={setMode} options={[['excel', 'Excel'], ['corrected', 'Corrigé']]} /></div>
          </div>
          {mode === 'excel' && r.ops.some((o) => o.doubleEff) && (
            <div className="alert warning" style={{ marginTop: 10 }}><AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} />
              <div><b>Classeur : efficacité appliquée deux fois sur la métallisation</b>La capacité journalière des lignes de métallisation est multipliée une 2ᵉ fois par l'efficacité (Excel). Le mode « Corrigé » ne l'applique qu'une fois.</div></div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Opérations et cadences</div>
        <EditTable rows={data.operations || []} onChange={set('operations')}
          newRow={() => ({ id: `op${Date.now()}`, process: 'Assemblage', component: '', code: '', machine: '', kind: 'cycle', machines: 1, cycle: 6, machineCycle: 30, cavities: 4, speed: 9, jumps: 1, hoursPerShift: 7.5, shiftsPerDay: 2, daysPerWeek: 6, efficiency: 0.8, scrap: 0, modPerShift: 1, objective: data.operations?.[0]?.objective || 0, startWeek: weeks[0]?.label || '', rampFirstWeek: 1 })}
          columns={[
            { key: 'process', label: 'Procédé', type: 'text' }, { key: 'component', label: 'Composant', type: 'text' }, { key: 'code', label: 'Code TD', type: 'text' },
            { key: 'kind', label: 'Calcul cycle', type: 'select', options: KIND }, { key: 'machines', label: 'Machines', type: 'num', dec: 0 },
            { key: 'cycle', label: 'Cycle (s)', type: 'num' }, { key: 'machineCycle', label: 'Cycle presse (s)', type: 'num' }, { key: 'cavities', label: 'Empreintes', type: 'num', dec: 0 },
            { key: 'speed', label: 'Vitesse (m/min)', type: 'num' }, { key: 'jumps', label: 'Sauts', type: 'num', dec: 0 },
            { key: 'hoursPerShift', label: 'h / poste', type: 'num' }, { key: 'shiftsPerDay', label: 'Postes / j', type: 'num', dec: 0 }, { key: 'daysPerWeek', label: 'j / sem.', type: 'num', dec: 0 },
            { key: 'efficiency', label: 'Efficacité %', type: 'pct' }, { key: 'modPerShift', label: 'MOD / poste', type: 'num', dec: 0 },
            { key: 'objective', label: 'Objectif / sem.', type: 'num', dec: 0 },
            { key: 'startWeek', label: 'Début', type: 'select', options: weeks.map((w) => w.label) }, { key: 'rampFirstWeek', label: '1ʳᵉ sem. %', type: 'pct' },
            { key: 'ct', label: 'Cycle retenu (s)', type: 'calc', value: (_, i) => num(r.ops[i]?.cycle, 3) },
            { key: 'h', label: 'Cadence / h', type: 'calc', value: (_, i) => num(r.ops[i]?.hourly, 0) },
            { key: 'd', label: '/ jour', type: 'calc', value: (_, i) => num(r.ops[i]?.daily, 0) },
            { key: 'w', label: '/ semaine', type: 'calc', value: (_, i) => <b>{num(r.ops[i]?.weekly, 0)}</b> },
            { key: 'cov', label: 'Couverture', type: 'calc', value: (_, i) => { const v = r.ops[i]?.coverage; return v == null ? '—' : <span style={{ color: v < 1 ? 'var(--bad)' : 'var(--good)', fontWeight: 700 }}>{pct(v, 0)}</span> } },
            { key: 'mod', label: 'MOD / j', type: 'calc', value: (_, i) => num(r.ops[i]?.mod, 0) },
          ]} />
        <div className="card-sub" style={{ marginTop: 6 }}>Cycle retenu : injection = cycle presse ÷ empreintes ; métallisation = 60 ÷ ((1000 ÷ 44,45) ÷ (sauts + 1) × vitesse) ; autres = cycle saisi. Cadence/h = 3600 ÷ cycle × efficacité × machines.</div>
      </div>

      <div className="card">
        <div className="card-title">Besoin client par semaine
          <span className="spacer" /><button className="btn btn-light" onClick={() => setData((d) => ({ ...d, weeks: [...(d.weeks || []), { label: `w${(d.weeks || []).length + 1}`, need: 0 }] }))}><Plus size={13} /> Semaine</button></div>
        <div className="table-wrap">
          <table className="t gantt">
            <thead>
              <tr><th>Semaine</th>{weeks.map((w, i) => <th key={i} className="num"><input className="input wk-in" value={w.label} onChange={(e) => setWeek(i, 'label', e.target.value)} /></th>)}<th className="num">Total</th></tr>
            </thead>
            <tbody>
              <tr><td><b>Besoin client</b></td>{weeks.map((w, i) => <td key={i}><NumInput className="input wk-in" value={w.need} onChange={(v) => setWeek(i, 'need', v)} /></td>)}<td className="num"><b>{num(r.totalNeed)}</b></td></tr>
              {r.plan.map((p) => (
                <tr key={p.id}>
                  <td className="gantt-label" title={p.label}>{p.label}{p.shortage && <span className="pill refuse" style={{ marginInlineStart: 6 }}>rupture {p.shortage}</span>}</td>
                  {p.rows.map((x, i) => (
                    <td key={i} className="gantt-cell" title={`Production ${num(x.output)} · stock ${num(x.stock)}`}>
                      {x.output > 0 && <div className={`gantt-bar k-${p.kind}`} style={{ opacity: 0.35 + 0.65 * (x.output / maxOut) }}>{num(x.output / 1000, 0)}k</div>}
                    </td>
                  ))}
                  <td className="num">{num(p.made)}</td>
                </tr>
              ))}
              <tr><td><b>MOD / semaine</b></td>{r.modPerWeek.map((m, i) => <td key={i} className="num">{m || ''}</td>)}<td /></tr>
            </tbody>
          </table>
        </div>
        <div className="card-sub" style={{ marginTop: 6 }}>Chaque opération produit à sa capacité hebdomadaire à partir de sa semaine de début (1ʳᵉ semaine selon le % de montée), jusqu'au besoin total + rebut. « Rupture » : le stock cumulé passe sous le besoin.</div>
      </div>

      <div className="card">
        <div className="card-title">Production cumulée vs besoin cumulé
          <span className="spacer" />
          <select className="input" style={{ width: 280 }} value={tracked?.id || ''} onChange={(e) => setRef(e.target.value)}>
            {r.plan.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <Legend items={[['Besoin hebdo', c.s3], ['Besoin cumulé', c.s2], ['Production cumulée', c.s1]]} />
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 10, right: 16, left: 4 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="week" {...axisProps(c)} />
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
