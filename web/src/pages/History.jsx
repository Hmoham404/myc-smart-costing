import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { History as HistoryIcon, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Trace } from './Calculator'
import { money, num } from '../lib/format'

export default function History() {
  const { canApprove } = useApp()
  const [sp, setSp] = useSearchParams()
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(null)

  const load = () => supabase.from('mc_calculations').select('*, author:mc_profiles(full_name)').order('created_at', { ascending: false }).limit(100)
    .then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  useEffect(() => { const id = sp.get('id'); if (id && rows.length) setOpen(rows.find((r) => r.id === id) || null) }, [sp, rows])

  const del = async (id) => { if (confirm('Supprimer ce calcul ?')) { await supabase.from('mc_calculations').delete().eq('id', id); setOpen(null); load() } }

  return (
    <>
      <div className="page-header"><h1><HistoryIcon size={24} style={{ verticalAlign: -3 }} /> Historique des calculs</h1></div>
      {open && (
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span>{open.title} — {new Date(open.created_at).toLocaleString('fr-FR')}</span>
            <span className="btn-row">
              {canApprove && <button className="btn btn-danger" onClick={() => del(open.id)}><Trash2 size={14} /></button>}
              <button className="btn btn-light" onClick={() => { setOpen(null); setSp({}) }}>Fermer</button>
            </span>
          </div>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            Auteur : {open.author?.full_name} · mode {open.mode} · moteur {open.engine_version} · paramètres figés au moment du calcul
          </div>
          <Trace r={open.results} P={open.params_snapshot} product={open.inputs} />
        </div>
      )}
      <div className="card">
        <table className="t">
          <thead><tr><th>Date</th><th>Chiffrage</th><th>Auteur</th><th>Mode</th><th className="num">Qté</th><th className="num">Revient</th><th className="num">Prix vente</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
                <td>{new Date(r.created_at).toLocaleString('fr-FR')}</td><td><b>{r.title}</b></td><td>{r.author?.full_name}</td>
                <td>{r.mode === 'excel' ? 'Excel' : 'Corrigé'}</td><td className="num">{num(r.quantity)}</td>
                <td className="num">{money(r.unit_cost)}</td><td className="num"><b>{money(r.final_price)}</b></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="empty">Aucun calcul enregistré</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
