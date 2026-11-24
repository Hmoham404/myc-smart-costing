import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, FolderKanban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PROJECT_TYPES } from '../lib/useProject'
import { TYPE_ICON } from './Projects'
import { timeAgo } from '../lib/format'

/** Accueil de l'espace Projets (Seif) */
export default function ProjectsHome() {
  const { profile } = useApp()
  const nav = useNavigate()
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)
  const mineOnly = profile.role !== 'admin' && profile.role !== 'directeur'

  useEffect(() => {
    let q = supabase.from('mc_projects').select('id, type, title, client, reference, status, owner_id, updated_at').neq('status', 'archive').order('updated_at', { ascending: false })
    if (mineOnly) q = q.eq('owner_id', profile.id)
    q.then(({ data, error }) => { setErr(error?.message || null); setProjects(data || []) })
  }, [profile.id, mineOnly])

  const count = (t) => projects.filter((p) => p.type === t).length
  return (
    <>
      <div className="page-header">
        <h1>Bonjour {profile.full_name.split(' ')[0]} 👋</h1>
        <Link className="btn btn-primary" to="/projets?new=injection"><Plus size={15} /> Nouveau projet</Link>
      </div>
      {err && <div className="db-warning"><b>Table des projets absente.</b> Exécutez <code>supabase/schema.sql</code> puis <code>supabase/seed_projets.sql</code>.<div className="card-sub">{err}</div></div>}

      <div className="dash">
        {Object.entries(PROJECT_TYPES).map(([k, t]) => {
          const I = TYPE_ICON[k]
          return (
            <div key={k} className="card span-4 stat" style={{ cursor: 'pointer' }} onClick={() => nav(`/projets?type=${k}`)}>
              <div className="stat-top">{t.label}<span className={`type-icon t-${k}`}><I size={18} /></span></div>
              <div className="stat-value">{count(k)}</div>
              <div className="card-sub">{t.desc}</div>
              <div className="btn-row" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                <Link className="btn btn-soft" to={`/projets?type=${k}`}>Voir <ArrowRight size={13} /></Link>
                <Link className="btn btn-light" to={`/projets?new=${k}`}><Plus size={13} /> Nouveau</Link>
              </div>
            </div>
          )
        })}

        <div className="card span-12">
          <div className="card-title"><FolderKanban size={17} /> {mineOnly ? 'Mes projets récents' : 'Projets récents'} <span className="spacer" /><Link to="/projets" className="card-sub">Tout voir <ArrowRight size={12} /></Link></div>
          <table className="t">
            <thead><tr><th>Projet</th><th>Type</th><th>Client</th><th>Référence</th><th>Modifié</th></tr></thead>
            <tbody>
              {projects.slice(0, 10).map((p) => {
                const I = TYPE_ICON[p.type]
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/projets/${p.id}`)}>
                    <td><b>{p.title}</b></td>
                    <td><span className="legend"><span><I size={14} /> {PROJECT_TYPES[p.type]?.label}</span></span></td>
                    <td>{p.client || '—'}</td><td>{p.reference || '—'}</td><td className="card-sub">{timeAgo(p.updated_at)}</td>
                  </tr>
                )
              })}
              {!projects.length && !err && <tr><td colSpan={5} className="empty">Aucun projet. Créez votre premier projet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
