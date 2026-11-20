import { useEffect, useState } from 'react'
import { FlaskConical, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Field, NumInput, Kpi, useToast } from '../components/ui'
import { money, num, pct } from '../lib/format'

const EMPTY = { client_id: '', reference: '', decoration: '', material: 'ABS', dimensions: '', received_qty: 0, ok_qty: 0, nok_qty: 0, unit_price: 0, trial_date: '', control_date: '', notes: '' }

export default function Samples() {
  const { profile, canApprove } = useApp()
  const [toast, setToast] = useToast()
  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(null)
  const [basis, setBasis] = useState('received')

  const load = () => supabase.from('mc_samples').select('*, client:mc_clients(name)').order('created_at').then(({ data }) => setRows(data || []))
  useEffect(() => { load(); supabase.from('mc_clients').select('id, name').then(({ data }) => setClients(data || [])) }, [])

  const save = async () => {
    const { id, client, ...row } = form
    row.trial_date = row.trial_date || null; row.control_date = row.control_date || null; row.client_id = row.client_id || null
    const res = id ? await supabase.from('mc_samples').update(row).eq('id', id) : await supabase.from('mc_samples').insert({ ...row, created_by: profile.id })
    if (res.error) { setToast(res.error.message); return }
    const gap = row.received_qty - row.ok_qty - row.nok_qty
    await publishPost(profile.id, gap ? 'alert' : 'sample',
      `Essai ${row.reference} : ${row.received_qty} reçus, ${row.ok_qty} OK, ${row.nok_qty} non OK${gap ? ` — ⚠ écart de ${gap} pièce(s) non expliqué` : ''}.`)
    setForm(null); setToast('Enregistré ✔'); load()
  }
  const del = async (id) => { if (confirm('Supprimer ?')) { await supabase.from('mc_samples').delete().eq('id', id); load() } }

  const qtyFor = (r) => (basis === 'received' ? r.received_qty : r.ok_qty)
  const tot = rows.reduce((a, r) => ({
    rec: a.rec + r.received_qty, ok: a.ok + r.ok_qty, nok: a.nok + r.nok_qty,
    amount: a.amount + qtyFor(r) * Number(r.unit_price),
  }), { rec: 0, ok: 0, nok: 0, amount: 0 })
  const gapTotal = tot.rec - tot.ok - tot.nok

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><FlaskConical size={24} style={{ verticalAlign: -3 }} /> Échantillons & essais</h1>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={16} /> Nouvel essai</button>
      </div>

      <div className="card">
        <div className="kpis">
          <Kpi label="Reçus" value={num(tot.rec)} />
          <Kpi label="OK / approuvés" value={num(tot.ok)} />
          <Kpi label="Non OK" value={num(tot.nok)} />
          <Kpi label="Écart non expliqué" value={num(gapTotal)} />
          <Kpi label="Taux OK" value={pct(tot.rec ? tot.ok / tot.rec : 0, 1)} />
          <Kpi label="Montant échantillons" value={money(tot.amount, 'USD', 2)} hero />
        </div>
        <div className="btn-row" style={{ marginTop: 12, alignItems: 'center' }}>
          <span className="card-sub">Facturer sur :</span>
          <div className="seg">
            <button className={basis === 'received' ? 'on' : ''} onClick={() => setBasis('received')}>Quantités reçues (Excel)</button>
            <button className={basis === 'ok' ? 'on' : ''} onClick={() => setBasis('ok')}>Quantités approuvées</button>
          </div>
        </div>
        {basis === 'received' && <div className="alert info" style={{ marginTop: 12 }}><div><b>À confirmer avec Slah</b>La feuille RFQ indique « TOTAL PRICE FOR APPROVED SAMPLES » mais multiplie le prix par la quantité <i>reçue</i> (534,816 $).</div></div>}
      </div>

      {form && (
        <div className="card">
          <div className="card-title">{form.id ? 'Modifier' : 'Nouvel'} essai</div>
          <div className="grid g4">
            <Field label="Client"><select value={form.client_id || ''} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Référence"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
            <Field label="Décoration"><input value={form.decoration} onChange={(e) => setForm({ ...form, decoration: e.target.value })} /></Field>
            <Field label="Dimensions"><input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} /></Field>
            <Field label="Qté reçue"><NumInput value={form.received_qty} onChange={(v) => setForm({ ...form, received_qty: Math.round(v) })} /></Field>
            <Field label="Qté OK"><NumInput value={form.ok_qty} onChange={(v) => setForm({ ...form, ok_qty: Math.round(v) })} /></Field>
            <Field label="Qté non OK"><NumInput value={form.nok_qty} onChange={(v) => setForm({ ...form, nok_qty: Math.round(v) })} /></Field>
            <Field label="Prix unitaire ($)"><NumInput value={form.unit_price} onChange={(v) => setForm({ ...form, unit_price: v })} /></Field>
            <Field label="Date essai"><input type="date" value={form.trial_date || ''} onChange={(e) => setForm({ ...form, trial_date: e.target.value })} /></Field>
            <Field label="Date contrôle qualité"><input type="date" value={form.control_date || ''} onChange={(e) => setForm({ ...form, control_date: e.target.value })} /></Field>
            <Field label="Notes"><input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          {form.received_qty !== form.ok_qty + form.nok_qty && <div className="alert warning" style={{ marginTop: 12 }}><div><b>Écart</b>{form.received_qty - form.ok_qty - form.nok_qty} pièce(s) ni OK ni non OK.</div></div>}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            <button className="btn btn-light" onClick={() => setForm(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Client</th><th>Référence</th><th>Décoration</th><th className="num">Reçus</th><th className="num">OK</th><th className="num">Non OK</th><th className="num">Écart</th><th className="num">Taux OK</th><th className="num">Prix</th><th className="num">Montant</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const gap = r.received_qty - r.ok_qty - r.nok_qty
                return (
                  <tr key={r.id}>
                    <td>{r.client?.name}</td>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); setForm(r) }}><b>{r.reference}</b></a></td>
                    <td>{r.decoration}</td>
                    <td className="num">{r.received_qty}</td><td className="num">{r.ok_qty}</td><td className="num">{r.nok_qty}</td>
                    <td className="num" style={{ color: gap ? 'var(--red)' : undefined, fontWeight: gap ? 700 : 400 }}>{gap ? <><AlertTriangle size={12} /> {gap}</> : 0}</td>
                    <td className="num">{pct(r.received_qty ? r.ok_qty / r.received_qty : 0, 1)}</td>
                    <td className="num">{money(r.unit_price)}</td>
                    <td className="num">{money(qtyFor(r) * r.unit_price, 'USD', 2)}</td>
                    <td>{canApprove && <button className="btn btn-danger" onClick={() => del(r.id)}><Trash2 size={14} /></button>}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={11} className="empty">Aucun essai</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
