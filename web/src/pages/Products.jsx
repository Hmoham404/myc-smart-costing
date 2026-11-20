import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package, Plus, Calculator, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Field, NumInput, useToast } from '../components/ui'
import { PROCESS_LABEL, SHAPE_LABEL } from '../lib/defaults'

const EMPTY = { client_id: '', reference: '', designation: '', material: 'ABS', shape: 'rectangular', length_mm: 0, width_mm: 0, height_mm: 0, d1_mm: 0, d2_mm: 0, process: 'vacuum', color: 'standard', finish: '' }

export default function Products() {
  const { profile, canApprove } = useApp()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [toast, setToast] = useToast()
  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(null)
  const [newClient, setNewClient] = useState({ name: '', client_type: 'known', brand: '', country: '' })
  const [q, setQ] = useState(sp.get('q') || '')

  const load = async () => {
    const [c, p] = await Promise.all([
      supabase.from('mc_clients').select('*').order('name'),
      supabase.from('mc_products').select('*, client:mc_clients(name)').order('created_at', { ascending: false }),
    ])
    setClients(c.data || []); setProducts(p.data || [])
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setQ(sp.get('q') || '') }, [sp])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const saveProduct = async () => {
    if (!form.reference || !form.client_id) { setToast('Client et référence obligatoires'); return }
    const { id, client, ...row } = form
    const res = id ? await supabase.from('mc_products').update(row).eq('id', id)
      : await supabase.from('mc_products').insert({ ...row, created_by: profile.id })
    if (res.error) { setToast(res.error.message); return }
    setForm(null); setToast('Pièce enregistrée ✔'); load()
  }
  const addClient = async () => {
    if (!newClient.name) return
    const { error } = await supabase.from('mc_clients').insert(newClient)
    if (error) { setToast(error.message); return }
    setNewClient({ name: '', client_type: 'known', brand: '', country: '' }); load()
  }
  const del = async (id) => {
    if (!confirm('Supprimer cette pièce ?')) return
    const { error } = await supabase.from('mc_products').delete().eq('id', id)
    if (error) setToast(error.message); else load()
  }

  const filtered = products.filter((p) => !q || `${p.reference} ${p.designation} ${p.client?.name}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><Package size={24} style={{ verticalAlign: -3 }} /> Base produits</h1>
        <div className="btn-row">
          <input className="input" placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY, client_id: clients[0]?.id || '' })}><Plus size={16} /> Nouvelle pièce</button>
        </div>
      </div>

      {form && (
        <div className="card">
          <div className="card-title">{form.id ? 'Modifier la pièce' : 'Nouvelle pièce'}</div>
          <div className="grid g4">
            <Field label="Client">
              <select value={form.client_id || ''} onChange={(e) => set('client_id')(e.target.value)}>
                <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Référence"><input value={form.reference} onChange={(e) => set('reference')(e.target.value)} /></Field>
            <Field label="Désignation"><input value={form.designation || ''} onChange={(e) => set('designation')(e.target.value)} /></Field>
            <Field label="Matière"><input value={form.material || ''} onChange={(e) => set('material')(e.target.value)} /></Field>
            <Field label="Forme">
              <select value={form.shape} onChange={(e) => set('shape')(e.target.value)}>
                {Object.entries(SHAPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {form.shape === 'rectangular' ? (
              <>
                <Field label="Longueur (mm)"><NumInput value={form.length_mm} onChange={set('length_mm')} /></Field>
                <Field label="Largeur (mm)"><NumInput value={form.width_mm} onChange={set('width_mm')} /></Field>
              </>
            ) : (
              <>
                <Field label="Diamètre 1 (mm)"><NumInput value={form.d1_mm} onChange={set('d1_mm')} /></Field>
                <Field label="Diamètre 2 (mm)"><NumInput value={form.d2_mm} onChange={set('d2_mm')} /></Field>
              </>
            )}
            <Field label="Hauteur (mm)"><NumInput value={form.height_mm} onChange={set('height_mm')} /></Field>
            <Field label="Procédé">
              <select value={form.process} onChange={(e) => set('process')(e.target.value)}>
                {Object.entries(PROCESS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Couleur">
              <select value={form.color} onChange={(e) => set('color')(e.target.value)}>
                <option value="standard">Standard (Or / Argent)</option><option value="special">Spéciale</option>
              </select>
            </Field>
            <Field label="Finition"><input value={form.finish || ''} onChange={(e) => set('finish')(e.target.value)} placeholder="Shiny Silver…" /></Field>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={saveProduct}>Enregistrer</button>
            <button className="btn btn-light" onClick={() => setForm(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Client</th><th>Référence</th><th>Désignation</th><th>Matière</th><th>Dimensions</th><th>Procédé</th><th>Couleur</th><th></th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.client?.name}</td>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); setForm(p) }}><b>{p.reference}</b></a></td>
                  <td>{p.designation}</td><td>{p.material}</td>
                  <td>{p.shape === 'circular' ? `Ø${p.d1_mm} × H${p.height_mm}` : `${p.length_mm} × ${p.width_mm} × ${p.height_mm}`}</td>
                  <td>{PROCESS_LABEL[p.process]}</td><td>{p.color === 'special' ? 'Spéciale' : 'Standard'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-soft" onClick={() => nav(`/calculateur?product=${p.id}`)}><Calculator size={14} /> Chiffrer</button>{' '}
                    {canApprove && <button className="btn btn-danger" onClick={() => del(p.id)}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="empty">Aucune pièce</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><UserPlus size={18} /> Clients</div>
        <div className="grid g4" style={{ alignItems: 'end' }}>
          <Field label="Nom"><input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
          <Field label="Type">
            <select value={newClient.client_type} onChange={(e) => setNewClient({ ...newClient, client_type: e.target.value })}>
              <option value="known">Client connu</option><option value="new">Nouveau petit client</option>
            </select>
          </Field>
          <Field label="Marque"><input value={newClient.brand} onChange={(e) => setNewClient({ ...newClient, brand: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={addClient}><Plus size={16} /> Ajouter</button>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          {clients.map((c) => <span key={c.id} className="pill envoye">{c.name}{c.brand ? ` · ${c.brand}` : ''} · {c.client_type === 'new' ? 'nouveau' : 'connu'}</span>)}
        </div>
      </div>
    </>
  )
}
