import { useEffect, useMemo, useState } from 'react'
import { Droplets, FileText, Plus, Trash2, Save, AlertTriangle, TrendingUp, Palette, Pencil, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { computeCosting } from '../lib/engine'
import { DEFAULT_PRODUCT } from '../lib/defaults'
import { ROLES, infoFor, DEFAULT_SYSTEM, latestPrices } from '../lib/paints'
import { Field, NumInput, Seg, useToast } from '../components/ui'
import { useViz, axisProps, VizTooltip, Legend } from '../components/viz'
import { money, num, pct } from '../lib/format'
import { usePaintCatalog, applyColor } from '../lib/usePaintCatalog'

const EMPTY_INV = { invoice_no: '', invoice_date: '', supplier: 'ZHEJIANG UVCHEM SPECIAL COATINGS', fx_usd_rmb: 7, moq_kg: 6000, moq_surcharge: 0.05, rows: [{ code: '', price: 0, packing: 18, drums: 0 }] }

export default function Paint() {
  const { params: P, profile, paramSet, reloadParams } = useApp()
  const c = useViz()
  const [toast, setToast] = useToast()
  const [invoices, setInvoices] = useState([])
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState(null)
  const [system, setSystem] = useState(DEFAULT_SYSTEM)
  const [method, setMethod] = useState('max')
  const [belowMoq, setBelowMoq] = useState(false)
  const [shipCoef, setShipCoef] = useState(P.paint.shipment_coef)
  const [form, setForm] = useState(null)
  const cat = usePaintCatalog()
  const NEW_COLOR = { id: null, name: '', family: 'special', hex: '#c3262e', metallic: true, notes: '' }
  const [colorMeta, setColorMeta] = useState(null) // couleur en cours d'édition (null = système par défaut)

  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from('mc_paint_invoices').select('*').order('invoice_date'),
      supabase.from('mc_paint_items').select('*'),
    ])
    if (a.error) setErr(a.error.message)
    setInvoices(a.data || []); setItems(b.data || []); setLoaded(true)
  }
  useEffect(() => { load() }, [])

  const latest = useMemo(() => latestPrices(invoices, items), [invoices, items])
  const codes = useMemo(() => [...new Set(items.map((i) => i.code))].sort(), [items])
  const priceOf = (inv, code) => { const it = items.find((x) => x.invoice_id === inv.id && x.code === code); return it ? Number(it.price_usd_kg) : null }
  const [first, last] = [invoices[0], invoices[invoices.length - 1]]

  // Comparaison des prix entre la première et la dernière facture
  const evolution = useMemo(() => (first && last && first !== last
    ? codes.map((code) => ({ code, a: priceOf(first, code), b: priceOf(last, code) })).filter((r) => r.a && r.b)
    : []), [codes, first, last, items])

  // Paramètres de chiffrage obtenus avec le système choisi
  const P2 = useMemo(() => {
    const priceFor = (code) => latest[code]?.price ?? 0
    const p = JSON.parse(JSON.stringify(P))
    p.paint.base = system.layers.map((l) => ({ name: `${ROLES[l.role]} ${l.code}`, code: l.code, price: priceFor(l.code), cons: l.cons }))
    p.paint.pigments = system.pigments.map((g) => ({ name: infoFor(g.code).pigment || g.code, code: g.code, price: priceFor(g.code), cons: g.cons }))
    p.paint.price_method = method
    p.paint.below_moq = belowMoq
    p.paint.moq_surcharge = last?.moq_surcharge ?? 0.05
    p.paint.shipment_coef = shipCoef
    return p
  }, [P, system, latest, method, belowMoq, shipCoef, last])

  const ref = { ...DEFAULT_PRODUCT, jumps: 4 }
  const colorCost = (color) => computeCosting(applyColor(ref, color, cat.colorToPaint), P, 'excel')
  const editColor = (color) => {
    setColorMeta(color ? { id: color.id, name: color.name, family: color.family, hex: color.hex, metallic: color.metallic, notes: color.notes || '' } : { ...NEW_COLOR })
    setSystem(color ? { layers: color.layers?.length ? color.layers : DEFAULT_SYSTEM.layers, pigments: color.pigments || [] } : { layers: DEFAULT_SYSTEM.layers, pigments: [] })
    setTimeout(() => document.getElementById('recette')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const saveColor = async () => {
    if (!colorMeta?.name?.trim()) { setToast('Donnez un nom à la couleur'); return }
    const row = { name: colorMeta.name.trim(), family: colorMeta.family, hex: colorMeta.hex, metallic: colorMeta.metallic, notes: colorMeta.notes,
      layers: system.layers, pigments: system.pigments.filter((g) => g.code), updated_at: new Date().toISOString() }
    const res = colorMeta.id ? await supabase.from('mc_colors').update(row).eq('id', colorMeta.id)
      : await supabase.from('mc_colors').insert({ ...row, created_by: profile.id })
    if (res.error) { setToast(res.error.message); return }
    if (!colorMeta.id) await publishPost(profile.id, 'parameters', `🎨 Nouvelle couleur « ${row.name} » (${row.family === 'special' ? 'spéciale' : 'standard'}) : ${row.pigments.length} pigment(s).`)
    setToast(`Couleur « ${row.name} » enregistrée ✔`); setColorMeta(null); cat.reload()
  }
  const delColor = async (color) => {
    if (!confirm(`Supprimer la couleur « ${color.name} » ?`)) return
    const { error } = await supabase.from('mc_colors').delete().eq('id', color.id)
    if (error) setToast(error.message); else cat.reload()
  }
  const rNow = useMemo(() => computeCosting(ref, P, 'excel'), [P])
  const rNew = useMemo(() => computeCosting(ref, P2, 'excel'), [P2])

  const setLayer = (i, k, v) => setSystem((s) => ({ ...s, layers: s.layers.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }))
  const setPig = (i, k, v) => setSystem((s) => ({ ...s, pigments: s.pigments.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }))

  const apply = async () => {
    const { data: versions } = await supabase.from('mc_parameter_sets').select('version').order('version', { ascending: false }).limit(1)
    const next = (versions?.[0]?.version || 0) + 1
    await supabase.from('mc_parameter_sets').update({ is_active: false }).eq('is_active', true)
    const note = `Prix peinture UVCHEM ${last?.invoice_no || ''} (${last?.invoice_date || ''}) · méthode ${method === 'max' ? 'Excel (max)' : 'pondérée'}${belowMoq ? ' · +5 % MOQ' : ''}`
    const { error } = await supabase.from('mc_parameter_sets').insert({ name: 'Paramètres MYC TN', version: next, is_active: true, data: P2, notes: note, source: 'Page Coût peinture', created_by: profile.id })
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'parameters', `🎨 Prix peinture mis à jour (v${next}) : ${note}.\nPUPA CAP : ${money(rNow.totals.finalPrice)} → ${money(rNew.totals.finalPrice)}.`)
    setToast(`Paramètres v${next} activés ✔`); reloadParams()
  }

  const saveInvoice = async () => {
    const { rows, ...inv } = form
    if (!inv.invoice_no || !inv.invoice_date) { setToast('Numéro et date obligatoires'); return }
    const { data, error } = await supabase.from('mc_paint_invoices').insert({ ...inv, created_by: profile.id }).select('id').single()
    if (error) { setToast(error.message); return }
    const lines = rows.filter((r) => r.code).map((r) => ({ invoice_id: data.id, code: r.code.trim().toUpperCase(), price_usd_kg: r.price, packing_kg: r.packing, drums: r.drums, qty_kg: r.packing * r.drums, amount_usd: r.price * r.packing * r.drums }))
    if (lines.length) { const e2 = await supabase.from('mc_paint_items').insert(lines); if (e2.error) { setToast(e2.error.message); return } }
    setForm(null); setToast('Facture enregistrée ✔'); load()
  }
  const delInvoice = async (inv) => { if (confirm(`Supprimer la facture ${inv.invoice_no} ?`)) { await supabase.from('mc_paint_invoices').delete().eq('id', inv.id); load() } }

  const codeOptions = (role) => codes.filter((cd) => role === 'any' || infoFor(cd).role === role || (role === 'primer' && infoFor(cd).role === 'treatment'))

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><Droplets size={22} /> Coût peinture</h1>
        <div className="btn-row">
          <button className="btn btn-light" onClick={() => setForm({ ...EMPTY_INV, rows: [...EMPTY_INV.rows] })}><Plus size={15} /> Ajouter une facture</button>
          <button className="btn btn-primary" onClick={apply} disabled={!invoices.length}><Save size={15} /> Appliquer aux paramètres</button>
        </div>
      </div>

      {err && <div className="db-warning"><b>Tables peinture absentes.</b> Exécutez <code>supabase/schema.sql</code> puis <code>supabase/seed_peinture.sql</code> dans Supabase → SQL Editor. <div className="card-sub">{err}</div></div>}
      {loaded && !err && !invoices.length && <div className="db-warning"><b>Aucune facture.</b> Exécutez <code>supabase/seed_peinture.sql</code> (factures UVCHEM du 19/11/2025 et du 10/01/2026) ou ajoutez une facture.</div>}

      <div className="dash">
        <div className="card span-12">
          <div className="card-title"><Palette size={17} /> Couleurs (teintes) <span className="pill brouillon">{cat.colors.length}</span>
            <span className="spacer" /><button className="btn btn-primary" onClick={() => editColor(null)}><Plus size={14} /> Nouvelle couleur</button></div>
          {cat.error && <div className="card-sub">Table des couleurs absente : exécutez <code>supabase/schema.sql</code>.</div>}
          <div className="color-grid">
            {cat.colors.map((col) => {
              const rc = colorCost(col)
              return (
                <div key={col.id} className={`color-card ${colorMeta?.id === col.id ? 'on' : ''}`}>
                  <span className="color-swatch" style={{ background: col.metallic ? `linear-gradient(135deg, #fff 0%, ${col.hex} 45%, #222 125%)` : col.hex }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{col.name}</b>
                    <div className="card-sub">{col.family === 'special' ? 'Couleur spéciale' : 'Standard'} · {(col.pigments || []).length} pigment(s)</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}><b>{num(rc.paint.pricePerKg, 2)} $/kg</b> · {money(rc.paint.costPerPiece)} / pièce · vente {money(rc.totals.finalPrice)}</div>
                  </div>
                  <div className="btn-row" style={{ flexDirection: 'column' }}>
                    <button className="btn btn-light" style={{ padding: '4px 8px' }} onClick={() => editColor(col)} title="Modifier"><Pencil size={13} /></button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => delColor(col)} title="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            })}
            {!cat.colors.length && !cat.error && <div className="card-sub">Aucune couleur. Cliquez sur « Nouvelle couleur ».</div>}
          </div>
          <div className="card-sub" style={{ marginTop: 8 }}>Coûts calculés sur la pièce de référence PUPA CAP (50K) avec les derniers prix des factures. Les couleurs se choisissent ensuite dans le calculateur et dans « Pièces 3D ».</div>
        </div>

        {invoices.map((inv) => {
          const its = items.filter((x) => x.invoice_id === inv.id)
          const kg = its.reduce((a, x) => a + Number(x.qty_kg || 0), 0)
          const usd = its.reduce((a, x) => a + Number(x.amount_usd || 0), 0)
          return (
            <div key={inv.id} className="card span-3 stat">
              <div className="stat-top">Facture {inv.invoice_no}<span className="stat-icon"><FileText size={18} /></span></div>
              <div className="stat-value">{money(usd, 'USD', 0)}</div>
              <div className="card-sub">{new Date(inv.invoice_date).toLocaleDateString('fr-FR')} · {num(kg, 1)} kg · moyenne {money(kg ? usd / kg : 0, 'USD', 2)}/kg</div>
              <div className="card-sub">{inv.incoterm} · 1 USD = {num(inv.fx_usd_rmb, 2)} RMB · MOQ {num(inv.moq_kg)} kg (+{pct(inv.moq_surcharge)} en dessous)
                <button className="btn btn-danger" style={{ marginInlineStart: 8, padding: '2px 6px' }} onClick={() => delInvoice(inv)}><Trash2 size={12} /></button></div>
            </div>
          )
        })}
        {last && (
          <div className="card span-3 stat">
            <div className="stat-top">Prix peinture du chiffrage<span className="stat-icon"><TrendingUp size={18} /></span></div>
            <div className="stat-value">{money(rNew.paint.pricePerKg, 'USD', 2)}/kg</div>
            <div className="card-sub">actuel (paramètres v{paramSet.version}) : {money(rNow.paint.pricePerKg, 'USD', 2)}/kg</div>
          </div>
        )}

        {evolution.length > 0 && (
          <div className="card span-7">
            <div className="card-title">Évolution des prix : {first.invoice_no} → {last.invoice_no}</div>
            <Legend items={[[new Date(first.invoice_date).toLocaleDateString('fr-FR'), c.s1], [new Date(last.invoice_date).toLocaleDateString('fr-FR'), c.s2]]} />
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={evolution} margin={{ left: 0, right: 10 }} barGap={2}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="code" {...axisProps(c)} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis {...axisProps(c)} width={40} />
                  <Tooltip content={<VizTooltip fmt={(v) => `${num(v, 2)} $/kg`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                  <Bar isAnimationActive={false} dataKey="a" name={new Date(first.invoice_date).toLocaleDateString('fr-FR')} fill={c.s1} radius={[4, 4, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="b" name={new Date(last.invoice_date).toLocaleDateString('fr-FR')} fill={c.s2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {evolution.length > 0 && (
          <div className="card span-5">
            <div className="card-title">Variation par référence</div>
            <table className="t">
              <thead><tr><th>Code</th><th>Rôle</th><th className="num">Avant</th><th className="num">Après</th><th className="num">Δ</th></tr></thead>
              <tbody>
                {evolution.map((e) => (
                  <tr key={e.code}><td><b>{e.code}</b></td><td className="card-sub">{ROLES[infoFor(e.code).role]}</td>
                    <td className="num">{num(e.a, 2)}</td><td className="num">{num(e.b, 2)}</td>
                    <td className="num" style={{ color: e.b > e.a ? 'var(--bad)' : 'var(--good)', fontWeight: 700 }}>{e.b > e.a ? '+' : ''}{pct((e.b - e.a) / e.a, 1)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Système de peinture ---- */}
        <div className="card span-8" id="recette">
          <div className="card-title">{colorMeta ? <>Recette de la couleur {colorMeta.name ? `« ${colorMeta.name} »` : '(nouvelle)'}</> : 'Système de peinture par défaut (paramètres)'}
            {colorMeta && <><span className="spacer" /><button className="btn btn-light" onClick={() => setColorMeta(null)}><X size={14} /> Fermer</button></>}</div>
          {colorMeta && (
            <div className="grid g4" style={{ marginBottom: 14, alignItems: 'end' }}>
              <Field label="Nom de la couleur"><input value={colorMeta.name} placeholder="ex. Rouge D&G" onChange={(e) => setColorMeta({ ...colorMeta, name: e.target.value })} /></Field>
              <Field label="Famille"><Seg value={colorMeta.family} onChange={(v) => setColorMeta({ ...colorMeta, family: v })} options={[['standard', 'Standard'], ['special', 'Spéciale']]} /></Field>
              <Field label="Couleur d'affichage (3D)"><input type="color" value={colorMeta.hex} onChange={(e) => setColorMeta({ ...colorMeta, hex: e.target.value })} style={{ height: 40, padding: 3 }} /></Field>
              <Field label="Aspect"><Seg value={colorMeta.metallic ? 'm' : 'p'} onChange={(v) => setColorMeta({ ...colorMeta, metallic: v === 'm' })} options={[['m', 'Métallisé'], ['p', 'Mat / laqué']]} /></Field>
            </div>
          )}
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Couche</th><th>Référence UVCHEM</th><th className="num">Prix ($/kg)</th><th className="num">Conso (g / pièce réf.)</th><th>Source</th></tr></thead>
              <tbody>
                {system.layers.map((l, i) => (
                  <tr key={i}>
                    <td><b>{ROLES[l.role]}</b></td>
                    <td><select className="input" style={{ padding: '5px 8px' }} value={l.code} onChange={(e) => setLayer(i, 'code', e.target.value)}>
                      {[...new Set([l.code, ...codeOptions(l.role === 'treatment' ? 'primer' : l.role)])].map((cd) => <option key={cd} value={cd}>{cd} — {infoFor(cd).label}</option>)}
                    </select></td>
                    <td className="num">{latest[l.code] ? num(latest[l.code].price, 2) : '—'}</td>
                    <td className="num"><NumInput className="input" style={{ width: 90, textAlign: 'end' }} value={l.cons} onChange={(v) => setLayer(i, 'cons', v)} /></td>
                    <td className="card-sub">{latest[l.code]?.invoice || '—'}</td>
                  </tr>
                ))}
                {system.pigments.map((g, i) => (
                  <tr key={`p${i}`}>
                    <td className="card-sub">Pigment</td>
                    <td><select className="input" style={{ padding: '5px 8px' }} value={g.code} onChange={(e) => setPig(i, 'code', e.target.value)}>
                      {[...new Set([g.code, ...codeOptions('pigment')])].map((cd) => <option key={cd} value={cd}>{cd} — {infoFor(cd).label}</option>)}
                    </select></td>
                    <td className="num">{latest[g.code] ? num(latest[g.code].price, 2) : '—'}</td>
                    <td className="num"><NumInput className="input" style={{ width: 90, textAlign: 'end' }} value={g.cons} onChange={(v) => setPig(i, 'cons', v)} /></td>
                    <td className="card-sub">{latest[g.code]?.invoice || '—'} <button className="btn btn-danger" style={{ padding: '2px 6px', marginInlineStart: 6 }} onClick={() => setSystem((st) => ({ ...st, pigments: st.pigments.filter((_, j) => j !== i) }))}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn btn-light" onClick={() => setSystem((st) => ({ ...st, pigments: [...st.pigments, { code: codeOptions('pigment')[0] || '', cons: 0.01 }] }))}><Plus size={14} /> Pigment</button>
            {colorMeta && <button className="btn btn-primary" onClick={saveColor}><Save size={14} /> Enregistrer la couleur</button>}
          </div>
          <div className="grid g3" style={{ marginTop: 14 }}>
            <Field label="Méthode de prix" hint="Excel : prix max des couches · pondérée : coût réel"><Seg value={method} onChange={setMethod} options={[['max', 'Excel (max)'], ['weighted', 'Pondérée']]} /></Field>
            <Field label="Commande sous le MOQ (6 000 kg)" hint="+5 % sur le prix unitaire"><Seg value={belowMoq ? 'y' : 'n'} onChange={(v) => setBelowMoq(v === 'y')} options={[['n', 'Non'], ['y', 'Oui (+5 %)']]} /></Field>
            <Field label="Coefficient transport / douane" hint="Prix facture déjà CIF Tunisie"><NumInput value={shipCoef} onChange={setShipCoef} /></Field>
          </div>
        </div>

        <div className="card span-4">
          <div className="card-title">Impact sur le chiffrage (PUPA CAP, 50K)</div>
          <div className="kpis">
            <div className="kpi"><div className="k-label">Peinture $/kg</div><div className="k-value">{num(rNew.paint.pricePerKg, 3)}</div><div className="k-delta flat">actuel {num(rNow.paint.pricePerKg, 3)}</div></div>
            <div className="kpi"><div className="k-label">Peinture / pièce</div><div className="k-value">{money(rNew.paint.costPerPiece)}</div><div className="k-delta flat">actuel {money(rNow.paint.costPerPiece)}</div></div>
            <div className="kpi"><div className="k-label">Prix de revient</div><div className="k-value">{money(rNew.totals.unitCost)}</div></div>
            <div className="kpi hero"><div className="k-label">Prix de vente</div><div className="k-value">{money(rNew.totals.finalPrice)}</div>
              <div className="k-delta" style={{ color: '#d6e6fa' }}>{rNew.totals.finalPrice >= rNow.totals.finalPrice ? '+' : ''}{pct((rNew.totals.finalPrice - rNow.totals.finalPrice) / rNow.totals.finalPrice, 1)} vs actuel</div></div>
          </div>
          <div className="alert warning" style={{ marginTop: 12 }}>
            <AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} />
            <div><b>Écart avec le fichier Excel</b>Le classeur utilise 7,90 $/kg (PEC95631-7, basecoat <b>PET</b>) et 6,80 $/kg pour l'agent de traitement, alors que la pièce ABS utilise PEC95230-20 (basecoat ABS) et PEC93821 (TEST RESULT). À valider avec Slah.</div>
          </div>
          <div className="card-sub">« Appliquer aux paramètres » crée une nouvelle version de paramètres : les anciens chiffrages gardent leurs prix.</div>
        </div>

        {form && (
          <div className="card span-12">
            <div className="card-title">Nouvelle facture peinture</div>
            <div className="grid g4">
              <Field label="N° facture"><input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></Field>
              <Field label="Date"><input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></Field>
              <Field label="Fournisseur"><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></Field>
              <Field label="Taux USD → RMB"><NumInput value={form.fx_usd_rmb} onChange={(v) => setForm({ ...form, fx_usd_rmb: v })} /></Field>
            </div>
            <table className="t" style={{ marginTop: 12 }}>
              <thead><tr><th>Code</th><th className="num">Prix $/kg (CIF)</th><th className="num">Kg / fût</th><th className="num">Fûts</th><th className="num">Montant</th><th /></tr></thead>
              <tbody>
                {form.rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className="input" list="paint-codes" value={r.code} onChange={(e) => setForm({ ...form, rows: form.rows.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })} /></td>
                    {['price', 'packing', 'drums'].map((k) => (
                      <td key={k} className="num"><NumInput className="input" style={{ width: 100, textAlign: 'end' }} value={r[k]} onChange={(v) => setForm({ ...form, rows: form.rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })} /></td>
                    ))}
                    <td className="num">{money(r.price * r.packing * r.drums, 'USD', 2)}</td>
                    <td><button className="btn btn-danger" onClick={() => setForm({ ...form, rows: form.rows.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="paint-codes">{Object.keys({ ...Object.fromEntries(codes.map((cd) => [cd, 1])) }).map((cd) => <option key={cd} value={cd} />)}</datalist>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-light" onClick={() => setForm({ ...form, rows: [...form.rows, { code: '', price: 0, packing: 18, drums: 0 }] })}><Plus size={14} /> Ligne</button>
              <button className="btn btn-primary" onClick={saveInvoice}><Save size={14} /> Enregistrer la facture</button>
              <button className="btn btn-light" onClick={() => setForm(null)}>Annuler</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
