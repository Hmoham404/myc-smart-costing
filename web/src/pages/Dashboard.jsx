import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calculator, FileText, Target, DollarSign, ArrowRight, AlertTriangle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { computeCosting, commercialTiers } from '../lib/engine'
import { tornado, metricByKey } from '../lib/levers'
import { DEFAULT_PRODUCT } from '../lib/defaults'
import { productFromRow } from './Calculator'
import { useViz, axisProps, VizTooltip, Legend } from '../components/viz'
import { money, num, pct, timeAgo } from '../lib/format'
import { goalProgress } from './Goals'

function Stat({ icon: Icon, label, value, sub, to }) {
  const nav = useNavigate()
  return (
    <div className="card span-3 stat" style={{ cursor: to ? 'pointer' : 'default' }} onClick={() => to && nav(to)}>
      <div className="stat-top">{label}<span className="stat-icon"><Icon size={18} /></span></div>
      <div className="stat-value">{value}</div>
      <div className="card-sub">{sub}</div>
    </div>
  )
}

export default function Dashboard() {
  const { params: P, profile } = useApp()
  const c = useViz()
  const [calcs, setCalcs] = useState([])
  const [quotes, setQuotes] = useState([])
  const [samples, setSamples] = useState([])
  const [goals, setGoals] = useState([])
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [refId, setRefId] = useState('')

  useEffect(() => {
    supabase.from('mc_calculations').select('id, title, unit_cost, final_price, quantity, mode, created_at, inputs').order('created_at', { ascending: false }).limit(30).then(({ data }) => setCalcs(data || []))
    supabase.from('mc_quotes').select('id, number, title, status, created_at').order('created_at', { ascending: false }).limit(50).then(({ data }) => setQuotes(data || []))
    supabase.from('mc_samples').select('reference, received_qty, ok_qty, nok_qty').then(({ data }) => setSamples(data || []))
    supabase.from('mc_goals').select('*').eq('status', 'actif').order('created_at', { ascending: false }).then(({ data }) => setGoals(data || []))
    supabase.from('mc_products').select('*').order('reference').then(({ data }) => setProducts(data || []))
    supabase.from('mc_clients').select('*').then(({ data }) => setClients(data || []))
  }, [])

  const product = useMemo(() => {
    const p = products.find((x) => x.id === refId)
    return p ? { ...productFromRow(p, clients.find((cl) => cl.id === p.client_id)), quantity: 50000, scrap: 0.12 } : DEFAULT_PRODUCT
  }, [refId, products, clients])
  const r = useMemo(() => computeCosting(product, P, 'excel'), [product, P])

  // Courbe prix / quantité : client connu vs nouveau client
  const curve = useMemo(() => {
    const known = commercialTiers(r.totals.finalPrice, P, 'known', product.color)
    const fresh = commercialTiers(r.totals.finalPrice, P, 'new', product.color)
    return known.map((t, i) => ({ name: t.key, known: +t.unit.toFixed(4), new: +fresh[i].unit.toFixed(4) }))
  }, [r, P, product.color])

  const breakdown = Object.entries(r.breakdown).map(([name, v]) => ({ name, v }))
  const torn = useMemo(() => tornado(product, P, 'finalPrice', 'excel', 10).slice(0, 6), [product, P])

  const pending = quotes.filter((q) => q.status === 'soumis')
  const tot = samples.reduce((a, s) => ({ rec: a.rec + s.received_qty, ok: a.ok + s.ok_qty, gap: a.gap + (s.received_qty - s.ok_qty - s.nok_qty) }), { rec: 0, ok: 0, gap: 0 })
  const avgPrice = calcs.length ? calcs.reduce((a, x) => a + Number(x.final_price || 0), 0) / calcs.length : r.totals.finalPrice
  const goalsDone = goals.filter((g) => goalProgress(g, P).met).length
  const BAR = [c.s1, c.s2, c.s3]

  return (
    <>
      <div className="page-header">
        <h1>Bonjour {profile?.full_name?.split(' ')[0]} 👋</h1>
        <div className="btn-row">
          <Link className="btn btn-light" to="/analyse">Analyse what-if</Link>
          <Link className="btn btn-primary" to="/calculateur"><Calculator size={16} /> Nouveau chiffrage</Link>
        </div>
      </div>

      <div className="dash">
        <Stat icon={Calculator} label="Chiffrages enregistrés" value={num(calcs.length)} sub="30 derniers calculs" to="/historique" />
        <Stat icon={DollarSign} label="Prix de vente moyen" value={money(avgPrice)} sub={calcs.length ? 'sur les chiffrages récents' : 'référence PUPA (Excel)'} />
        <Stat icon={FileText} label="Devis à valider" value={num(pending.length)} sub={`${quotes.length} devis au total`} to="/devis" />
        <Stat icon={Target} label="Objectifs atteints" value={`${goalsDone} / ${goals.length}`} sub="objectifs actifs" to="/objectifs" />

        <div className="card span-8">
          <div className="card-title">
            Prix de vente selon la quantité
            <span className="spacer" />
            <select className="input" style={{ width: 220, padding: '6px 10px' }} value={refId} onChange={(e) => setRefId(e.target.value)}>
              <option value="">PUPA / CAP (référence Excel)</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.reference}</option>)}
            </select>
          </div>
          <Legend items={[['Client connu', c.s1], ['Nouveau petit client', c.s2]]} />
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps(c)} />
                <YAxis {...axisProps(c)} tickFormatter={(v) => v.toFixed(2)} width={44} />
                <Tooltip content={<VizTooltip labelFmt={(l) => `Palier ${l}`} fmt={(v) => money(v)} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
                <Line isAnimationActive={false} type="monotone" dataKey="known" name="Client connu" stroke={c.s1} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line isAnimationActive={false} type="monotone" dataKey="new" name="Nouveau petit client" stroke={c.s2} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card-sub">X = {money(r.totals.finalPrice)} (prix 50K calculé) · couleur {product.color === 'special' ? 'spéciale' : 'standard'} · grille QUOTATION STANDARD FORMULA</div>
        </div>

        <div className="card span-4">
          <div className="card-title">Composition du prix de revient</div>
          <div style={{ height: 170 }}>
            <ResponsiveContainer>
              <BarChart data={breakdown} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} {...axisProps(c)} axisLine={false} />
                <Tooltip content={<VizTooltip fmt={(v) => money(v, 'USD', 5)} />} cursor={{ fill: c.grid, opacity: .4 }} />
                <Bar isAnimationActive={false} dataKey="v" name="Coût / pièce" radius={[0, 4, 4, 0]} barSize={22}>
                  {breakdown.map((_, i) => <Cell key={i} fill={BAR[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="t">
            <tbody>
              {breakdown.map((b, i) => (
                <tr key={b.name}><td><span className="legend"><span><i style={{ background: BAR[i] }} />{b.name}</span></span></td>
                  <td className="num">{money(b.v, 'USD', 4)}</td><td className="num">{pct(b.v / r.totals.unitCost, 0)}</td></tr>
              ))}
              <tr><td><b>Prix de revient</b></td><td className="num"><b>{money(r.totals.unitCost)}</b></td><td /></tr>
            </tbody>
          </table>
        </div>

        <div className="card span-7">
          <div className="card-title">Quels leviers pèsent le plus sur le prix ? <span className="spacer" /><Link to="/analyse" className="card-sub">Analyse détaillée <ArrowRight size={12} /></Link></div>
          <Legend items={[['Levier −10 %', c.s1], ['Levier +10 %', c.s2]]} />
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={torn} layout="vertical" margin={{ left: 10, right: 20 }} barGap={2}>
                <CartesianGrid stroke={c.grid} horizontal={false} />
                <XAxis type="number" {...axisProps(c)} tickFormatter={(v) => (v > 0 ? '+' : '') + v.toFixed(3)} />
                <YAxis type="category" dataKey="label" width={150} {...axisProps(c)} axisLine={false} />
                <ReferenceLine x={0} stroke={c.ref} />
                <Tooltip content={<VizTooltip fmt={(v) => `${v >= 0 ? '+' : ''}${money(v)}`} />} cursor={{ fill: c.grid, opacity: .4 }} />
                <Bar isAnimationActive={false} dataKey="low" name="Levier −10 %" fill={c.s1} radius={4} barSize={10} />
                <Bar isAnimationActive={false} dataKey="high" name="Levier +10 %" fill={c.s2} radius={4} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card-sub">Variation du prix de vente unitaire ({metricByKey.finalPrice.label}) quand chaque valeur bouge de ±10 %.</div>
        </div>

        <div className="card span-5">
          <div className="card-title">À traiter</div>
          {pending.map((q) => (
            <Link key={q.id} to={`/devis/${q.id}`} className="alert warning" style={{ color: 'inherit' }}>
              <FileText size={16} /><div><b>{q.number} à valider</b>{q.title}</div>
            </Link>
          ))}
          {tot.gap > 0 && (
            <Link to="/echantillons" className="alert danger" style={{ color: 'inherit' }}>
              <AlertTriangle size={16} /><div><b>{tot.gap} échantillon(s) non classés</b>Reçus ≠ OK + non OK · taux OK {pct(tot.rec ? tot.ok / tot.rec : 0, 1)}</div>
            </Link>
          )}
          {goals.slice(0, 4).map((g) => {
            const pr = goalProgress(g, P)
            return (
              <Link key={g.id} to="/objectifs" style={{ color: 'inherit', display: 'block', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <b>{g.title}</b><span className="card-sub">{pr.label}</span>
                </div>
                <div className={`progress ${pr.met ? 'done' : ''}`}><div style={{ width: `${pr.pct}%` }} /></div>
              </Link>
            )
          })}
          {!pending.length && !tot.gap && !goals.length && <div className="empty">Rien à traiter. <Link to="/objectifs">Fixer un objectif</Link></div>}
        </div>

        <div className="card span-12">
          <div className="card-title">Derniers chiffrages <span className="spacer" /><Link to="/historique" className="card-sub">Tout voir <ArrowRight size={12} /></Link></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Chiffrage</th><th>Mode</th><th className="num">Quantité</th><th className="num">Prix de revient</th><th className="num">Prix de vente</th><th className="num">Marge</th><th>Date</th></tr></thead>
              <tbody>
                {calcs.slice(0, 8).map((x) => (
                  <tr key={x.id}>
                    <td><Link to={`/historique?id=${x.id}`}><b>{x.title}</b></Link></td>
                    <td><span className={`pill ${x.mode === 'excel' ? 'brouillon' : 'envoye'}`}>{x.mode === 'excel' ? 'Excel' : 'Corrigé'}</span></td>
                    <td className="num">{num(x.quantity)}</td><td className="num">{money(x.unit_cost)}</td>
                    <td className="num"><b>{money(x.final_price)}</b></td>
                    <td className="num">{pct(x.final_price ? (x.final_price - x.unit_cost) / x.final_price : 0, 1)}</td>
                    <td className="card-sub">{timeAgo(x.created_at)}</td>
                  </tr>
                ))}
                {!calcs.length && <tr><td colSpan={7} className="empty">Aucun chiffrage enregistré — <Link to="/calculateur">en créer un</Link></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
