import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FolderKanban, Plus, Copy, Archive, Trash2, Package } from 'lucide-react'
import { supabase, publishPost } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useLibrary } from '../lib/project/useLibrary'
import NewProjectWizard from '../components/project/NewProjectWizard'
import { useToast } from '../components/ui'
import { num, timeAgo } from '../lib/format'

const STATUS = { en_cours: 'En cours', valide: 'Validé', archive: 'Archivé' }

export default function Projects() {
  const { profile } = useApp()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [toast, setToast] = useToast()
  const { lib } = useLibrary()
  const isLead = ['admin', 'directeur'].includes(profile.role)
  const [scope, setScope] = useState(isLead ? 'all' : 'mine')
  const [projects, setProjects] = useState([])
  const [people, setPeople] = useState({})
  const [err, setErr] = useState(null)
  const [wizard, setWizard] = useState(sp.get('new') === '1')

  const load = async () => {
    const [p, pr] = await Promise.all([
      supabase.from('mc_projects').select('id, type, title, client, reference, status, owner_id, updated_at, data').eq('type', 'project').order('updated_at', { ascending: false }),
      supabase.from('mc_profiles').select('id, full_name'),
    ])
    setErr(p.error?.message || null)
    setProjects(p.data || [])
    setPeople(Object.fromEntries((pr.data || []).map((x) => [x.id, x.full_name])))
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (sp.get('new') === '1') { setWizard(true); sp.delete('new'); setSp(sp, { replace: true }) } }, [sp, setSp])

  const insert = async (row) => {
    const { data, error } = await supabase.from('mc_projects').insert({ type: 'project', status: 'en_cours', owner_id: profile.id, ...row }).select('id').single()
    if (error) { setToast(error.message); return }
    await publishPost(profile.id, 'status', `📁 Nouveau projet « ${row.title} »${row.client ? ` (${row.client})` : ''}.`)
    nav(`/projets/${data.id}`)
  }
  const duplicate = (p) => insert({ title: `${p.title} (copie)`, client: p.client, reference: p.reference, data: JSON.parse(JSON.stringify(p.data)) })
  const setStatus = async (p, status) => { await supabase.from('mc_projects').update({ status }).eq('id', p.id); load() }
  const del = async (p) => { if (confirm(`Supprimer le projet « ${p.title} » ?`)) { await supabase.from('mc_projects').delete().eq('id', p.id); load() } }

  const list = projects.filter((p) => (scope === 'mine' ? p.owner_id === profile.id : true)).filter((p) => (scope === 'archive' ? p.status === 'archive' : p.status !== 'archive'))

  return (
    <>
      {toast}
      {wizard && <NewProjectWizard lib={lib} onCancel={() => setWizard(false)} onCreate={(row) => { setWizard(false); insert(row) }} />}
      <div className="page-header">
        <h1><FolderKanban size={22} /> {scope === 'mine' ? 'Mes projets' : scope === 'archive' ? 'Projets archivés' : 'Tous les projets'}</h1>
        <div className="btn-row">
          <div className="seg">{[['mine', 'Mes projets'], ['all', 'Tous'], ['archive', 'Archivés']].map(([k, l]) => <button key={k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{l}</button>)}</div>
          <button className="btn btn-primary" onClick={() => setWizard(true)}><Plus size={15} /> Nouveau projet</button>
        </div>
      </div>
      {err && <div className="db-warning"><b>Table des projets à mettre à jour.</b> Exécutez <code>supabase/schema.sql</code> puis <code>supabase/seed_projets.sql</code>.<div className="card-sub">{err}</div></div>}

      <div className="project-grid">
        {list.map((p) => {
          const d = p.data || {}
          return (
            <div key={p.id} className="project-card" onClick={() => nav(`/projets/${p.id}`)}>
              <div className="project-top">
                <span className="type-icon"><Package size={20} /></span>
                <span className={`pill ${p.status === 'valide' ? 'valide' : p.status === 'archive' ? 'brouillon' : 'envoye'}`}>{STATUS[p.status]}</span>
              </div>
              <b className="project-title">{p.title}</b>
              <div className="card-sub">{p.client || '—'} · {p.reference || '—'}</div>
              <div className="project-meta">
                <span><b>{num(d.quantity || 0)}</b> pcs</span><span><b>{(d.components || []).length}</b> pièces</span><span><b>{(d.operations || []).length}</b> opérations</span>
              </div>
              <div className="card-sub" style={{ marginTop: 'auto' }}>{people[p.owner_id] || '—'} · modifié {timeAgo(p.updated_at)}</div>
              <div className="btn-row project-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-light" title="Dupliquer" onClick={() => duplicate(p)}><Copy size={13} /></button>
                <button className="btn btn-light" title={p.status === 'archive' ? 'Désarchiver' : 'Archiver'} onClick={() => setStatus(p, p.status === 'archive' ? 'en_cours' : 'archive')}><Archive size={13} /></button>
                <button className="btn btn-danger" title="Supprimer" onClick={() => del(p)}><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })}
        {!list.length && !err && <div className="card empty" style={{ gridColumn: '1 / -1' }}>Aucun projet ici. Cliquez sur « Nouveau projet ».</div>}
      </div>
    </>
  )
}
