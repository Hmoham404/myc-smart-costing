import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, Copy, Archive, Factory, Boxes, CalendarRange, Trash2 } from 'lucide-react'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PROJECT_TYPES, blankData } from '../lib/useProject'
import { useToast } from '../components/ui'
import { timeAgo } from '../lib/format'

export const TYPE_ICON = { injection: Factory, materials: Boxes, capacity: CalendarRange }
const STATUS = { en_cours: 'En cours', valide: 'Validé', archive: 'Archivé' }

export default function Projects() {
  const { profile } = useApp()
  const nav = useNavigate()
  const [toast, setToast] = useToast()
  const [projects, setProjects] = useState([])
  const [people, setPeople] = useState({})
  const [scope, setScope] = useState('mine')
  const [err, setErr] = useState(null)
  const [creating, setCreating] = useState(null)

  const load = async () => {
    const [p, pr] = await Promise.all([
      supabase.from('mc_projects').select('id, type, title, client, reference, status, owner_id, updated_at').order('updated_at', { ascending: false }),
      supabase.from('mc_profiles').select('id, full_name'),
    ])
    setErr(p.error?.message || null)
    setProjects(p.data || [])
    setPeople(Object.fromEntries((pr.data || []).map((x) => [x.id, x.full_name])))
  }
  useEffect(() => { load() }, [])

  const create = async (type, sourceId) => {
    let source = null
    if (sourceId) {
      const { data } = await supabase.from('mc_projects').select('*').eq('id', sourceId).single()
      source = data
    }
    const title = creating?.title || (source ? `${source.title} (copie)` : `Nouveau — ${PROJECT_TYPES[type].label}`)
    const data = source ? JSON.parse(JSON.stringify(source.data)) : blankData(type)
    const { data: row, error } = await supabase.from('mc_projects')
      .insert({ type, title, client: creating?.client || source?.client || '', reference: creating?.reference || source?.reference || '', owner_id: profile.id, data })
      .select('id').single()
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'status', `📁 Nouveau projet « ${title} » (${PROJECT_TYPES[type].label}).`)
    nav(`/projets/${row.id}`)
  }
  const setStatus = async (p, status) => { await supabase.from('mc_projects').update({ status }).eq('id', p.id); load() }
  const del = async (p) => { if (confirm(`Supprimer le projet « ${p.title} » ?`)) { await supabase.from('mc_projects').delete().eq('id', p.id); load() } }

  const list = projects.filter((p) => (scope === 'mine' ? p.owner_id === profile.id : true)).filter((p) => scope === 'archive' ? p.status === 'archive' : p.status !== 'archive')

  return (
    <>
      {toast}
      <div className="page-header">
        <h1><FolderKanban size={22} /> {scope === 'mine' ? 'Mes projets' : 'Projets'}</h1>
        <div className="btn-row">
          <div className="seg">
            {[['mine', 'Mes projets'], ['all', 'Tous'], ['archive', 'Archivés']].map(([k, l]) => <button key={k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{l}</button>)}
          </div>
          <button className="btn btn-primary" onClick={() => setCreating({ type: 'injection', title: '', client: '', reference: '', source: '' })}><Plus size={15} /> Nouveau projet</button>
        </div>
      </div>

      {err && <div className="db-warning"><b>Table des projets absente.</b> Exécutez <code>supabase/schema.sql</code> puis <code>supabase/seed_projets.sql</code> dans Supabase → SQL Editor.<div className="card-sub">{err}</div></div>}

      {creating && (
        <div className="card">
          <div className="card-title">Nouveau projet</div>
          <div className="type-grid">
            {Object.entries(PROJECT_TYPES).map(([k, t]) => {
              const I = TYPE_ICON[k]
              return (
                <button key={k} className={`type-card ${creating.type === k ? 'on' : ''}`} onClick={() => setCreating({ ...creating, type: k, source: '' })}>
                  <span className="type-icon"><I size={22} /></span><b>{t.label}</b><span className="card-sub">{t.desc}</span>
                </button>
              )
            })}
          </div>
          <div className="grid g4" style={{ marginTop: 14 }}>
            <div className="field"><label>Titre</label><input value={creating.title} placeholder="ex. KIKO YZA040 — capacité" onChange={(e) => setCreating({ ...creating, title: e.target.value })} /></div>
            <div className="field"><label>Client</label><input value={creating.client} onChange={(e) => setCreating({ ...creating, client: e.target.value })} /></div>
            <div className="field"><label>Référence</label><input value={creating.reference} onChange={(e) => setCreating({ ...creating, reference: e.target.value })} /></div>
            <div className="field"><label>Partir de</label>
              <select value={creating.source} onChange={(e) => setCreating({ ...creating, source: e.target.value })}>
                <option value="">Modèle vierge</option>
                {projects.filter((p) => p.type === creating.type).map((p) => <option key={p.id} value={p.id}>Copie de : {p.title}</option>)}
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => create(creating.type, creating.source)}><Plus size={14} /> Créer et ouvrir</button>
            <button className="btn btn-light" onClick={() => setCreating(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="project-grid">
        {list.map((p) => {
          const I = TYPE_ICON[p.type] || FolderKanban
          return (
            <div key={p.id} className="project-card" onClick={() => nav(`/projets/${p.id}`)}>
              <div className="project-top">
                <span className={`type-icon t-${p.type}`}><I size={20} /></span>
                <span className={`pill ${p.status === 'valide' ? 'valide' : p.status === 'archive' ? 'brouillon' : 'envoye'}`}>{STATUS[p.status]}</span>
              </div>
              <b className="project-title">{p.title}</b>
              <div className="card-sub">{PROJECT_TYPES[p.type]?.label} · {p.client || '—'} · {p.reference || '—'}</div>
              <div className="card-sub" style={{ marginTop: 'auto' }}>{people[p.owner_id] || '—'} · modifié {timeAgo(p.updated_at)}</div>
              <div className="btn-row project-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-light" title="Dupliquer" onClick={() => create(p.type, p.id)}><Copy size={13} /></button>
                <button className="btn btn-light" title={p.status === 'archive' ? 'Désarchiver' : 'Archiver'} onClick={() => setStatus(p, p.status === 'archive' ? 'en_cours' : 'archive')}><Archive size={13} /></button>
                <button className="btn btn-danger" title="Supprimer" onClick={() => del(p)}><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })}
        {!list.length && !err && <div className="card empty" style={{ gridColumn: '1 / -1' }}>Aucun projet ici. {scope === 'mine' && 'Voir « Tous » ou créer un nouveau projet.'}</div>}
      </div>
    </>
  )
}
