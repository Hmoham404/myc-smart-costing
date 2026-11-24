import { Suspense, lazy, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, AlertTriangle, ListTree, Calculator, Boxes, Gauge, CalendarRange, GanttChart, LineChart, Box } from 'lucide-react'
import { useProject } from '../lib/useProject'
import { useLibrary } from '../lib/project/useLibrary'
import { computeProject } from '../lib/project/engine'
import { Seg } from '../components/ui'
import Definition from './project/Definition'
import Costing from './project/Costing'
import CBN from './project/CBN'
import Capacity from './project/Capacity'
import Planning from './project/Planning'
import Gantt from './project/Gantt'
import Analysis from './project/Analysis'
const Design3D = lazy(() => import('./project/Design3D'))

const TABS = [
  ['definition', ListTree, 'Définition'], ['costing', Calculator, 'Chiffrage'], ['cbn', Boxes, 'Besoin net (CBN)'],
  ['capacity', Gauge, 'Capacité'], ['planning', CalendarRange, 'Planning'], ['gantt', GanttChart, 'Diagramme de Gantt'],
  ['analysis', LineChart, 'Analyse'], ['design', Box, 'Conception 3D'],
]

export default function ProjectView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'definition'
  const { project, error, saveState, update, setData } = useProject(id)
  const { lib, save: saveLib } = useLibrary()
  const [mode, setMode] = useState('excel')
  const res = useMemo(() => (project ? computeProject(project.data || {}, lib, mode) : null), [project, lib, mode])

  if (error && !project) return <div className="db-warning">{error}</div>
  if (!project) return <div className="card empty">Chargement du projet…</div>
  if (project.type !== 'project') return <div className="db-warning">Ce projet est à l'ancien format. Exécutez <code>supabase/seed_projets.sql</code> pour charger les projets exemples au nouveau format.</div>

  const save = {
    saved: <><Check size={14} /> Enregistré</>, pending: <><Loader2 size={14} /> Modifications…</>,
    saving: <><Loader2 size={14} className="spin" /> Enregistrement…</>, error: <><AlertTriangle size={14} /> Erreur d'enregistrement</>,
  }[saveState]
  const props = { data: project.data, setData, lib, saveLib, res, mode, project }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 10 }}>
        <h1>
          <button className="icon-btn" onClick={() => nav('/projets')} title="Mes projets"><ArrowLeft size={17} /></button>
          <input className="title-input" value={project.title} onChange={(e) => update({ title: e.target.value })} />
        </h1>
        <div className="btn-row">
          <span className={`save-state ${saveState}`}>{save}</span>
          <input className="input" style={{ width: 130 }} placeholder="Client" value={project.client || ''} onChange={(e) => update({ client: e.target.value })} />
          <input className="input" style={{ width: 110 }} placeholder="Référence" value={project.reference || ''} onChange={(e) => update({ reference: e.target.value })} />
          <select className="input" style={{ width: 120 }} value={project.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="en_cours">En cours</option><option value="valide">Validé</option><option value="archive">Archivé</option>
          </select>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(([k, I, label]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'on' : ''}`} onClick={() => setSp({ tab: k }, { replace: true })}><I size={15} /> {label}</button>
        ))}
        <span className="spacer" />
        {['capacity', 'planning', 'gantt', 'analysis'].includes(tab) && <Seg value={mode} onChange={setMode} options={[['excel', 'Calcul Excel'], ['corrected', 'Corrigé']]} />}
      </div>

      {tab === 'definition' && <Definition {...props} />}
      {tab === 'costing' && <Costing {...props} />}
      {tab === 'cbn' && <CBN {...props} />}
      {tab === 'capacity' && <Capacity {...props} />}
      {tab === 'planning' && <Planning {...props} />}
      {tab === 'gantt' && <Gantt {...props} />}
      {tab === 'analysis' && <Analysis {...props} />}
      {tab === 'design' && <Suspense fallback={<div className="card empty">Chargement de la conception 3D…</div>}><Design3D {...props} /></Suspense>}
    </>
  )
}
