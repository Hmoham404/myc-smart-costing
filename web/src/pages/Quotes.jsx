import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { STANDARD_CONDITIONS, LEGAL_NOTE } from '../lib/defaults'
import { STATUS_LABEL } from '../lib/format'

export default function Quotes() {
  const { profile } = useApp()
  const nav = useNavigate()
  const [quotes, setQuotes] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('mc_quotes').select('*, client:mc_clients(name), preparer:mc_profiles!mc_quotes_prepared_by_fkey(full_name)')
      .order('created_at', { ascending: false }).then(({ data }) => setQuotes(data || []))
  }, [])

  const blank = async () => {
    const { data, error } = await supabase.from('mc_quotes').insert({
      title: 'Nouveau devis', lines: [{ reference: '', description: '', dimensions: '', prices: { '5K': 0, '10K': 0, '25K': 0, '50K': 0, '100K+': 0 } }],
      conditions: STANDARD_CONDITIONS, notes: LEGAL_NOTE, prepared_by: profile.id,
    }).select('id').single()
    if (!error) nav(`/devis/${data.id}`)
    else alert(error.message)
  }

  const list = quotes.filter((q) => filter === 'all' || q.status === filter)
  return (
    <>
      <div className="page-header">
        <h1><FileText size={24} style={{ verticalAlign: -3 }} /> Devis</h1>
        <div className="btn-row">
          <select className="input" style={{ width: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn btn-primary" onClick={blank}><Plus size={16} /> Devis vierge</button>
        </div>
      </div>
      <div className="card-sub" style={{ marginTop: -10, marginBottom: 12 }}>
        Astuce : générez un devis directement depuis le <Link to="/calculateur">calculateur</Link> — les prix par palier sont remplis automatiquement.
      </div>
      <div className="card">
        <table className="t">
          <thead><tr><th>N°</th><th>Titre</th><th>Client</th><th>Préparé par</th><th>Date</th><th>Statut</th></tr></thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/devis/${q.id}`)}>
                <td><b>{q.number}</b></td><td>{q.title}</td><td>{q.client?.name || '—'}</td>
                <td>{q.preparer?.full_name || '—'}</td><td>{new Date(q.created_at).toLocaleDateString('fr-FR')}</td>
                <td><span className={`pill ${q.status}`}>{STATUS_LABEL[q.status]}</span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="empty">Aucun devis</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
