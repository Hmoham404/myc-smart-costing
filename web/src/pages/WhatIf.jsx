import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Gauge, RotateCcw, Save, Target } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, ReferenceDot } from 'recharts'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { computeCosting, ENGINE_VERSION } from '../lib/engine'
import { LEVERS, METRICS, leverByKey, metricByKey, applyLevers, currentLeverValues, sweep, tornado } from '../lib/levers'
import { DEFAULT_PRODUCT, PROCESS_LABEL } from '../lib/defaults'
import { productFromRow, Trace } from './Calculator'
import { Seg, useToast } from '../components/ui'
import { useViz, axisProps, VizTooltip, Legend } from '../components/viz'
import { num } from '../lib/format'

export const fmtMetric = (m, v) => {
  if (v == null || Number.isNaN(v)) return '—'
  if (m.unit === '$') return `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec })} $`
  if (m.unit === '%') return `${num(v, m.dec)} %`
  return `${num(v, m.dec)} ${m.unit}`
}
const fmtLever = (l, v) => `${num(v, l.dec)}${l.unit ? ` ${l.unit}` : ''}`

function Delta({ m, base, val }) {
  const d = val - base
  if (Math.abs(d) < 1e-9) return <div className="k-delta flat">= référence</div>
  const good = m.better === 'down' ? d < 0 : d > 0
  const rel = base ? (d / Math.abs(base)) * 100 : 0
  return <div className={`k-delta ${good ? 'up-good' : 'up-bad'}`}>{d > 0 ? '▲' : '▼'} {fmtMetric(m, Math.abs(d))} ({rel > 0 ? '+' : ''}{num(rel, 1)} %)</div>
}

export default function WhatIf() {
  const { params: P, profile, paramSet } = useApp()
  const c = useViz()
  const nav = useNavigate()
  const [toast, setToast] = useToast()
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const loc = useLocation()
  const incoming = loc.state || {}
  const [pid, setPid] = useState('')
  const [mode, setMode] = useState(incoming.mode || 'excel')
  const [values, setValues] = useState(incoming.values || {})
  const [lever, setLever] = useState(Object.keys(incoming.values || {})[0] || 'speed')
  const [metric, setMetric] = useState('finalPrice')

  useEffect(() => {
    supabase.from('mc_products').select('*').order('reference').then(({ data }) => setProducts(data || []))
    supabase.from('mc_clients').select('*').then(({ data }) => setClients(data || []))
  }, [])

  const product = useMemo(() => {
    const p = products.find((x) => x.id === pid)
    if (p) return { ...productFromRow(p, clients.find((cl) => cl.id === p.client_id)), quantity: 50000, scrap: 0.12 }
    return incoming.product || DEFAULT_PRODUCT
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, products, clients])

  const base = useMemo(() => currentLeverValues(product, P, mode), [product, P, mode])
  const baseR = useMemo(() => computeCosting(product, P, mode), [product, P, mode])
  const scen = useMemo(() => applyLevers(product, P, values, mode), [product, P, values, mode])
  const cur = { ...base, ...values }
  const L = leverByKey[lever]
  const M = metricByKey[metric]

  const curve = useMemo(() => sweep(product, P, lever, mode, 80, values), [product, P, lever, mode, values])
  const torn = useMemo(() => tornado(product, P, metric, mode, 10, values).slice(0, 8), [product, P, metric, mode, values])
  const showPair = metric === 'finalPrice' || metric === 'unitCost'
  const curY = M.get(scen.r)
  const changed = Object.keys(values).filter((k) => Math.abs(values[k] - base[k]) > 1e-9)

  const saveScenario = async () => {
    const { data, error } = await supabase.from('mc_calculations').insert({
      product_id: product.product_id || null, client_id: product.client_id || null, parameter_set_id: paramSet.id,
      title: `Scénario ${product.client} — ${product.reference} (${changed.map((k) => leverByKey[k].label).join(', ') || 'référence'})`,
      mode, engine_version: ENGINE_VERSION, inputs: scen.product, params_snapshot: scen.P, results: scen.r,
      unit_cost: scen.r.totals.unitCost, final_price: scen.r.totals.finalPrice, quantity: scen.r.totals.quantity, currency: P.currency, created_by: profile.id,
    }).select('id').single()
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'calculation', `Scénario what-if ${product.client} / ${product.reference} : ${changed.map((k) => `${leverByKey[k].label} ${fmtLever(leverByKey[k], base[k])} → ${fmtLever(leverByKey[k], values[k])}`).join(' ; ') || 'aucune modification'}.`,
      data.id, { client: product.client, reference: product.reference, process: PROCESS_LABEL[product.process], unit_cost: scen.r.totals.unitCost, final_price: scen.r.totals.finalPrice, quantity: scen.r.totals.quantity })
    setToast('Scénario enregistré dans l\'historique ✔')
  }

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><Gauge size={22} /> Analyse what-if</h1>
        <div className="btn-row">
          <select className="input" style={{ width: 230 }} value={pid} onChange={(e) => { setPid(e.target.value); setValues({}) }}>
            <option value="">PUPA / CAP (référence Excel)</option>
            {products.map((p) => <option key={p.id} value={p.id}>{clients.find((cl) => cl.id === p.client_id)?.name} · {p.reference}</option>)}
          </select>
          <Seg value={mode} onChange={setMode} options={[['excel', 'Excel'], ['corrected', 'Corrigé']]} />
          <button className="btn btn-light" onClick={() => setValues({})}><RotateCcw size={15} /> Réinitialiser</button>
          <button className="btn btn-soft" onClick={() => nav('/objectifs')}><Target size={15} /> Fixer un objectif</button>
          <button className="btn btn-primary" onClick={saveScenario}><Save size={15} /> Enregistrer le scénario</button>
        </div>
      </div>

      <div className="dash">
        {/* -------- Curseurs -------- */}
        <div className="card span-4" style={{ alignSelf: 'start' }}>
          <div className="card-title">Valeurs à tester</div>
          <div className="card-sub" style={{ marginBottom: 6 }}>Bougez un curseur : tout se recalcule. Cliquez sur un nom pour tracer sa courbe.</div>
          {LEVERS.map((l) => {
            const v = cur[l.key]
            const isChanged = Math.abs(v - base[l.key]) > 1e-9
            return (
              <div key={l.key} className={`lever ${lever === l.key ? 'selected' : ''}`}>
                <div className="lever-top">
                  <span className="lever-name" onClick={() => setLever(l.key)}>{l.label}</span>
                  <b className={isChanged ? 'changed' : ''}>{fmtLever(l, v)}{isChanged && <span className="card-sub"> (réf. {fmtLever(l, base[l.key])})</span>}</b>
                </div>
                <input type="range" min={l.min} max={l.max} step={l.step} value={v}
                  onChange={(e) => { setLever(l.key); setValues((s) => ({ ...s, [l.key]: Number(e.target.value) })) }} />
              </div>
            )
          })}
        </div>

        <div className="span-8" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* -------- KPIs avec écart -------- */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Résultat du scénario {changed.length > 0 && <span className="pill envoye">{changed.length} valeur(s) modifiée(s)</span>}</div>
            <div className="kpis">
              {METRICS.map((m) => (
                <div key={m.key} className={`kpi ${m.key === 'finalPrice' ? 'hero' : ''}`} style={{ cursor: 'pointer', outline: metric === m.key && m.key !== 'finalPrice' ? '2px solid var(--primary)' : 'none' }} onClick={() => setMetric(m.key)}>
                  <div className="k-label">{m.label}</div>
                  <div className="k-value">{fmtMetric(m, m.get(scen.r))}</div>
                  {m.key === 'finalPrice'
                    ? <div className="k-delta" style={{ color: '#d6e6fa' }}>réf. {fmtMetric(m, m.get(baseR))}</div>
                    : <Delta m={m} base={m.get(baseR)} val={m.get(scen.r)} />}
                </div>
              ))}
            </div>
          </div>

          {/* -------- Courbe -------- */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">
              Effet de « {L.label} » sur {showPair ? 'les prix' : `« ${M.label} »`}
              <span className="spacer" />
              <select className="input" style={{ width: 200, padding: '6px 10px' }} value={metric} onChange={(e) => setMetric(e.target.value)}>
                {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            {showPair
              ? <Legend items={[['Prix de vente', c.s1], ['Prix de revient', c.s2], ['Valeur actuelle', c.ref]]} />
              : <Legend items={[[M.label, c.s1], ['Valeur actuelle', c.ref]]} />}
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={curve} margin={{ top: 16, right: 24, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="x" type="number" domain={[L.min, L.max]} {...axisProps(c)} tickFormatter={(v) => num(v, L.dec)}
                    label={{ value: `${L.label}${L.unit ? ` (${L.unit})` : ''}`, position: 'insideBottomRight', offset: -2, fill: c.axis, fontSize: 11 }} />
                  <YAxis {...axisProps(c)} width={64} domain={['auto', 'auto']} tickFormatter={(v) => (M.unit === '$' ? v.toFixed(M.key === 'totalAmount' ? 0 : 3) : num(v, 0))} />
                  <Tooltip content={<VizTooltip labelFmt={(x) => `${L.label} = ${fmtLever(L, x)}`} fmt={(v, k) => fmtMetric(metricByKey[k], v)} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
                  <ReferenceLine x={base[lever]} stroke={c.neutral} strokeDasharray="4 4" label={{ value: 'réf.', position: 'top', fill: c.axis, fontSize: 11 }} />
                  <ReferenceLine x={cur[lever]} stroke={c.ref} strokeWidth={1.5} />
                  {showPair ? (
                    <>
                      <Line isAnimationActive={false} type="stepAfter" dataKey="finalPrice" name="Prix de vente" stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                      <Line isAnimationActive={false} type="stepAfter" dataKey="unitCost" name="Prix de revient" stroke={c.s2} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    </>
                  ) : (
                    <Line isAnimationActive={false} type="stepAfter" dataKey={metric} name={M.label} stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  )}
                  <ReferenceDot x={cur[lever]} y={showPair ? scen.r.totals.finalPrice : curY} r={6} fill={c.s1} stroke="var(--surface)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card-sub">
              Les marches viennent des arrondis Excel (capacité arrondie au millier inférieur, heures arrondies au supérieur).
              Actuel : {fmtLever(L, cur[lever])} → {fmtMetric(M, curY)}.
            </div>
          </div>

          {/* -------- Sensibilité -------- */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Sensibilité de « {M.label} » (±10 % sur chaque valeur)</div>
            <Legend items={[['Valeur −10 %', c.s1], ['Valeur +10 %', c.s2]]} />
            <div style={{ height: Math.max(180, torn.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={torn} layout="vertical" margin={{ left: 10, right: 24 }} barGap={2}>
                  <CartesianGrid stroke={c.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps(c)} tickFormatter={(v) => (v > 0 ? '+' : '') + (M.unit === '$' ? v.toFixed(3) : num(v, 1))} />
                  <YAxis type="category" dataKey="label" width={160} {...axisProps(c)} axisLine={false} />
                  <ReferenceLine x={0} stroke={c.ref} />
                  <Tooltip content={<VizTooltip fmt={(v) => `${v >= 0 ? '+' : '−'}${fmtMetric(M, Math.abs(v))}`} />} cursor={{ fill: c.grid, opacity: .4 }} />
                  <Bar isAnimationActive={false} dataKey="low" name="Valeur −10 %" fill={c.s1} radius={4} barSize={10} />
                  <Bar isAnimationActive={false} dataKey="high" name="Valeur +10 %" fill={c.s2} radius={4} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* -------- Calcul détaillé -------- */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Calcul détaillé du scénario</div>
            <Trace r={scen.r} P={scen.P} product={scen.product} />
          </div>
        </div>
      </div>
    </>
  )
}
