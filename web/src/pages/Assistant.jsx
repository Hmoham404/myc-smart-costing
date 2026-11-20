import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Send, Wrench, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { computeCosting } from '../lib/engine'
import { leverByKey, metricByKey } from '../lib/levers'
import { runTool, TOOL_LABEL } from '../lib/aiTools'
import { DEFAULT_PRODUCT } from '../lib/defaults'
import { productFromRow } from './Calculator'
import { fmtMetric } from './WhatIf'
import { offlineAnswer } from './assistantOffline'
import { Avatar } from '../components/ui'
import { useViz, axisProps, VizTooltip } from '../components/viz'
import { num } from '../lib/format'

const MAX_STEPS = 10

// Mise en forme minimale (gras, listes, retours à la ligne) — le texte est échappé avant
function renderText(t) {
  const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = esc
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/^\s*[-•*]\s+(.+)$/gm, '<span class="li">$1</span>')
    .replace(/\n/g, '<br/>')
  return { __html: html }
}

function MiniChart({ chart }) {
  const c = useViz()
  const L = leverByKey[chart.lever]; const M = metricByKey[chart.metric]
  return (
    <div className="chat-chart">
      <div className="card-sub" style={{ marginBottom: 4 }}><b>{M.label}</b> selon <b>{L.label}</b></div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={chart.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="x" type="number" domain={[L.min, L.max]} {...axisProps(c)} tickFormatter={(v) => num(v, L.dec)} />
            <YAxis {...axisProps(c)} width={56} domain={['auto', 'auto']} tickFormatter={(v) => (M.unit === '$' ? v.toFixed(3) : num(v, 0))} />
            <Tooltip content={<VizTooltip labelFmt={(x) => `${L.label} = ${num(x, L.dec)} ${L.unit}`} fmt={(v) => fmtMetric(M, v)} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
            <ReferenceLine x={chart.current} stroke={c.ref} />
            <Line isAnimationActive={false} type="stepAfter" dataKey="y" name={M.label} stroke={c.s1} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Assistant() {
  const { params: P, profile, lang } = useApp()
  const [products, setProducts] = useState([])
  const [goals, setGoals] = useState([])
  const [product, setProductState] = useState(DEFAULT_PRODUCT)
  const productRef = useRef(DEFAULT_PRODUCT)
  const [convo, setConvo] = useState([]) // messages envoyés à l'API (contenu complet, blocs de réflexion inclus)
  const [view, setView] = useState([]) // bulles affichées
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const end = useRef(null)

  useEffect(() => {
    Promise.all([
      supabase.from('mc_products').select('*').order('reference'),
      supabase.from('mc_clients').select('*'),
      supabase.from('mc_goals').select('*').order('created_at', { ascending: false }),
    ]).then(([p, c, g]) => {
      const list = (p.data || []).map((row) => ({ reference: row.reference, product: { ...productFromRow(row, (c.data || []).find((x) => x.id === row.client_id)), quantity: 50000, scrap: 0.12 } }))
      setProducts(list.length ? list : [{ reference: DEFAULT_PRODUCT.reference, product: DEFAULT_PRODUCT }])
      setGoals(g.data || [])
    })
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [view, busy])

  const setProduct = (p) => { productRef.current = p; setProductState(p) }
  const r = useMemo(() => computeCosting(product, P, 'excel'), [product, P])

  const toolCtx = {
    P, products, goals,
    getProduct: () => productRef.current,
    setProduct,
    saveGoal: async (row) => {
      const { error } = await supabase.from('mc_goals').insert({ ...row, status: 'actif', ai_summary: 'Objectif fixé avec l\'assistant IA.', created_by: profile.id })
      if (error) throw new Error(error.message)
      await publishPost(profile.id, 'status', `🎯 Objectif fixé avec l'assistant IA : ${row.title}.`)
      const { data } = await supabase.from('mc_goals').select('*').order('created_at', { ascending: false })
      setGoals(data || [])
    },
  }

  const updateLast = (fn) => setView((v) => { const copy = [...v]; copy[copy.length - 1] = fn({ ...copy[copy.length - 1] }); return copy })

  const ask = async (text) => {
    const q = text.trim()
    if (!q || busy) return
    setInput(''); setBusy(true); setAiError(null)
    setView((v) => [...v, { from: 'me', text: q }, { from: 'bot', text: '', tools: [], charts: [] }])
    let msgs = [...convo, { role: 'user', content: q }]
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const { data, error } = await supabase.functions.invoke('mc-ai', { body: { messages: msgs, lang } })
        if (error) {
          let detail = error.message
          try { const b = await error.context?.json?.(); if (b?.error) detail = b.error } catch { /* ignore */ }
          throw new Error(detail)
        }
        if (data?.error) throw new Error(data.error)
        msgs = [...msgs, { role: 'assistant', content: data.content }]
        const said = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
        if (said) updateLast((m) => ({ ...m, text: m.text ? `${m.text}\n\n${said}` : said }))

        if (data.stop_reason === 'refusal') {
          updateLast((m) => ({ ...m, text: `${m.text}\n\n(Demande refusée par les filtres de sécurité.)` }))
          break
        }
        if (data.stop_reason === 'max_tokens') {
          updateLast((m) => ({ ...m, text: `${m.text}\n\n(Réponse tronquée : longueur maximale atteinte.)` }))
          break
        }
        const uses = data.content.filter((b) => b.type === 'tool_use')
        if (data.stop_reason !== 'tool_use' || uses.length === 0) break

        // Exécution des outils dans le navigateur (moteur de calcul validé), tous les résultats dans UN message
        const results = []
        for (const tu of uses) {
          try {
            const res = await runTool(tu.name, tu.input || {}, toolCtx)
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(res.content) })
            updateLast((m) => ({ ...m, tools: [...m.tools, { name: tu.name, ok: true }], charts: res.chart ? [...m.charts, res.chart] : m.charts }))
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: `Erreur : ${e.message}`, is_error: true })
            updateLast((m) => ({ ...m, tools: [...m.tools, { name: tu.name, ok: false }] }))
          }
        }
        msgs = [...msgs, { role: 'user', content: results }]
      }
      setConvo(msgs)
    } catch (e) {
      setAiError(e.message)
      // Secours hors ligne : réponse par règles à partir du moteur (sans IA)
      const other = computeCosting(productRef.current, P, 'corrected')
      updateLast((m) => ({ ...m, offline: true, text: offlineAnswer(q, { product: productRef.current, P, r: computeCosting(productRef.current, P, 'excel'), other }) }))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setConvo([]); setView([]); setAiError(null) }

  return (
    <>
      <div className="page-header">
        <h1><Sparkles size={22} color="#6250d6" /> Assistant IA</h1>
        <div className="btn-row">
          <select className="input" style={{ width: 240 }} value={product.reference}
            onChange={(e) => { const f = products.find((p) => p.reference === e.target.value); if (f) setProduct(f.product) }}>
            {products.map((p) => <option key={p.reference} value={p.reference}>{p.product.client} · {p.reference}</option>)}
          </select>
          <button className="btn btn-light" onClick={reset}><RotateCcw size={15} /> Nouvelle conversation</button>
        </div>
      </div>

      <div className="dash">
        <div className="card span-8" style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
          <div className="chat" style={{ flex: 1, maxHeight: 'none' }}>
            {view.length === 0 && (
              <div className="empty" style={{ padding: '50px 20px' }}>
                <Sparkles size={36} color="#6250d6" />
                <h3 style={{ margin: '10px 0 6px', color: 'var(--text)' }}>Bonjour {profile?.full_name?.split(' ')[0]}, que voulez-vous analyser ?</h3>
                <div>Je calcule avec le moteur validé sur les fichiers Excel de Slah. Je n'invente aucun prix.</div>
              </div>
            )}
            {view.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                {m.from === 'bot' && <Avatar name="IA" size={30} color="#6250d6" />}
                <div className={`msg ${m.from}`} style={{ maxWidth: m.charts?.length ? '92%' : '85%' }}>
                  {m.tools?.length > 0 && (
                    <div className="tool-chips">
                      {m.tools.map((t, k) => <span key={k} className={`tool-chip ${t.ok ? '' : 'err'}`}><Wrench size={11} /> {TOOL_LABEL[t.name] || t.name}</span>)}
                    </div>
                  )}
                  {m.offline && <div className="tool-chips"><span className="tool-chip err"><AlertTriangle size={11} /> Réponse hors ligne (sans IA)</span></div>}
                  {m.text ? <div dangerouslySetInnerHTML={renderText(m.text)} /> : (busy && i === view.length - 1 && <span className="typing"><i /><i /><i /></span>)}
                  {m.charts?.map((ch, k) => <MiniChart key={k} chart={ch} />)}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          {aiError && (
            <div className="alert warning" style={{ marginTop: 10 }}>
              <AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} />
              <div><b>IA non joignable — réponse hors ligne affichée</b>{aiError}<div className="card-sub">Déployez la fonction <code>mc-ai</code> et le secret <code>ANTHROPIC_API_KEY</code> (voir README).</div></div>
            </div>
          )}
          <div className="btn-row" style={{ margin: '12px 0' }}>
            {['Explique-moi ce prix', 'Comment passer sous 0,45 $ ?', 'Je veux une marge de 45 %, que faire ?', 'Montre la courbe du prix selon la vitesse chaîne', 'Quelles anomalies dans le calcul ?', 'Prix pour 15 000 pièces nouveau client'].map((s) => (
              <button key={s} className="btn btn-soft" disabled={busy} onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
          <form className="composer-row" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
            <input className="composer-input" placeholder="Posez une question, fixez un objectif…" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <button className="icon-btn" style={{ background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }} disabled={busy}><Send size={18} /></button>
          </form>
        </div>

        <div className="span-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Pièce analysée</div>
            <div className="kpis">
              <div className="kpi hero"><div className="k-label">Prix de vente</div><div className="k-value">{fmtMetric(metricByKey.finalPrice, r.totals.finalPrice)}</div></div>
              <div className="kpi"><div className="k-label">Prix de revient</div><div className="k-value">{fmtMetric(metricByKey.unitCost, r.totals.unitCost)}</div></div>
              <div className="kpi"><div className="k-label">Marge</div><div className="k-value">{fmtMetric(metricByKey.marginPct, metricByKey.marginPct.get(r))}</div></div>
              <div className="kpi"><div className="k-label">Capacité</div><div className="k-value">{num(r.capacity.capacity)} pcs</div></div>
            </div>
            <div className="card-sub" style={{ marginTop: 8 }}>{product.client} · {product.reference} · mode Excel</div>
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title"><CheckCircle2 size={16} /> Objectifs enregistrés</div>
            {goals.length === 0 && <div className="card-sub">Aucun. Demandez à l'IA : « fixe l'objectif prix ≤ 0,45 $ pour fin décembre ».</div>}
            {goals.slice(0, 6).map((g) => <div key={g.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--divider)' }}><b>{g.title}</b> <span className={`pill ${g.status}`}>{g.status}</span></div>)}
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Comment ça marche</div>
            <div className="card-sub" style={{ lineHeight: 1.6 }}>
              L'IA (Claude) comprend la question et choisit ses outils : simulation, recherche d'objectif, sensibilité, courbes, détail du calcul.
              Chaque chiffre est calculé par le moteur de l'application, identique au fichier Excel. Les outils utilisés s'affichent au-dessus de chaque réponse.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
