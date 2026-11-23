import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, RotateCcw, Save, Calculator, Gauge, Ruler, Layers, RefreshCw, Image as ImageIcon, CheckCircle2, AlertTriangle, Info, CircleDot } from 'lucide-react'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { computeCosting, commercialTiers } from '../lib/engine'
import { EXCEL_PIECES, SHAPES, STYLES, FINISHES, FIXTURE_PHOTOS, pieceToProduct } from '../lib/pieces'
import { conditionsFor } from '../lib/conditions'
import CadenceCard from '../components/CadenceCard'
import ColorPicker from '../components/ColorPicker'
import { usePaintCatalog, applyColor } from '../lib/usePaintCatalog'
import { Field, NumInput, Seg, useToast } from '../components/ui'
import { money, num, pct } from '../lib/format'

const Piece3D = lazy(() => import('../components/Piece3D'))
const ICON = { applies: Info, ok: CheckCircle2, warn: AlertTriangle, info: CircleDot }
const LIMITS = { L: [10, 250], W: [10, 250], H: [1, 60] }

function DimSlider({ label, value, onChange, min, max, step = 0.1 }) {
  return (
    <div className="lever">
      <div className="lever-top"><span>{label}</span>
        <NumInput className="input dim-input" value={value} onChange={(v) => onChange(Math.min(max, Math.max(min, v)))} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export default function Pieces3D() {
  const { params: P, profile, theme } = useApp()
  const nav = useNavigate()
  const [toast, setToast] = useToast()
  const [dbPieces, setDbPieces] = useState([])
  const [sp] = useSearchParams()
  const initial = EXCEL_PIECES.find((p) => p.id === sp.get('piece')) || EXCEL_PIECES[0]
  const [selId, setSelId] = useState(initial.id)
  const [dims, setDims] = useState(() => ({ ...initial }))
  const [quantity, setQuantity] = useState(50000)
  const [clientType, setClientType] = useState('known')
  const [useReal, setUseReal] = useState(false)
  const [cadence, setCadence] = useState(null)
  const paintCat = usePaintCatalog()
  const [colorSel, setColorSel] = useState(null)
  const [view, setView] = useState('3d')
  const [exploded, setExploded] = useState(false)
  const [showDims, setShowDims] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [area3d, setArea3d] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    supabase.from('mc_products').select('*, client:mc_clients(name)').not('model3d', 'is', null).then(({ data }) => {
      setDbPieces((data || []).map((p) => ({ ...p.model3d, id: `db-${p.id}`, dbId: p.id, reference: p.reference, client: p.client?.name || '', sheet: 'Base produits', photos: [], color: p.color, process: p.process })))
    })
  }, [])

  const all = useMemo(() => [...EXCEL_PIECES, ...dbPieces.filter((d) => !EXCEL_PIECES.some((e) => e.reference === d.reference && e.client === d.client))], [dbPieces])
  const piece = all.find((p) => p.id === selId) || EXCEL_PIECES[0]
  const select = (p) => { setSelId(p.id); setDims({ ...p }); setView('3d'); setExploded(false); setArea3d(null) }
  const setDim = (k) => (v) => setDims((d) => (d.shape === 'round' && (k === 'L' || k === 'W') ? { ...d, L: v, W: v } : { ...d, [k]: v }))
  const onStats = useCallback((s) => setArea3d(s.area), [])

  const product = useMemo(() => {
    const base = pieceToProduct(dims, { quantity, client_type: clientType, cadence_per_hour: cadence })
    const diag = base.shape === 'circular' ? Math.max(dims.L, dims.W) : Math.hypot(dims.L, dims.W)
    base.scrap = diag < P.scrap_rule.threshold_mm ? P.scrap_rule.below : P.scrap_rule.above
    if (useReal && area3d) base.surface_override = area3d
    return colorSel ? applyColor(base, colorSel, paintCat.colorToPaint) : base
  }, [dims, quantity, clientType, useReal, area3d, P, cadence, colorSel, paintCat.colorToPaint])
  const r = useMemo(() => computeCosting(product, P, 'excel'), [product, P])
  const r50 = useMemo(() => computeCosting({ ...product, quantity: 50000 }, P, 'excel'), [product, P])
  const tiers = commercialTiers(r50.totals.finalPrice, P, clientType, product.color)
  const conds = conditionsFor(piece, product, r, P, quantity)
  const excelRef = piece.excel?.quoted50k ?? piece.excel?.tiers?.['50K'] ?? piece.excel?.computed?.finalPrice
  const changed = ['L', 'W', 'H', 'shape', 'style', 'finish'].some((k) => dims[k] !== piece[k])
  const formulaSurface = useMemo(() => computeCosting({ ...product, surface_override: 0 }, P, 'excel').geometry.surface, [product, P])

  const save = async () => {
    let { data: client } = await supabase.from('mc_clients').select('id').eq('name', dims.client).maybeSingle()
    if (!client) {
      const ins = await supabase.from('mc_clients').insert({ name: dims.client || 'SANS CLIENT', client_type: clientType }).select('id').single()
      if (ins.error) { setToast(ins.error.message); return }
      client = ins.data
    }
    const row = {
      client_id: client.id, reference: dims.reference, designation: dims.decoration || '', material: 'ABS',
      shape: product.shape, length_mm: dims.L, width_mm: dims.W, height_mm: dims.H, d1_mm: product.d1, d2_mm: product.d2,
      process: product.process, color: product.color, finish: FINISHES[dims.finish]?.label || '',
      model3d: { shape: dims.shape, style: dims.style, finish: dims.finish, L: dims.L, W: dims.W, H: dims.H, decoration: dims.decoration || '' },
      created_by: profile.id,
    }
    const { error } = await supabase.from('mc_products').upsert(row, { onConflict: 'client_id,reference' })
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'status', `📐 Pièce ${dims.reference} (${dims.client}) enregistrée en 3D : ${num(dims.L, 2)} × ${num(dims.W, 2)} × H ${num(dims.H, 2)} mm, ${SHAPES[dims.shape].toLowerCase()}.`)
    setToast('Pièce et dimensions enregistrées dans la base produits ✔')
  }

  const list = all.filter((p) => !filter || `${p.reference} ${p.client}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><Box size={22} /> Pièces 3D</h1>
        <div className="btn-row">
          <button className="btn btn-light" onClick={() => nav('/analyse', { state: { product } })}><Gauge size={15} /> Analyse what-if</button>
          <button className="btn btn-soft" onClick={() => nav('/calculateur', { state: { product } })}><Calculator size={15} /> Ouvrir dans le calculateur</button>
          <button className="btn btn-primary" onClick={save}><Save size={15} /> Enregistrer la pièce</button>
        </div>
      </div>

      <div className="dash">
        {/* ---- Liste des pièces ---- */}
        <div className="card span-3 piece-list" style={{ alignSelf: 'start' }}>
          <div className="card-title">Pièces des fichiers Excel <span className="pill brouillon">{all.length}</span></div>
          <input className="input" placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 10 }} />
          <div className="piece-scroll">
            {list.map((p) => (
              <button key={p.id} className={`piece-item ${p.id === selId ? 'on' : ''}`} onClick={() => select(p)}>
                <span className="piece-thumb">{p.photos?.[0] ? <img src={`/pieces/${p.photos[0]}`} alt="" /> : <Box size={20} />}</span>
                <span style={{ minWidth: 0 }}>
                  <b>{p.reference}</b>
                  <small>{p.client} · {SHAPES[p.shape]} · {num(p.L, 1)}{p.shape === 'round' ? '' : ` × ${num(p.W, 1)}`} × H {num(p.H, 1)}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Visionneuse ---- */}
        <div className="card span-6" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
          <div className="viewer-bar">
            <div>
              <b>{dims.reference}</b> <span className="card-sub">· {dims.client} · {piece.sheet}</span>
              {changed && <span className="pill soumis" style={{ marginInlineStart: 8 }}>modifiée</span>}
            </div>
            <Seg value={view} onChange={setView} options={[['3d', '3D'], ['photos', 'Photos Excel']]} />
          </div>
          <div className="viewer">
            {view === '3d' ? (
              <Suspense fallback={<div className="empty">Chargement de la 3D…</div>}>
                <Piece3D piece={dims} finish={colorSel ? { color: colorSel.hex, metal: colorSel.metallic ? 0.85 : 0.05, rough: colorSel.metallic ? 0.2 : 0.45 } : dims.finish} exploded={exploded} showDims={showDims} autoRotate={autoRotate} onStats={onStats} dark={theme === 'dark'} />
              </Suspense>
            ) : (
              <div className="photo-grid">
                {(piece.photos || []).map((f) => <img key={f} src={`/pieces/${f}`} alt={piece.reference} />)}
                {piece.id.startsWith('17700') && FIXTURE_PHOTOS.map((f) => <img key={f} src={`/pieces/${f}`} alt="Gabarit" />)}
                {!piece.photos?.length && <div className="empty">Pas de photo dans le fichier Excel pour cette pièce.</div>}
              </div>
            )}
          </div>
          {view === '3d' && (
            <div className="viewer-tools">
              <div className="swatches">
                {Object.entries(FINISHES).map(([k, f]) => (
                  <button key={k} title={f.label} className={`swatch ${dims.finish === k ? 'on' : ''}`} style={{ background: f.metal ? `linear-gradient(135deg, #fff 0%, ${f.color} 45%, #333 120%)` : f.color }} onClick={() => setDims({ ...dims, finish: k })} />
                ))}
              </div>
              <div className="btn-row">
                <button className={`btn ${showDims ? 'btn-soft' : 'btn-light'}`} onClick={() => setShowDims(!showDims)}><Ruler size={14} /> Cotes</button>
                {dims.style === 'compact' && <button className={`btn ${exploded ? 'btn-soft' : 'btn-light'}`} onClick={() => setExploded(!exploded)}><Layers size={14} /> Ouvrir</button>}
                <button className={`btn ${autoRotate ? 'btn-soft' : 'btn-light'}`} onClick={() => setAutoRotate(!autoRotate)}><RefreshCw size={14} /> Rotation</button>
              </div>
            </div>
          )}
          <div className="card-sub" style={{ padding: '0 16px 14px' }}>Faites tourner la pièce à la souris, molette pour zoomer. Finition : {FINISHES[dims.finish]?.label}.</div>
        </div>

        {/* ---- Dimensions ---- */}
        <div className="card span-3" style={{ alignSelf: 'start' }}>
          <div className="card-title"><Ruler size={16} /> Dimensions <span className="spacer" />
            <button className="btn btn-light" onClick={() => setDims({ ...piece })} title="Revenir aux dimensions Excel"><RotateCcw size={14} /> Excel</button>
          </div>
          <div className="grid">
            <Field label="Forme">
              <select value={dims.shape} onChange={(e) => setDims({ ...dims, shape: e.target.value, ...(e.target.value === 'round' ? { W: dims.L } : {}) })}>
                {Object.entries(SHAPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={dims.style} onChange={(e) => setDims({ ...dims, style: e.target.value })}>
                {Object.entries(STYLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </div>
          {dims.shape === 'round'
            ? <DimSlider label="Diamètre (mm)" value={dims.L} onChange={setDim('L')} min={LIMITS.L[0]} max={LIMITS.L[1]} />
            : <>
                <DimSlider label="Longueur (mm)" value={dims.L} onChange={setDim('L')} min={LIMITS.L[0]} max={LIMITS.L[1]} />
                <DimSlider label="Largeur (mm)" value={dims.W} onChange={setDim('W')} min={LIMITS.W[0]} max={LIMITS.W[1]} />
              </>}
          <DimSlider label="Hauteur (mm)" value={dims.H} onChange={setDim('H')} min={LIMITS.H[0]} max={LIMITS.H[1]} step={0.05} />
          <div className="grid g2" style={{ marginTop: 10 }}>
            <Field label="Quantité"><NumInput value={quantity} onChange={(v) => setQuantity(Math.max(1, Math.round(v)))} /></Field>
            <Field label="Client"><Seg value={clientType} onChange={setClientType} options={[['known', 'Connu'], ['new', 'Nouveau']]} /></Field>
          </div>
          <Field label="Couleur (grille commerciale)"><Seg value={colorSel ? colorSel.family : (dims.color || 'standard')} onChange={(v) => { setColorSel(null); setDims({ ...dims, color: v }) }} options={[['standard', 'Standard'], ['special', 'Spéciale']]} /></Field>
          <div style={{ marginTop: 10 }}><ColorPicker colors={paintCat.colors} value={colorSel?.id} onChange={setColorSel} /></div>
          <label className="check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={useReal} onChange={(e) => setUseReal(e.target.checked)} />
            Calculer la peinture avec la surface 3D réelle
          </label>
        </div>

        {/* ---- Résultats ---- */}
        <div className="card span-12">
          <div className="card-title">Résultat pour {dims.reference} — {num(quantity)} pièces</div>
          <div className="kpis">
            <div className="kpi hero"><div className="k-label">Prix de vente (50K)</div><div className="k-value">{money(r50.totals.finalPrice)}</div>
              {excelRef != null && <div className="k-delta" style={{ color: '#d6e6fa' }}>Excel : {money(excelRef)} ({r50.totals.finalPrice >= excelRef ? '+' : ''}{pct((r50.totals.finalPrice - excelRef) / excelRef, 1)})</div>}</div>
            <div className="kpi"><div className="k-label">Prix pour {num(quantity)} pcs</div><div className="k-value">{money(tiers.reduce((acc, t) => (quantity >= t.qty ? t : acc), tiers[0]).unit)}</div></div>
            <div className="kpi"><div className="k-label">Prix de revient</div><div className="k-value">{money(r.totals.unitCost)}</div></div>
            <div className="kpi"><div className="k-label">Cadence / heure</div><div className="k-value">{num(r.capacity.cadence.effective, 0)} pcs</div></div>
            <div className="kpi"><div className="k-label">Capacité / poste</div><div className="k-value">{num(r.capacity.capacity)}</div></div>
            <div className="kpi"><div className="k-label">Heures de prod.</div><div className="k-value">{r.totals.productionHours} h</div></div>
            <div className="kpi"><div className="k-label">Surface (formule Excel)</div><div className="k-value">{num(formulaSurface / 100, 1)} cm²</div></div>
            <div className="kpi"><div className="k-label">Surface 3D réelle</div><div className="k-value">{area3d ? `${num(area3d / 100, 1)} cm²` : '—'}</div></div>
            <div className="kpi"><div className="k-label">Peinture / pièce</div><div className="k-value">{num(r.paint.consPerPiece, 2)} g</div></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="t">
              <thead><tr><th>Palier</th>{tiers.map((t) => <th key={t.key} className="num">{t.key}</th>)}</tr></thead>
              <tbody>
                <tr><td><b>Prix calculé</b></td>{tiers.map((t) => <td key={t.key} className="num"><b>{money(t.unit)}</b></td>)}</tr>
                {piece.excel?.tiers && <tr><td>Prix dans Excel</td>{tiers.map((t) => <td key={t.key} className="num">{piece.excel.tiers[t.key] != null ? money(piece.excel.tiers[t.key]) : '—'}</td>)}</tr>}
                {piece.excel?.cn != null && <tr><td>Prix Chine (CN)</td><td className="num" colSpan={tiers.length}>{money(piece.excel.cn)} → × {P.cn_to_tn_factor} = {money(piece.excel.cn * P.cn_to_tn_factor)} (prix TN 50K équivalent)</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="span-12"><CadenceCard r={r} P={P} product={product} onCadence={setCadence} /></div>

        {/* ---- Conditions ---- */}
        <div className="card span-12">
          <div className="card-title">Conditions applicables</div>
          <div className="cond-grid">
            {['Production', 'Commercial', 'Pièce'].map((g) => {
              const items = conds.filter((c) => c.group === g)
              if (!items.length) return null
              return (
                <div key={g}>
                  <div className="sb-section" style={{ color: 'var(--muted)', padding: '0 0 8px' }}>{g}</div>
                  {items.map((c, i) => {
                    const I = ICON[c.status]
                    return (
                      <div key={i} className={`cond ${c.status}`}>
                        <I size={16} />
                        <div><b>{c.title}</b><span>{c.text}</span></div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="card-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ImageIcon size={13} /> Modèles 3D générés à partir des cotes et des plans des fichiers Excel (formes simplifiées, pas un fichier CAO).</div>
    </>
  )
}
