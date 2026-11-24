import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import EditTable from '../../components/EditTable'
import { NumInput } from '../../components/ui'
import { CATEGORIES } from '../../lib/project/engine'
import { useViz, axisProps, VizTooltip } from '../../components/viz'
import { num, pct } from '../../lib/format'

/** Onglet Capacité (formules KIKO « Nomenclature et phases ») */
export default function Capacity({ data, setData, res, mode }) {
  const c = useViz()
  const cap = res.capacity
  const S = data.schedule || {}
  const setS = (k) => (v) => setData((d) => ({ ...d, schedule: { ...d.schedule, [k]: v } }))
  const byId = Object.fromEntries(cap.ops.map((o) => [o.id, o]))
  const chart = cap.ops.map((o) => ({ name: o.label.length > 26 ? `${o.label.slice(0, 25)}…` : o.label, cov: o.coverage ? +(o.coverage * 100).toFixed(1) : 0 }))

  return (
    <>
      <div className="dash">
        <div className="card span-12">
          <div className="kpis">
            <div className="kpi hero"><div className="k-label">Objectif / semaine</div><div className="k-value">{num(cap.peak)} pcs</div><div className="k-delta" style={{ color: '#d6f5e8' }}>pic du besoin client (onglet Planning)</div></div>
            <div className="kpi"><div className="k-label">Goulot</div><div className="k-value">{cap.bottleneck ? pct(cap.bottleneck.coverage, 0) : '—'}</div><div className="k-delta flat">{cap.bottleneck?.label}</div></div>
            <div className="kpi"><div className="k-label">MOD / jour (total)</div><div className="k-value">{num(cap.ops.reduce((a, o) => a + o.mod, 0))}</div></div>
            <div className="kpi"><div className="k-label">Opérations sous l'objectif</div><div className="k-value">{cap.ops.filter((o) => o.coverage != null && o.coverage < 1).length} / {cap.ops.length}</div></div>
          </div>
          <div className="grid g4" style={{ marginTop: 14 }}>
            <div className="field"><label>Heures / poste (défaut)</label><NumInput value={S.hoursPerShift || 0} onChange={setS('hoursPerShift')} /></div>
            <div className="field"><label>Postes / jour (défaut)</label><NumInput value={S.shiftsPerDay || 0} onChange={setS('shiftsPerDay')} /></div>
            <div className="field"><label>Jours / semaine (défaut)</label><NumInput value={S.daysPerWeek || 0} onChange={setS('daysPerWeek')} /></div>
            <div className="field"><label>Efficacité % (défaut)</label><NumInput value={+((S.efficiency || 0) * 100).toFixed(1)} onChange={(v) => setS('efficiency')(v / 100)} /></div>
          </div>
          {mode === 'excel' && cap.ops.some((o) => o.doubleEff) && (
            <div className="alert warning" style={{ marginTop: 12 }}><AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} />
              <div><b>Calcul Excel : efficacité appliquée deux fois sur la métallisation</b>Le classeur KIKO multiplie la capacité journalière de la métallisation une 2ᵉ fois par l'efficacité. Choisissez « Corrigé » pour ne l'appliquer qu'une fois.</div></div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Capacité par opération</div>
        <EditTable rows={data.operations || []} onChange={(v) => setData((d) => ({ ...d, operations: v }))}
          columns={[
            { key: 'label', label: 'Opération', type: 'calc', value: (o) => <b style={{ whiteSpace: 'nowrap' }}>{o.label}</b> },
            { key: 'cat', label: 'Procédé', type: 'calc', value: (o) => <span className="card-sub">{CATEGORIES[o.category]}</span> },
            { key: 'machines', label: 'Machines', type: 'num', dec: 0 }, { key: 'workers', label: 'MOD / poste', type: 'num', dec: 0 },
            { key: 'hoursPerShift', label: 'h / poste', type: 'num', placeholder: S.hoursPerShift }, { key: 'shiftsPerDay', label: 'Postes / j', type: 'num', dec: 0, placeholder: S.shiftsPerDay },
            { key: 'daysPerWeek', label: 'j / sem.', type: 'num', dec: 0, placeholder: S.daysPerWeek }, { key: 'efficiency', label: 'Efficacité %', type: 'pct', placeholder: S.efficiency },
            { key: 'cy', label: 'Cycle (s)', type: 'calc', value: (o) => num(byId[o.id]?.cycle, 3) },
            { key: 'h', label: 'Cadence / h', type: 'calc', value: (o) => num(byId[o.id]?.hourly, 0) },
            { key: 'd', label: '/ jour', type: 'calc', value: (o) => num(byId[o.id]?.daily, 0) },
            { key: 'w', label: '/ semaine', type: 'calc', value: (o) => <b>{num(byId[o.id]?.weekly, 0)}</b> },
            { key: 'cov', label: 'Couverture', type: 'calc', value: (o) => { const v = byId[o.id]?.coverage; return v == null ? '—' : <span style={{ color: v < 1 ? 'var(--bad)' : 'var(--good)', fontWeight: 700 }}>{pct(v, 0)}</span> } },
            { key: 'mod', label: 'MOD / j', type: 'calc', value: (o) => num(byId[o.id]?.mod, 0) },
          ]} />
        <div className="card-sub" style={{ marginTop: 6 }}>Champs vides = valeurs par défaut ci-dessus. Cadence/h = 3600 ÷ cycle × efficacité × machines · /jour = × h/poste × postes · /semaine = × jours · MOD/jour = opérateurs × postes × machines.</div>
      </div>

      <div className="card">
        <div className="card-title">Couverture de l'objectif hebdomadaire</div>
        <div style={{ height: Math.max(220, chart.length * 34) }}>
          <ResponsiveContainer>
            <BarChart data={chart} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid stroke={c.grid} horizontal={false} />
              <XAxis type="number" {...axisProps(c)} tickFormatter={(v) => `${v} %`} />
              <YAxis type="category" dataKey="name" width={220} {...axisProps(c)} axisLine={false} />
              <ReferenceLine x={100} stroke={c.ref} strokeDasharray="4 4" label={{ value: 'objectif', position: 'top', fill: c.axis, fontSize: 11 }} />
              <Tooltip content={<VizTooltip fmt={(v) => `${num(v, 1)} %`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
              <Bar isAnimationActive={false} dataKey="cov" name="Couverture" radius={[0, 4, 4, 0]} barSize={14}>
                {chart.map((x, i) => <Cell key={i} fill={x.cov < 100 ? c.s2 : c.s1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
