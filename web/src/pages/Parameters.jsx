import { useEffect, useState } from 'react'
import { SlidersHorizontal, Save, CheckCircle2, RotateCcw } from 'lucide-react'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { DEFAULT_PARAMS } from '../lib/defaults'
import { Field, NumInput, Seg, useToast } from '../components/ui'

const LBL = {
  spray_booth_filters: 'Filtres cabine', other_consumables: 'Autres consommables', tungsten_wire: 'Fil tungstène',
  aluminum_sheets: 'Feuilles aluminium', gun_cleaning_fluid: 'Nettoyant pistolet', filters: 'Filtres', oil_pipes: 'Tuyaux huile',
  amort_uv_vacuum: 'Amort. UV + vide ($/h)', amort_paint: 'Amort. peinture ($/h)', labor_per_worker: 'MOD par opérateur ($/h)',
  location: 'Location ($/h)', other_elec: 'Autres / électricité ($/h)',
  jumps: 'Sauts (défaut)', spacing_mm: 'Pas de chaîne (mm)', speed_m_min: 'Vitesse (m/min)', efficiency: 'Efficacité',
  steel_length: 'Longueur carré acier', square_steel_per_turntable: 'Carrés / plateau', turntables_per_machine: 'Plateaux / machine',
  machines: 'Nb machines', cycles_per_hour: 'Cycles / heure', hours: 'Heures',
}

function Group({ title, obj, onChange }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="grid g4">
        {Object.entries(obj).map(([k, v]) => (
          <Field key={k} label={LBL[k] || k}><NumInput value={v} onChange={(x) => onChange({ ...obj, [k]: x })} /></Field>
        ))}
      </div>
    </div>
  )
}

export default function Parameters() {
  const { params, paramSet, profile, reloadParams } = useApp()
  const [toast, setToast] = useToast()
  const [P, setP] = useState(params)
  const [versions, setVersions] = useState([])
  const [note, setNote] = useState('')

  useEffect(() => setP(params), [params])
  const loadVersions = () => supabase.from('mc_parameter_sets').select('id, name, version, is_active, notes, created_at, author:mc_profiles(full_name)')
    .order('version', { ascending: false }).then(({ data }) => setVersions(data || []))
  useEffect(() => { loadVersions() }, [])

  const up = (k) => (v) => setP((p) => ({ ...p, [k]: v }))
  const paintRow = (group, i, k, v) => setP((p) => {
    const arr = p.paint[group].map((x, j) => (j === i ? { ...x, [k]: v } : x))
    return { ...p, paint: { ...p.paint, [group]: arr } }
  })

  const saveVersion = async () => {
    const nextVersion = (versions[0]?.version || 0) + 1
    const { error: e1 } = await supabase.from('mc_parameter_sets').update({ is_active: false }).eq('is_active', true)
    if (e1) { setToast(e1.message); return }
    const { error } = await supabase.from('mc_parameter_sets').insert({
      name: 'Paramètres MYC TN', version: nextVersion, is_active: true, data: P, notes: note, created_by: profile.id, source: 'Application',
    })
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'parameters', `Nouvelle version des paramètres de métallisation : v${nextVersion}.${note ? `\n« ${note} »` : ''}`)
    setNote(''); setToast(`Version v${nextVersion} activée ✔`); reloadParams(); loadVersions()
  }
  const activate = async (id) => {
    await supabase.from('mc_parameter_sets').update({ is_active: false }).eq('is_active', true)
    const { error } = await supabase.from('mc_parameter_sets').update({ is_active: true }).eq('id', id)
    if (error) setToast(error.message); else { reloadParams(); loadVersions(); setToast('Version activée ✔') }
  }

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><SlidersHorizontal size={24} style={{ verticalAlign: -3 }} /> Paramètres de métallisation</h1>
        <div className="btn-row">
          <button className="btn btn-light" onClick={() => setP(DEFAULT_PARAMS)}><RotateCcw size={16} /> Valeurs Excel</button>
          <input className="input" placeholder="Note de version (ex. nouveau prix topcoat)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 280 }} />
          <button className="btn btn-primary" onClick={saveVersion}><Save size={16} /> Enregistrer nouvelle version</button>
        </div>
      </div>
      <div className="card-sub" style={{ marginTop: -10, marginBottom: 12 }}>Version active : <b>{paramSet.name} v{paramSet.version}</b>. Chaque modification crée une nouvelle version : les anciens calculs gardent leurs paramètres.</div>

      <div className="card">
        <div className="card-title">Général</div>
        <div className="grid g4">
          <Field label="Heures par poste"><NumInput value={P.shift_hours} onChange={up('shift_hours')} /></Field>
          <Field label="Efficacité journalière (S7)"><NumInput value={P.daily_efficiency} onChange={up('daily_efficiency')} /></Field>
          <Field label="Méthode de capacité">
            <Seg value={P.capacity_method} onChange={up('capacity_method')} options={[['pitch', 'PUPA (sauts+1)'], ['simple', 'BELOTTI']]} />
          </Field>
          <Field label="Devise"><input value={P.currency} onChange={(e) => up('currency')(e.target.value)} /></Field>
          <Field label="Opérateurs — vide"><NumInput value={P.workers.vacuum} onChange={(v) => up('workers')({ ...P.workers, vacuum: v })} /></Field>
          <Field label="Opérateurs — peinture"><NumInput value={P.workers.spray} onChange={(v) => up('workers')({ ...P.workers, spray: v })} /></Field>
          <Field label="Mode de prix">
            <Seg value={P.pricing_mode} onChange={up('pricing_mode')} options={[['coefficient', 'Coefficient'], ['margin', 'Marge %']]} />
          </Field>
          {P.pricing_mode === 'coefficient'
            ? <Field label="Coefficient (X7)"><NumInput value={P.coefficient} onChange={up('coefficient')} /></Field>
            : <Field label="Marge (0,8 = 80 %)"><NumInput value={P.margin} onChange={up('margin')} /></Field>}
        </div>
      </div>

      <Group title="Consommables par poste ($)" obj={P.consumables} onChange={up('consumables')} />
      <Group title="Coûts horaires" obj={P.hourly} onChange={up('hourly')} />
      <Group title="Chaîne métallisation sous vide" obj={P.lines.vacuum} onChange={(v) => up('lines')({ ...P.lines, vacuum: v })} />
      <Group title="Chaîne peinture / spray" obj={P.lines.spray} onChange={(v) => up('lines')({ ...P.lines, spray: v })} />
      <Group title="Machine de métallisation (capacité)" obj={P.vacuum_machine} onChange={up('vacuum_machine')} />

      <div className="card">
        <div className="card-title">Peinture</div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Produit</th><th className="num">Prix ($/kg)</th><th className="num">Conso (g/pièce réf.)</th></tr></thead>
            <tbody>
              {['base', 'pigments'].map((g) => P.paint[g].map((x, i) => (
                <tr key={g + i}>
                  <td>{x.name} {g === 'pigments' && <span className="pill brouillon">pigment</span>}</td>
                  <td className="num"><NumInput className="input" style={{ width: 110, textAlign: 'right' }} value={x.price} onChange={(v) => paintRow(g, i, 'price', v)} /></td>
                  <td className="num"><NumInput className="input" style={{ width: 110, textAlign: 'right' }} value={x.cons} onChange={(v) => paintRow(g, i, 'cons', v)} /></td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <div className="grid g3" style={{ marginTop: 12 }}>
          <Field label="Coefficient d'expédition"><NumInput value={P.paint.shipment_coef} onChange={(v) => up('paint')({ ...P.paint, shipment_coef: v })} /></Field>
          <Field label="Inclure le prix des pigments" hint="Excel : non (E19 × 0)">
            <Seg value={P.paint.include_pigments ? 'y' : 'n'} onChange={(v) => up('paint')({ ...P.paint, include_pigments: v === 'y' })} options={[['n', 'Non'], ['y', 'Oui']]} />
          </Field>
          <Field label="Coefficient de surface" hint="Conso × surface pièce / surface réf.">
            <Seg value={P.paint.use_surface_coef ? 'y' : 'n'} onChange={(v) => up('paint')({ ...P.paint, use_surface_coef: v === 'y' })} options={[['y', 'Oui'], ['n', 'Non']]} />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Surface de référence & rebut</div>
        <div className="grid g4">
          <Field label="Réf. diamètre 1 (mm)"><NumInput value={P.reference_surface.d1} onChange={(v) => up('reference_surface')({ ...P.reference_surface, d1: v })} /></Field>
          <Field label="Réf. diamètre 2 (mm)"><NumInput value={P.reference_surface.d2} onChange={(v) => up('reference_surface')({ ...P.reference_surface, d2: v })} /></Field>
          <Field label="Réf. hauteur (mm)"><NumInput value={P.reference_surface.h} onChange={(v) => up('reference_surface')({ ...P.reference_surface, h: v })} /></Field>
          <Field label="Seuil diamètre rebut (mm)"><NumInput value={P.scrap_rule.threshold_mm} onChange={(v) => up('scrap_rule')({ ...P.scrap_rule, threshold_mm: v })} /></Field>
          <Field label="Rebut si < seuil"><NumInput value={P.scrap_rule.below} onChange={(v) => up('scrap_rule')({ ...P.scrap_rule, below: v })} /></Field>
          <Field label="Rebut si ≥ seuil"><NumInput value={P.scrap_rule.above} onChange={(v) => up('scrap_rule')({ ...P.scrap_rule, above: v })} /></Field>
          <Field label="Facteur CN → TN"><NumInput value={P.cn_to_tn_factor} onChange={up('cn_to_tn_factor')} /></Field>
          <Field label="Frais handling ($) si qté < 25K"><NumInput value={P.handling_cost.amount} onChange={(v) => up('handling_cost')({ ...P.handling_cost, amount: v })} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Coefficients commerciaux (× X)</div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Catégorie</th>{P.tiers.map((t) => <th key={t.key} className="num">{t.key}</th>)}</tr></thead>
            <tbody>
              {Object.entries(P.commercial_grid).map(([k, arr]) => (
                <tr key={k}><td>{k.replace('_', ' — ')}</td>
                  {arr.map((c, i) => (
                    <td key={i} className="num"><NumInput className="input" style={{ width: 80, textAlign: 'right' }} value={c}
                      onChange={(v) => up('commercial_grid')({ ...P.commercial_grid, [k]: arr.map((x, j) => (j === i ? v : x)) })} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Historique des versions</div>
        <table className="t">
          <thead><tr><th>Version</th><th>Nom</th><th>Note</th><th>Auteur</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td><b>v{v.version}</b></td><td>{v.name}</td><td>{v.notes}</td><td>{v.author?.full_name || '—'}</td>
                <td>{new Date(v.created_at).toLocaleString('fr-FR')}</td>
                <td>{v.is_active ? <span className="pill valide"><CheckCircle2 size={12} /> Active</span>
                  : <button className="btn btn-light" onClick={() => activate(v.id)}>Activer</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
