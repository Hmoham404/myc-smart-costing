import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, FolderKanban, Library, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useLibrary } from '../lib/project/useLibrary'
import { computeProject } from '../lib/project/engine'
import { money, num, pct, timeAgo } from '../lib/format'

/** Accueil de l'espace Projets (Seif) */
export default function ProjectsHome() {
  const { profile } = useApp()
  const nav = useNavigate()
  const { lib } = useLibrary()
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)
  const mineOnly = !['admin', 'directeur'].includes(profile.role)

  useEffect(() => {
    let q = supabase.from('mc_projects').select('id, title, client, reference, status, owner_id, updated_at, data').eq('type', 'project').neq('status', 'archive').order('updated_at', { ascending: false })
    if (mineOnly) q = q.eq('owner_id', profile.id)
    q.then(({ data, error }) => { setErr(error?.message || null); setProjects(data || []) })
  }, [profile.id, mineOnly])

  const rows = useMemo(() => projects.map((p) => ({ ...p, r: computeProject(p.data || {}, lib) })), [projects, lib])
  const totalQty = rows.reduce((a, p) => a + (p.data?.quantity || 0), 0)
  const totalKg = rows.reduce((a, p) => a + p.r.cbn.totalKg, 0)
  const atRisk = rows.filter((p) => p.r.capacity.bottleneck && p.r.capacity.bottleneck.coverage < 1).length

  return (
    <>
      <div className="page-header">
        <h1>Bonjour {profile.full_name.split(' ')[0]} 👋</h1>
        <div className="btn-row">
          <Link className="btn btn-light" to="/bibliotheque"><Library size={15} /> Bibliothèque</Link>
          <Link className="btn btn-primary" to="/projets?new=1"><Plus size={15} /> Nouveau projet</Link>
        </div>
      </div>
      {err && <div className="db-warning"><b>Base à mettre à jour.</b> Exécutez <code>supabase/schema.sql</code> puis <code>supabase/seed_projets.sql</code>.<div className="card-sub">{err}</div></div>}

      <div className="dash">
        <div className="card span-3 stat"><div className="stat-top">Projets en cours<span className="type-icon"><FolderKanban size={18} /></span></div><div className="stat-value">{rows.length}</div><div className="card-sub">{mineOnly ? 'mes projets' : 'tous les projets'}</div></div>
        <div className="card span-3 stat"><div className="stat-top">Pièces à produire<span className="type-icon"><Package size={18} /></span></div><div className="stat-value">{num(totalQty)}</div><div className="card-sub">produits finis</div></div>
        <div className="card span-3 stat"><div className="stat-top">Matière à commander</div><div className="stat-value">{num(totalKg, 0)} kg</div><div className="card-sub">somme des CBN</div></div>
        <div className="card span-3 stat"><div className="stat-top">Capacité insuffisante</div><div className="stat-value">{atRisk}</div><div className="card-sub">projet(s) avec un goulot &lt; 100 %</div></div>

        <div className="card span-12">
          <div className="card-title"><FolderKanban size={17} /> Projets <span className="spacer" /><Link to="/projets" className="card-sub">Tout voir <ArrowRight size={12} /></Link></div>
          <table className="t">
            <thead><tr><th>Projet</th><th>Client</th><th className="num">Quantité</th><th className="num">Coût / pièce</th><th className="num">Matière (kg)</th><th className="num">Goulot</th><th>Modifié</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const b = p.r.capacity.bottleneck
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/projets/${p.id}`)}>
                    <td><b>{p.title}</b></td><td>{p.client || '—'}</td><td className="num">{num(p.data?.quantity || 0)}</td>
                    <td className="num">{p.r.costing.total ? money(p.r.costing.total) : '—'}</td><td className="num">{num(p.r.cbn.totalKg, 0)}</td>
                    <td className="num">{b ? <span style={{ color: b.coverage < 1 ? 'var(--bad)' : 'var(--good)', fontWeight: 700 }}>{pct(b.coverage, 0)}</span> : '—'}</td>
                    <td className="card-sub">{timeAgo(p.updated_at)}</td>
                  </tr>
                )
              })}
              {!rows.length && !err && <tr><td colSpan={7} className="empty">Aucun projet. Cliquez sur « Nouveau projet ».</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
