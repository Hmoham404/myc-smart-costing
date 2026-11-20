import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Sparkles, Save, Trash2, CheckCircle2, FlaskConical, Lightbulb } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { computeCosting } from '../lib/engine'
import { METRICS, metricByKey, leverByKey, solveGoal, sweep } from '../lib/levers'
import { DEFAULT_PRODUCT } from '../lib/defaults'
import { productFromRow } from './Calculator'
import { fmtMetric } from './WhatIf'
import { Field, NumInput, Seg, useToast } from '../components/ui'
import { useViz, axisProps, VizTooltip, Legend } from '../components/viz'
import { num } from '../lib/format'

const GOAL_STATUS = { actif: 'Actif', atteint: 'Atteint', abandonne: 'Abandonné' }

/** Progression d'un objectif enregistré, recalculée avec les paramètres actifs */
export function goalProgress(g, P) {
  const m = metricByKey[g.metric]
  if (!m) return { met: false, pct: 0, label: '' }
  const current = m.get(computeCosting(g.product || DEFAULT_PRODUCT, P, g.mode || 'excel'))
  const target = Number(g.target)
  const baseline = Number(g.baseline ?? current)
  const met = g.comparator === '<=' ? current <= target + 1e-12 : current >= target - 1e-12
  const span = target - baseline
  const pct = met ? 100 : Math.abs(span) < 1e-12 ? 0 : Math.max(0, Math.min(100, ((current - baseline) / span) * 100))
  return { met, pct, current, label: `${fmtMetric(m, current)} / ${g.comparator === '<=' ? '≤' : '≥'} ${fmtMetric(m, target)}` }
}

const feasibility = (rel) => {
  const a = Math.abs(rel)
  if (a <= 0.15) return ['Réaliste', 'atteint']
  if (a <= 0.35) return ['Ambitieux', 'soumis']
  return ['Difficile', 'refuse']
}
const NOTES = {
  coef: 'baisse la marge commerciale, pas le coût',
  paint_price: 'à négocier avec le fournisseur de peinture',
  paint_cons: 'à confirmer par essai (épaisseur, réglages pistolets)',
  speed: 'vérifier la qualité de métallisation à cette vitesse',
  jumps: 'dépend de la géométrie et du gabarit',
  workers: 'vérifier le poste de travail et la sécurité',
  scrap: 'agit seulement en mode corrigé',
  line_eff: 'réduire les arrêts et micro-arrêts de chaîne',
  amort: 'dépend du plan d\'investissement',
  labor_rate: 'taux horaire de la MOD',
}

export default function Goals() {
  const { params: P, profile } = useApp()
  const c = useViz()
  const nav = useNavigate()
  const [toast, setToast] = useToast()
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [goals, setGoals] = useState([])
  const [pid, setPid] = useState('')
  const [mode, setMode] = useState('excel')
  const [metric, setMetric] = useState('finalPrice')
  const [comparator, setComparator] = useState('<=')
  const [target, setTarget] = useState(0.45)
  const [deadline, setDeadline] = useState('')
  const [title, setTitle] = useState('')
  const [chartLever, setChartLever] = useState(null)

  const loadGoals = () => supabase.from('mc_goals').select('*, author:mc_profiles(full_name)').order('created_at', { ascending: false })
    .then(({ data, error }) => { if (!error) setGoals(data || []) })
  useEffect(() => {
    supabase.from('mc_products').select('*').order('reference').then(({ data }) => setProducts(data || []))
    supabase.from('mc_clients').select('*').then(({ data }) => setClients(data || []))
    loadGoals()
  }, [])

  const product = useMemo(() => {
    const p = products.find((x) => x.id === pid)
    return p ? { ...productFromRow(p, clients.find((cl) => cl.id === p.client_id)), quantity: 50000, scrap: 0.12 } : DEFAULT_PRODUCT
  }, [pid, products, clients])
  const M = metricByKey[metric]

  const pickMetric = (k) => {
    setMetric(k)
    const m = metricByKey[k]
    setComparator(m.better === 'down' ? '<=' : '>=')
    const cur = m.get(computeCosting(product, P, mode))
    setTarget(+(m.better === 'down' ? cur * 0.9 : cur * 1.1).toFixed(m.unit === '$' ? 4 : 0))
  }

  const sol = useMemo(() => solveGoal(product, P, { metric, comparator, target }, mode), [product, P, metric, comparator, target, mode])
  const lever = chartLever && sol.single.find((s) => s.key === chartLever) ? chartLever : sol.single[0]?.key
  const curve = useMemo(() => (lever ? sweep(product, P, lever, mode, 80) : []), [product, P, lever, mode])
  const L = lever ? leverByKey[lever] : null
  const best = sol.single.find((s) => s.key === lever)

  const narrative = (() => {
    if (sol.already) return `Objectif déjà atteint : ${M.label.toLowerCase()} actuel = ${fmtMetric(M, sol.current)}.`
    if (!sol.single.length && !sol.combo) return `Objectif hors de portée avec les leviers disponibles (valeur actuelle ${fmtMetric(M, sol.current)}). Il faut revoir la cible ou le procédé.`
    const real = sol.single.filter((s) => Math.abs(s.rel) <= 0.15 && s.key !== 'coef')
    const parts = [`Il faut passer de ${fmtMetric(M, sol.current)} à ${comparator === '<=' ? '≤' : '≥'} ${fmtMetric(M, target)} (écart ${fmtMetric(M, Math.abs(sol.gap))}).`]
    if (real.length) parts.push(`Leviers réalistes (moins de 15 % de changement) : ${real.map((s) => `${s.label.toLowerCase()} ${num(s.from, s.dec)} → ${num(s.to, s.dec)} ${s.unit}`).join(' ; ')}.`)
    else parts.push('Aucun levier seul ne suffit avec moins de 15 % de changement.')
    if (sol.combo) parts.push(`Plan combiné : bouger ensemble ${sol.combo.changes.map((x) => x.label.toLowerCase()).join(', ')} d'environ ${sol.combo.pct} % suffit.`)
    return parts.join(' ')
  })()

  const save = async () => {
    const t = title || `${M.label} ${comparator === '<=' ? '≤' : '≥'} ${fmtMetric(M, target)} — ${product.client} ${product.reference}`
    const { error } = await supabase.from('mc_goals').insert({
      title: t, metric, comparator, target, baseline: sol.current, product, mode, deadline: deadline || null,
      status: sol.already ? 'atteint' : 'actif', ai_summary: narrative, created_by: profile.id,
    })
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'status', `🎯 Nouvel objectif : ${t}${deadline ? ` (échéance ${new Date(deadline).toLocaleDateString('fr-FR')})` : ''}.\n${narrative}`)
    setTitle(''); setToast('Objectif enregistré ✔'); loadGoals()
  }
  const setStatus = async (g, status) => { await supabase.from('mc_goals').update({ status }).eq('id', g.id); loadGoals() }
  const del = async (g) => { if (confirm('Supprimer cet objectif ?')) { await supabase.from('mc_goals').delete().eq('id', g.id); loadGoals() } }
  const testInAnalysis = (values) => nav('/analyse', { state: { product, values, mode } })

  return (
    <>
      {toast}
      <div className="page-header"><h1><Target size={22} /> Objectifs & assistant IA</h1></div>

      <div className="dash">
        <div className="card span-4" style={{ alignSelf: 'start' }}>
          <div className="card-title">1. Fixer l'objectif</div>
          <div className="grid">
            <Field label="Pièce">
              <select value={pid} onChange={(e) => setPid(e.target.value)}>
                <option value="">PUPA / CAP (référence Excel)</option>
                {products.map((p) => <option key={p.id} value={p.id}>{clients.find((cl) => cl.id === p.client_id)?.name} · {p.reference}</option>)}
              </select>
            </Field>
            <Field label="Indicateur">
              <select value={metric} onChange={(e) => pickMetric(e.target.value)}>
                {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </Field>
            <div className="grid g2">
              <Field label="Condition"><Seg value={comparator} onChange={setComparator} options={[['<=', '≤ au plus'], ['>=', '≥ au moins']]} /></Field>
              <Field label={`Cible (${M.unit})`}><NumInput value={target} onChange={setTarget} /></Field>
            </div>
            <Field label="Mode de calcul"><Seg value={mode} onChange={setMode} options={[['excel', 'Excel'], ['corrected', 'Corrigé']]} /></Field>
            <Field label="Échéance"><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
            <Field label="Titre (optionnel)"><input value={title} placeholder="ex. Passer PUPA sous 0,45 $" onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="kpis">
              <div className="kpi"><div className="k-label">Actuel</div><div className="k-value">{fmtMetric(M, sol.current)}</div></div>
              <div className="kpi hero"><div className="k-label">Cible</div><div className="k-value">{comparator === '<=' ? '≤' : '≥'} {fmtMetric(M, target)}</div></div>
            </div>
            <button className="btn btn-primary" onClick={save}><Save size={15} /> Enregistrer l'objectif</button>
          </div>
        </div>

        <div className="span-8" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title"><Sparkles size={18} color="#6250d6" /> 2. Ce que propose l'assistant IA</div>
            <div className={`alert ${sol.already ? 'success' : sol.single.length || sol.combo ? 'info' : 'danger'}`}><Lightbulb size={16} style={{ flex: 'none', marginTop: 2 }} /><div>{narrative}</div></div>
            {mode === 'excel' && <div className="card-sub" style={{ marginBottom: 10 }}>Mode Excel : l'efficacité journalière n'est pas proposée, car elle agit à l'envers dans le fichier (anomalie W7).</div>}

            {sol.single.length > 0 && (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>Levier (seul)</th><th className="num">Actuel</th><th className="num">Nécessaire</th><th className="num">Changement</th><th>Faisabilité</th><th className="num">Résultat</th><th /></tr></thead>
                  <tbody>
                    {sol.single.map((s) => {
                      const [f, cls] = feasibility(s.rel)
                      return (
                        <tr key={s.key} style={{ background: s.key === lever ? 'var(--primary-soft)' : undefined, cursor: 'pointer' }} onClick={() => setChartLever(s.key)}>
                          <td><b>{s.label}</b><div className="card-sub">{NOTES[s.key]}</div></td>
                          <td className="num">{num(s.from, s.dec)} {s.unit}</td>
                          <td className="num"><b>{num(s.to, s.dec)} {s.unit}</b></td>
                          <td className="num">{s.rel > 0 ? '+' : ''}{num(s.rel * 100, 1)} %</td>
                          <td><span className={`pill ${cls}`}>{f}</span></td>
                          <td className="num">{fmtMetric(M, s.result)}</td>
                          <td><button className="btn btn-light" onClick={(e) => { e.stopPropagation(); testInAnalysis({ [s.key]: s.to }) }}><FlaskConical size={14} /> Tester</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {sol.combo && (
              <div className="alert success" style={{ marginTop: 12 }}>
                <CheckCircle2 size={16} style={{ flex: 'none', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <b>Plan combiné (≈ {sol.combo.pct} % sur chaque levier) → {fmtMetric(M, sol.combo.result)}</b>
                  {sol.combo.changes.map((x) => `${x.label} ${num(x.from, x.dec)} → ${num(x.to, x.dec)} ${x.unit}`).join(' · ')}
                </div>
                <button className="btn btn-light" onClick={() => testInAnalysis(sol.combo.values)}><FlaskConical size={14} /> Tester</button>
              </div>
            )}
          </div>

          {L && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Courbe : « {M.label} » selon « {L.label} »</div>
              <Legend items={[[M.label, c.s1], ['Cible', c.s2], ['Valeur actuelle', c.ref]]} />
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={curve} margin={{ top: 16, right: 24, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="x" type="number" domain={[L.min, L.max]} {...axisProps(c)} tickFormatter={(v) => num(v, L.dec)} />
                    <YAxis {...axisProps(c)} width={64} domain={['auto', 'auto']} tickFormatter={(v) => (M.unit === '$' ? v.toFixed(3) : num(v, 0))} />
                    <Tooltip content={<VizTooltip labelFmt={(x) => `${L.label} = ${num(x, L.dec)} ${L.unit}`} fmt={(v) => fmtMetric(M, v)} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
                    <ReferenceLine y={target} stroke={c.s2} strokeWidth={2} strokeDasharray="6 4" label={{ value: `cible ${fmtMetric(M, target)}`, position: 'insideTopRight', fill: c.axis, fontSize: 11 }} />
                    <ReferenceLine x={best?.from} stroke={c.ref} strokeWidth={1.5} />
                    <Line isAnimationActive={false} type="stepAfter" dataKey={metric} name={M.label} stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    {best && <ReferenceDot x={best.to} y={best.result} r={6} fill={c.s2} stroke="var(--surface)" strokeWidth={2} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card-sub">Le point orange marque la valeur minimale de « {L.label} » qui atteint la cible. Cliquez sur une autre ligne du tableau pour changer de courbe.</div>
            </div>
          )}
        </div>

        <div className="card span-12">
          <div className="card-title">3. Suivi des objectifs</div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Objectif</th><th style={{ width: 260 }}>Progression</th><th>Échéance</th><th>Responsable</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {goals.map((g) => {
                  const pr = goalProgress(g, P)
                  return (
                    <tr key={g.id}>
                      <td><b>{g.title}</b>{g.ai_summary && <div className="card-sub" style={{ maxWidth: 520 }}>{g.ai_summary.slice(0, 160)}{g.ai_summary.length > 160 ? '…' : ''}</div>}</td>
                      <td><div className={`progress ${pr.met ? 'done' : ''}`}><div style={{ width: `${pr.pct}%` }} /></div><div className="card-sub" style={{ marginTop: 4 }}>{pr.label} · {num(pr.pct, 0)} %</div></td>
                      <td>{g.deadline ? new Date(g.deadline).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{g.author?.full_name || '—'}</td>
                      <td>
                        <select className="input" style={{ padding: '4px 8px', width: 120 }} value={g.status} onChange={(e) => setStatus(g, e.target.value)}>
                          {Object.entries(GOAL_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </td>
                      <td><button className="btn btn-danger" onClick={() => del(g)}><Trash2 size={14} /></button></td>
                    </tr>
                  )
                })}
                {!goals.length && <tr><td colSpan={6} className="empty">Aucun objectif enregistré. Fixez-en un ci-dessus.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card-sub" style={{ marginTop: 8 }}>La progression est recalculée en direct avec les paramètres actifs : modifier un paramètre (ex. vitesse chaîne) fait avancer les objectifs concernés.</div>
        </div>
      </div>
    </>
  )
}
