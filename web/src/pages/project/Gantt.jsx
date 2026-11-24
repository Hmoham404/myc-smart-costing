import { Fragment, useMemo } from 'react'
import { Wand2, Plus, AlertTriangle } from 'lucide-react'
import EditTable from '../../components/EditTable'
import { workDays, tasksFromPlanning, toDate, iso, isoWeek } from '../../lib/project/engine'
import { uid } from '../../lib/project/templates'
import { num } from '../../lib/format'

const DAY = 86400000
const DOW = ['d', 'l', 'm', 'm', 'j', 'v', 's']
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#d55181', '#c98500']

/** Onglet Diagramme de Gantt (KIKO « Gantt Chart » + jours fériés « JF ») */
export default function Gantt({ data, setData, res }) {
  const tasks = data.tasks || []
  const holidays = data.holidays || []
  const withHol = !!data.ganttHolidays
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: v }))
  const groups = [...new Set(tasks.map((t) => t.group || ''))]
  const color = (g) => COLORS[Math.max(0, groups.indexOf(g)) % COLORS.length]
  const holSet = new Set(holidays.map((h) => String(h.date).slice(0, 10)))

  const range = useMemo(() => {
    const ds = tasks.flatMap((t) => [toDate(t.start), toDate(t.end)]).filter(Boolean)
    if (!ds.length) return []
    let a = new Date(Math.min(...ds)), b = new Date(Math.max(...ds))
    a = new Date(a.getTime() - ((a.getDay() + 6) % 7) * DAY)
    const days = []
    for (let t = a.getTime(); t <= b.getTime() + 6 * DAY && days.length < 200; t += DAY) days.push(new Date(t))
    return days
  }, [tasks])
  const weeks = []
  range.forEach((d, i) => { if (i % 7 === 0) weeks.push({ label: `W${isoWeek(d)}`, start: d }) })
  const todayIso = iso(new Date())

  const generate = () => {
    if (tasks.length && !confirm('Remplacer les tâches par celles générées depuis le planning de production ?')) return
    set('tasks')(tasksFromPlanning(data, res.planning))
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Tâches du projet
          <span className="spacer" />
          <label className="check"><input type="checkbox" checked={withHol} onChange={(e) => set('ganttHolidays')(e.target.checked)} /> Retirer les jours fériés des jours ouvrés</label>
          <button className="btn btn-light" onClick={generate}><Wand2 size={14} /> Générer depuis le planning</button>
        </div>
        {!withHol && holidays.length > 0 && (
          <div className="alert info"><AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} /><div><b>Calcul du classeur</b>Les jours ouvrés sont comptés du lundi au vendredi sans retirer les jours fériés (NETWORKDAYS sans la liste JF). Cochez la case pour les retirer.</div></div>
        )}
        <EditTable rows={tasks} onChange={set('tasks')} newRow={() => ({ id: uid('t'), group: groups[0] || 'Production', name: 'Nouvelle tâche', equipment: '', start: data.startDate || todayIso, end: data.startDate || todayIso, progress: 0 })}
          columns={[
            { key: 'group', label: 'Processus', type: 'text' }, { key: 'name', label: 'Tâche', type: 'text' }, { key: 'equipment', label: 'Équipement & MP', type: 'text' },
            { key: 'start', label: 'Début', type: 'text' }, { key: 'end', label: 'Fin', type: 'text' }, { key: 'progress', label: 'Avancement %', type: 'pct' },
            { key: 'wd', label: 'Jours ouvrés', type: 'calc', value: (t) => <b>{num(workDays(t.start, t.end, holidays, withHol))}</b> },
          ]} />
        <div className="card-sub" style={{ marginTop: 6 }}>Dates au format AAAA-MM-JJ.</div>
      </div>

      {range.length > 0 && (
        <div className="card">
          <div className="card-title">Diagramme de Gantt</div>
          <div className="gantt-wrap">
            <table className="gchart">
              <thead>
                <tr><th className="gc-name" rowSpan={2}>Tâche</th>{weeks.map((w) => <th key={w.label} colSpan={7} className="gc-week">{w.label} · {w.start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</th>)}</tr>
                <tr>{range.map((d, i) => <th key={i} className={`gc-day ${d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''} ${holSet.has(iso(d)) ? 'hol' : ''}`}>{DOW[d.getDay()]}</th>)}</tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={`g-${g}`}>
                    <tr className="gc-group"><td className="gc-name"><b>{g || '—'}</b></td><td colSpan={range.length} /></tr>
                    {tasks.filter((t) => (t.group || '') === g).map((t) => {
                      const a = toDate(t.start), b = toDate(t.end)
                      return (
                        <tr key={t.id}>
                          <td className="gc-name" title={t.name}>{t.name}</td>
                          {range.map((d, i) => {
                            const inBar = a && b && d >= a && d <= b
                            const done = inBar && (d - a) / Math.max(DAY, b - a + DAY) < Number(t.progress || 0)
                            return <td key={i} className={`gc-cell ${d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''} ${holSet.has(iso(d)) ? 'hol' : ''} ${iso(d) === todayIso ? 'today' : ''}`}>
                              {inBar && <div className="gc-bar" style={{ background: color(g), opacity: done ? 1 : 0.55 }} />}
                            </td>
                          })}
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend" style={{ marginTop: 8 }}>
            <span><i style={{ background: '#cbd5e1' }} />Week-end</span><span><i style={{ background: '#fca5a5' }} />Jour férié</span><span><i style={{ background: 'var(--primary)' }} />Aujourd'hui</span><span>Barre foncée = avancement</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Jours fériés</div>
        <EditTable rows={holidays} onChange={set('holidays')} newRow={{ date: todayIso, label: '' }}
          columns={[{ key: 'date', label: 'Date (AAAA-MM-JJ)', type: 'text' }, { key: 'label', label: 'Description', type: 'text' }]} />
      </div>
    </>
  )
}
