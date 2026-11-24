import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useProject, PROJECT_TYPES } from '../lib/useProject'
import { TYPE_ICON } from './Projects'
import InjectionProject from './projects/InjectionProject'
import MaterialsProject from './projects/MaterialsProject'
import CapacityProject from './projects/CapacityProject'

const EDITORS = { injection: InjectionProject, materials: MaterialsProject, capacity: CapacityProject }

export default function ProjectView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { project, error, saveState, update, setData } = useProject(id)
  if (error && !project) return <div className="db-warning">{error}</div>
  if (!project) return <div className="card empty">Chargement du projet…</div>
  const Editor = EDITORS[project.type]
  const I = TYPE_ICON[project.type]
  const save = {
    saved: <><Check size={14} /> Enregistré</>, pending: <><Loader2 size={14} /> Modifications…</>,
    saving: <><Loader2 size={14} className="spin" /> Enregistrement…</>, error: <><AlertTriangle size={14} /> Erreur d'enregistrement</>,
  }[saveState]

  return (
    <>
      <div className="page-header">
        <h1>
          <button className="icon-btn" onClick={() => nav('/projets')} title="Mes projets"><ArrowLeft size={17} /></button>
          <span className={`type-icon t-${project.type}`}><I size={18} /></span>
          <input className="title-input" value={project.title} onChange={(e) => update({ title: e.target.value })} />
        </h1>
        <div className="btn-row">
          <span className={`save-state ${saveState}`}>{save}</span>
          <select className="input" style={{ width: 130 }} value={project.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="en_cours">En cours</option><option value="valide">Validé</option><option value="archive">Archivé</option>
          </select>
        </div>
      </div>
      <div className="card" style={{ padding: '12px 18px' }}>
        <div className="grid g4" style={{ alignItems: 'end' }}>
          <div className="field"><label>Type</label><input readOnly value={PROJECT_TYPES[project.type]?.label} /></div>
          <div className="field"><label>Client</label><input value={project.client || ''} onChange={(e) => update({ client: e.target.value })} /></div>
          <div className="field"><label>Référence</label><input value={project.reference || ''} onChange={(e) => update({ reference: e.target.value })} /></div>
          <div className="card-sub" style={{ paddingBottom: 10 }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Enregistrement automatique en ligne — plus besoin du fichier Excel.</div>
        </div>
      </div>
      {Editor ? <Editor data={project.data} setData={setData} /> : <div className="card empty">Type de projet inconnu.</div>}
    </>
  )
}
