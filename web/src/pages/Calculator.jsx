import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Save, FileText, Calculator as CalcIcon, Sparkles, RotateCcw } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useApp } from '../context/AppContext'
import { supabase, publishPost } from '../lib/supabase'
import { computeCosting, detectAnomalies, commercialTiers, ENGINE_VERSION } from '../lib/engine'
import { DEFAULT_PRODUCT, PROCESS_LABEL, COLOR_LABEL, STANDARD_CONDITIONS, LEGAL_NOTE } from '../lib/defaults'
import { Field, NumInput, Seg, Kpi, useToast } from '../components/ui'
import CadenceCard from '../components/CadenceCard'
import { money, num, pct } from '../lib/format'

const PIE = ['#1877f2', '#42b72a', '#f7b928']

export function productFromRow(p, client) {
  return {
    ...DEFAULT_PRODUCT,
    product_id: p.id, client_id: p.client_id,
    client: client?.name || '', client_type: client?.client_type || 'known',
    reference: p.reference, material: p.material, shape: p.shape,
    length: Number(p.length_mm), width: Number(p.width_mm), height: Number(p.height_mm),
    d1: Number(p.d1_mm), d2: Number(p.d2_mm), process: p.process, color: p.color,
  }
}

export function Trace({ r, P, product }) {
  const t = r.totals
  return (
    <div className="trace">
      <div><span className="f">Surface pièce</span> = {num(r.geometry.surface, 2)} mm² · <span className="f">réf.</span> {num(r.geometry.refSurface, 2)} → coef. surface = <b>{num(r.geometry.surfaceCoef, 4)}</b></div>
      <div><span className="f">Diagonale</span> = {num(r.geometry.diagonal, 1)} mm → sauts suggérés {r.geometry.autoJumps}, utilisés <b>{r.geometry.jumps}</b></div>
      <div><span className="f">Capacité chaîne</span> = 60 × {P.lines[product.process].speed_m_min} m/min ÷ {num(r.capacity.distance, 5)} m{P.capacity_method === 'pitch' ? ` × ${P.lines[product.process].efficiency}` : ''} = {num(r.capacity.perHour, 1)} pcs/h → <b>{num(r.capacity.capacity)} pcs/poste</b></div>
      <div><span className="f">Cadence</span> = {num(r.capacity.cadence?.effective ?? r.capacity.capacity / P.shift_hours, 0)} pcs/h{r.capacity.cadence?.source === 'measured' ? ' (mesurée)' : ''} → {num(r.capacity.capacity)} pcs / {P.shift_hours} h</div>
      <div><span className="f">Prix peinture</span> = (max base × {num(r.paint.shareBase, 4)}{r.paint.sharePig ? ` + max pigments × ${num(r.paint.sharePig, 4)}` : ''}) × {P.paint.shipment_coef} = <b>{num(r.paint.pricePerKg, 4)} $/kg</b>{r.paint.method === 'weighted' ? ' (moyenne pondérée)' : ''}{r.paint.moqFactor > 1 ? ' (+5 % MOQ)' : ''}</div>
      <div><span className="f">Conso peinture</span> = {num(r.paint.sumBase + r.paint.sumPig, 4)} g × {num(r.paint.surfaceCoef, 4)} = <b>{num(r.paint.consPerPiece, 3)} g/pièce</b> → {money(r.paint.costPerPiece)}/pièce</div>
      <div><span className="f">Peinture / poste</span> = {money(r.paint.costPerPiece)} × {num(r.capacity.capacity)} = <b>{money(r.paint.paintShift, 'USD', 2)}</b></div>
      <div><span className="f">MOD / poste</span> = {P.hourly.labor_per_worker} $/h × {r.labor.workers} op. × {P.shift_hours} h = <b>{money(r.labor.laborShift, 'USD', 2)}</b></div>
      <div><span className="f">Process / poste</span> = {Object.entries(r.process.items).map(([k, v]) => `${k} ${num(v, 2)}`).join(' + ')} = <b>{money(r.process.total, 'USD', 2)}</b></div>
      <div><span className="f">Total / poste</span> = <b>{money(t.totalShift, 'USD', 2)}</b> ({money(t.perHour, 'USD', 2)}/h)</div>
      <div><span className="f">Prix de revient</span> = {r.mode === 'excel'
        ? `${num(t.totalShift, 2)} ÷ ${num(r.capacity.capacity)} × ${P.daily_efficiency}`
        : `${num(t.totalShift, 2)} ÷ (${num(r.capacity.capacity)} × ${P.daily_efficiency}) × (1 + ${t.scrap})`} = <b>{money(t.unitCost, 'USD', 6)}</b></div>
      <div><span className="f">Prix client</span> = {money(t.unitCost, 'USD', 6)} × {num(t.commercialFactor, 3)} + gabarit {product.jig_price || 0} × coef. couleur {product.color_coef || 1} = <b>{money(t.finalPrice, 'USD', 6)}</b></div>
      <div><span className="f">Quantité à produire</span> = {num(t.quantity)} × (1 + {t.scrap}) = {num(t.totalQty)} pcs · <span className="f">heures</span> = ⌈{num(t.totalQty)} ÷ {num(r.capacity.capacity)} × {P.shift_hours}⌉ = <b>{t.productionHours} h</b></div>
    </div>
  )
}

export default function Calculator() {
  const { params: P, profile, paramSet } = useApp()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [toast, setToast] = useToast()
  const loc = useLocation()
  const [product, setProduct] = useState(() => loc.state?.product || DEFAULT_PRODUCT)
  const [mode, setMode] = useState('excel')
  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)

  useEffect(() => {
    supabase.from('mc_clients').select('*').order('name').then(({ data }) => setClients(data || []))
    supabase.from('mc_products').select('*').order('reference').then(({ data }) => {
      setProducts(data || [])
      const pid = sp.get('product')
      if (pid && data) {
        const p = data.find((x) => x.id === pid)
        if (p) supabase.from('mc_clients').select('*').eq('id', p.client_id).maybeSingle().then(({ data: c }) => setProduct(productFromRow(p, c)))
      }
    })
  }, [sp])

  const set = (k) => (v) => { setSavedId(null); setProduct((p) => ({ ...p, [k]: v })) }
  const r = useMemo(() => computeCosting(product, P, mode), [product, P, mode])
  const rOther = useMemo(() => computeCosting(product, P, mode === 'excel' ? 'corrected' : 'excel'), [product, P, mode])
  const anomalies = useMemo(() => detectAnomalies(product, P, r), [product, P, r])
  const pieData = Object.entries(r.breakdown).map(([name, value]) => ({ name, value }))
  const t = r.totals

  const pickProduct = (id) => {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setSavedId(null)
    setProduct((cur) => ({ ...productFromRow(p, clients.find((c) => c.id === p.client_id)), quantity: cur.quantity, scrap: cur.scrap }))
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      product_id: product.product_id || null,
      client_id: product.client_id || clients.find((c) => c.name === product.client)?.id || null,
      parameter_set_id: paramSet.id,
      title: `${product.client} — ${product.reference}`,
      mode, engine_version: ENGINE_VERSION,
      inputs: product, params_snapshot: P, results: r,
      unit_cost: t.unitCost, final_price: t.finalPrice, quantity: t.quantity, currency: P.currency,
      created_by: profile.id,
    }
    const { data, error } = await supabase.from('mc_calculations').insert(payload).select('id').single()
    setSaving(false)
    if (error) { setToast(`Erreur : ${error.message}`); return null }
    setSavedId(data.id)
    await publishPost(profile.id, 'calculation',
      `Chiffrage ${product.client} / ${product.reference} — ${PROCESS_LABEL[product.process]}, ${num(t.quantity)} pcs (mode ${mode === 'excel' ? 'Excel' : 'corrigé'}).`,
      data.id, { client: product.client, reference: product.reference, process: PROCESS_LABEL[product.process], unit_cost: t.unitCost, final_price: t.finalPrice, quantity: t.quantity })
    setToast('Chiffrage enregistré et publié dans le fil ✔')
    return data.id
  }

  const createQuote = async () => {
    const calcId = savedId || (await save())
    if (!calcId) return
    const tiers = commercialTiers(t.finalPrice, P, product.client_type, product.color)
    const { data, error } = await supabase.from('mc_quotes').insert({
      client_id: product.client_id || clients.find((c) => c.name === product.client)?.id || null,
      calculation_id: calcId,
      title: `${product.client} — ${product.reference}`,
      currency: P.currency,
      lines: [{
        reference: product.reference,
        description: `${product.reference} ${product.material} — ${PROCESS_LABEL[product.process]} — ${COLOR_LABEL[product.color]}`,
        dimensions: product.shape === 'circular' ? `Ø ${product.d1} x H ${product.height} mm` : `${product.length} x ${product.width} x ${product.height} mm — diag. ${num(r.geometry.diagonal, 1)} mm`,
        prices: Object.fromEntries(tiers.map((x) => [x.key, Number(x.unit.toFixed(4))])),
      }],
      conditions: STANDARD_CONDITIONS, notes: LEGAL_NOTE, prepared_by: profile.id,
    }).select('id, number').single()
    if (error) { setToast(`Erreur : ${error.message}`); return }
    nav(`/devis/${data.id}`)
  }

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><CalcIcon size={24} style={{ verticalAlign: -3 }} /> Calculateur de coûts</h1>
        <div className="btn-row">
          <Seg value={mode} onChange={setMode} options={[['excel', 'Mode Excel (identique)'], ['corrected', 'Mode corrigé (proposé)']]} />
        </div>
      </div>
      <div className="card-sub" style={{ marginTop: -10, marginBottom: 12 }}>
        Paramètres : <b>{paramSet.name}</b>{paramSet.version ? ` v${paramSet.version}` : ''} · moteur {ENGINE_VERSION}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', alignItems: 'start' }}>
        {/* ------------------ SAISIE ------------------ */}
        <div>
          <div className="card">
            <div className="card-title">1. Identification de la pièce</div>
            <div className="grid g2">
              <Field label="Pièce existante">
                <select value={product.product_id || ''} onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">— Saisie libre —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{clients.find((c) => c.id === p.client_id)?.name} · {p.reference}</option>)}
                </select>
              </Field>
              <Field label="Client">
                <input list="clients" value={product.client} onChange={(e) => set('client')(e.target.value)} />
                <datalist id="clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </Field>
              <Field label="Référence / désignation"><input value={product.reference} onChange={(e) => set('reference')(e.target.value)} /></Field>
              <Field label="Matière">
                <select value={product.material} onChange={(e) => set('material')(e.target.value)}>
                  {['ABS', 'PP', 'PET', 'PETG', 'SAN', 'PMMA', 'ZAMAK'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Type de client">
                <Seg value={product.client_type} onChange={set('client_type')} options={[['known', 'Client connu'], ['new', 'Nouveau petit client']]} />
              </Field>
            </div>
          </div>

          <div className="card">
            <div className="card-title">2. Géométrie</div>
            <div style={{ marginBottom: 12 }}>
              <Seg value={product.shape} onChange={set('shape')} options={[['rectangular', 'Rectangulaire'], ['circular', 'Circulaire']]} />
            </div>
            {product.shape === 'rectangular' ? (
              <div className="grid g3">
                <Field label="Longueur (mm)"><NumInput value={product.length} onChange={set('length')} /></Field>
                <Field label="Largeur (mm)"><NumInput value={product.width} onChange={set('width')} /></Field>
                <Field label="Hauteur (mm)"><NumInput value={product.height} onChange={set('height')} /></Field>
              </div>
            ) : (
              <div className="grid g3">
                <Field label="Diamètre 1 (mm)"><NumInput value={product.d1} onChange={set('d1')} /></Field>
                <Field label="Diamètre 2 (mm)"><NumInput value={product.d2} onChange={set('d2')} /></Field>
                <Field label="Hauteur (mm)"><NumInput value={product.height} onChange={set('height')} /></Field>
              </div>
            )}
            <div className="card-sub" style={{ marginTop: 8 }}>
              Diagonale {num(r.geometry.diagonal, 1)} mm · Surface {num(r.geometry.surface, 0)} mm² · Coef. surface {num(r.geometry.surfaceCoef, 3)}
            </div>
          </div>

          <div className="card">
            <div className="card-title">3. Procédé & commande</div>
            <div className="grid g2">
              <Field label="Procédé">
                <select value={product.process} onChange={(e) => set('process')(e.target.value)}>
                  {Object.entries(PROCESS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              <Field label="Couleur">
                <select value={product.color} onChange={(e) => set('color')(e.target.value)}>
                  {Object.entries(COLOR_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              <Field label="Quantité demandée"><NumInput value={product.quantity} onChange={set('quantity')} /></Field>
              <Field label="Rebut (%)" hint={`Règle MYC pour cette diagonale : ${pct(r.suggestedScrap)}`}>
                <NumInput value={+(product.scrap * 100).toFixed(4)} onChange={(v) => set('scrap')(v / 100)} />
              </Field>
              <Field label="Nombre de sauts (poste)" hint={`Auto : ${r.geometry.autoJumps} (vide = auto)`}>
                <input value={product.jumps ?? ''} placeholder={String(r.geometry.autoJumps)}
                  onChange={(e) => set('jumps')(e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <Field label="Prix gabarit / jig ($/pièce)"><NumInput value={product.jig_price} onChange={set('jig_price')} /></Field>
              <Field label="Coef. couleur" hint="1 = standard ; 1,15 = spécial (accord DG)"><NumInput value={product.color_coef} onChange={set('color_coef')} /></Field>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-light" onClick={() => { setProduct(DEFAULT_PRODUCT); setSavedId(null) }}><RotateCcw size={16} /> Exemple PUPA</button>
            </div>
          </div>
        </div>

        {/* ------------------ RÉSULTATS ------------------ */}
        <div>
          <div className="card">
            <div className="card-title">Résultat — {product.client} · {product.reference}</div>
            <div className="kpis">
              <Kpi label="Prix de vente unitaire" value={money(t.finalPrice)} hero />
              <Kpi label="Prix de revient" value={money(t.unitCost)} />
              <Kpi label="Montant total HT" value={money(t.totalAmount, 'USD', 2)} />
              <Kpi label="Marge brute" value={money(t.grossMargin, 'USD', 2)} />
              <Kpi label="Capacité / poste" value={`${num(r.capacity.capacity)} pcs`} />
              <Kpi label="Heures de production" value={`${t.productionHours} h`} />
              <Kpi label="Qté à produire" value={num(t.totalQty)} />
              <Kpi label="Peinture / pièce" value={`${num(r.paint.consPerPiece, 2)} g`} />
            </div>
            <div className="card-sub" style={{ marginTop: 10 }}>
              {mode === 'excel' ? 'Mode corrigé' : 'Mode Excel'} : {money(rOther.totals.finalPrice)} / pièce
              ({rOther.totals.finalPrice >= t.finalPrice ? '+' : ''}{pct((rOther.totals.finalPrice - t.finalPrice) / (t.finalPrice || 1), 1)})
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !!savedId}><Save size={16} /> {savedId ? 'Enregistré' : 'Enregistrer & publier'}</button>
              <button className="btn btn-soft" onClick={createQuote}><FileText size={16} /> Générer le devis</button>
              <button className="btn btn-light" onClick={() => nav('/simulateur', { state: { product } })}>Simuler les quantités</button>
            </div>
          </div>

          <CadenceCard r={r} P={P} product={product} onCadence={set('cadence_per_hour')} />

          <div className="card">
            <div className="card-title"><Sparkles size={18} color="#a033ff" /> Contrôles automatiques</div>
            {anomalies.map((a, i) => (
              <div key={i} className={`alert ${a.level}`}><div><b>{a.title}</b>{a.text}</div></div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Répartition du prix de revient</div>
            <div style={{ height: 230 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v, 'USD', 5)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Détail du calcul (traçabilité)</div>
            <Trace r={r} P={P} product={product} />
          </div>
        </div>
      </div>
    </>
  )
}
