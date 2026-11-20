import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, Save, Send, CheckCircle2, XCircle, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { NumInput, Field, useToast } from '../components/ui'
import { STATUS_LABEL } from '../lib/format'

const TIERS = ['5K', '10K', '25K', '50K', '100K+']

export default function QuoteEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile, canApprove } = useApp()
  const [toast, setToast] = useToast()
  const [q, setQ] = useState(null)
  const [clients, setClients] = useState([])
  const [people, setPeople] = useState({})

  const load = async () => {
    const { data } = await supabase.from('mc_quotes').select('*').eq('id', id).maybeSingle()
    setQ(data)
  }
  useEffect(() => {
    load()
    supabase.from('mc_clients').select('id, name').order('name').then(({ data }) => setClients(data || []))
    supabase.from('mc_profiles').select('id, full_name').then(({ data }) => setPeople(Object.fromEntries((data || []).map((p) => [p.id, p.full_name]))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!q) return <div className="card empty">Chargement…</div>
  const locked = ['valide', 'envoye'].includes(q.status)
  const set = (k) => (v) => setQ({ ...q, [k]: v })
  const setLine = (i, k, v) => set('lines')(q.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const setPrice = (i, tier, v) => set('lines')(q.lines.map((l, j) => (j === i ? { ...l, prices: { ...l.prices, [tier]: v } } : l)))
  const clientName = clients.find((c) => c.id === q.client_id)?.name || ''

  const save = async (status) => {
    const row = { title: q.title, client_id: q.client_id, incoterm: q.incoterm, currency: q.currency, lines: q.lines, conditions: q.conditions, notes: q.notes }
    if (status) row.status = status
    if (status === 'valide') row.approved_by = profile.id
    const { error } = await supabase.from('mc_quotes').update(row).eq('id', id)
    if (error) { setToast(error.message); return }
    if (status) {
      await publishPost(profile.id, 'quote', {
        soumis: `Devis ${q.number} soumis à validation de la direction.`,
        valide: `Devis ${q.number} validé ✅ — prêt à être envoyé au client.`,
        envoye: `Devis ${q.number} envoyé au client ${clientName}.`,
        refuse: `Devis ${q.number} refusé — à retravailler.`,
        brouillon: `Devis ${q.number} repassé en brouillon.`,
      }[status], id, { number: q.number, title: q.title, status })
    }
    setToast(status ? `Statut : ${STATUS_LABEL[status]} ✔` : 'Devis enregistré ✔')
    load()
  }

  return (
    <>
      {toast}
      <div className="page-header no-print">
        <h1><button className="round-btn" onClick={() => nav('/devis')} style={{ display: 'inline-grid', marginRight: 8 }}><ArrowLeft size={18} /></button>
          {q.number} <span className={`pill ${q.status}`}>{STATUS_LABEL[q.status]}</span></h1>
        <div className="btn-row">
          {!locked && <button className="btn btn-light" onClick={() => save()}><Save size={16} /> Enregistrer</button>}
          {q.status === 'brouillon' && <button className="btn btn-soft" onClick={() => save('soumis')}><Send size={16} /> Soumettre à validation</button>}
          {q.status === 'soumis' && canApprove && <>
            <button className="btn btn-green" style={{ fontSize: 15, padding: '8px 14px' }} onClick={() => save('valide')}><CheckCircle2 size={16} /> Valider</button>
            <button className="btn btn-danger" onClick={() => save('refuse')}><XCircle size={16} /> Refuser</button>
          </>}
          {q.status === 'refuse' && <button className="btn btn-light" onClick={() => save('brouillon')}>Repasser en brouillon</button>}
          {q.status === 'valide' && <button className="btn btn-soft" onClick={() => save('envoye')}><Send size={16} /> Marquer envoyé</button>}
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> PDF / Imprimer</button>
        </div>
      </div>
      {q.status === 'soumis' && !canApprove && <div className="alert info no-print"><div><b>En attente de validation</b>Seul un directeur (M. Sami) ou un admin peut valider ce devis.</div></div>}

      {!locked && (
        <div className="card no-print">
          <div className="card-title">Édition</div>
          <div className="grid g4">
            <Field label="Titre"><input value={q.title} onChange={(e) => set('title')(e.target.value)} /></Field>
            <Field label="Client">
              <select value={q.client_id || ''} onChange={(e) => set('client_id')(e.target.value || null)}>
                <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Incoterm"><input value={q.incoterm} onChange={(e) => set('incoterm')(e.target.value)} /></Field>
            <Field label="Devise"><input value={q.currency} onChange={(e) => set('currency')(e.target.value)} /></Field>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="t">
              <thead><tr><th>Réf.</th><th>Décoration</th><th>Dimensions</th>{TIERS.map((t) => <th key={t} className="num">{t}</th>)}<th></th></tr></thead>
              <tbody>
                {q.lines.map((l, i) => (
                  <tr key={i}>
                    <td><input className="input" value={l.reference} onChange={(e) => setLine(i, 'reference', e.target.value)} style={{ width: 120 }} /></td>
                    <td><input className="input" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} /></td>
                    <td><input className="input" value={l.dimensions} onChange={(e) => setLine(i, 'dimensions', e.target.value)} /></td>
                    {TIERS.map((t) => <td key={t}><NumInput className="input" style={{ width: 80, textAlign: 'right' }} value={l.prices?.[t] ?? 0} onChange={(v) => setPrice(i, t, v)} /></td>)}
                    <td><button className="btn btn-danger" onClick={() => set('lines')(q.lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-light" style={{ marginTop: 8 }} onClick={() => set('lines')([...q.lines, { reference: '', description: '', dimensions: '', prices: {} }])}><Plus size={14} /> Ligne</button>
        </div>
      )}

      {/* ---------- Document officiel (aperçu imprimable) ---------- */}
      <div className="card" style={{ padding: 0 }}>
        <div className="doc">
          <div className="doc-head">
            <img src="/logo-myc-dark.png" alt="MYC" />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>QUOTATION</div>
              <div><b>N° {q.number}</b></div>
              <div>Date : {new Date(q.created_at).toLocaleDateString('fr-FR')}</div>
              <div>Client : <b>{clientName || '—'}</b></div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{q.title}</div>
          <table>
            <thead>
              <tr><th rowSpan={2}>REF</th><th rowSpan={2}>DECORATION</th><th rowSpan={2}>DIMENSIONS</th><th colSpan={TIERS.length}>{q.incoterm.split(' ')[0]} UNIT PRICE ({q.currency})</th></tr>
              <tr>{TIERS.map((t) => <th key={t}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i}><td><b>{l.reference}</b></td><td>{l.description}</td><td>{l.dimensions}</td>
                  {TIERS.map((t) => <td key={t} style={{ textAlign: 'right' }}>{Number(l.prices?.[t] || 0).toFixed(4)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11 }}>{q.notes}</p>
          <table className="cond">
            <tbody>{(q.conditions || []).map(([k, v], i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}</tbody>
          </table>
          <div className="sign">
            <div>PREPARED BY : <b>{people[q.prepared_by] || '—'}</b></div>
            <div>VERIFIED & APPROVED BY : <b>{q.approved_by ? `${people[q.approved_by]} — ${new Date(q.approved_at).toLocaleDateString('fr-FR')}` : '(en attente)'}</b></div>
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: '#666', textAlign: 'center' }}>MYC Beauty Innovation Tunisia</div>
        </div>
      </div>
    </>
  )
}
