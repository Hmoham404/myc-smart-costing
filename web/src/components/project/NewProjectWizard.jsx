import { useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check, Plus } from 'lucide-react'
import EditTable from '../EditTable'
import { NumInput } from '../ui'
import { newComponent, newProjectData, GLOBAL_PROCESSES, DEFAULT_SCHEDULE } from '../../lib/project/templates'
import { computeProject } from '../../lib/project/engine'
import { money, num } from '../../lib/format'

const STEPS = ['Projet', 'Pièces', 'Procédés & cadence', 'Récapitulatif']
const today = () => new Date().toISOString().slice(0, 10)

/** Fenêtre de création de projet : tout le reste (chiffrage, CBN, capacité, planning, Gantt) est généré automatiquement. */
export default function NewProjectWizard({ lib, onCancel, onCreate }) {
  const [step, setStep] = useState(0)
  const [info, setInfo] = useState({ title: '', client: '', reference: '', quantity: 100000, startDate: today(), weeksCount: 12, prepWeeks: 2 })
  const [components, setComponents] = useState([newComponent(1)])
  const [globals, setGlobals] = useState({ assembly: true, inspection: true, packaging: true, welding: false })
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const mats = (lib.materials || []).map((m) => m.name)
  const set = (k) => (v) => setInfo((s) => ({ ...s, [k]: v }))

  const data = useMemo(() => newProjectData({ ...info, components, globals, schedule }), [info, components, globals, schedule])
  const preview = useMemo(() => computeProject(data, lib), [data, lib])
  const canNext = step !== 0 || (info.title.trim() && info.quantity > 0)

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal wizard">
        <div className="wizard-head">
          <b>Nouveau projet</b>
          <div className="steps">{STEPS.map((s, i) => <span key={s} className={`step ${i === step ? 'on' : i < step ? 'done' : ''}`}><i>{i < step ? <Check size={12} /> : i + 1}</i>{s}</span>)}</div>
          <button className="icon-btn" onClick={onCancel}><X size={16} /></button>
        </div>

        <div className="wizard-body">
          {step === 0 && (
            <div className="grid g3">
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Titre du projet *</label><input autoFocus value={info.title} placeholder="ex. KIKO YZA040 — compact poudre" onChange={(e) => set('title')(e.target.value)} /></div>
              <div className="field"><label>Client</label><input value={info.client} placeholder="KIKO, SEPHORA…" onChange={(e) => set('client')(e.target.value)} /></div>
              <div className="field"><label>Référence</label><input value={info.reference} placeholder="YZA040" onChange={(e) => set('reference')(e.target.value)} /></div>
              <div className="field"><label>Quantité totale (produits finis) *</label><NumInput value={info.quantity} onChange={(v) => set('quantity')(Math.max(0, Math.round(v)))} /></div>
              <div className="field"><label>Date de début du projet</label><input type="date" value={info.startDate} onChange={(e) => set('startDate')(e.target.value)} /></div>
              <div className="field"><label>Durée du planning (semaines)</label><NumInput value={info.weeksCount} onChange={(v) => set('weeksCount')(Math.min(52, Math.max(1, Math.round(v))))} /></div>
              <div className="field"><label>Semaines de préparation (moules, essais)</label><NumInput value={info.prepWeeks} onChange={(v) => set('prepWeeks')(Math.max(0, Math.round(v)))} /></div>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="card-sub" style={{ marginBottom: 8 }}>Une ligne par pièce injectée. Les données inconnues pourront être complétées plus tard dans l'onglet « Définition » (ou calculées en conception 3D pour le poids).</div>
              <EditTable rows={components} onChange={setComponents} newRow={() => newComponent(components.length + 1)} minRows={1}
                columns={[
                  { key: 'name', label: 'Pièce', type: 'text' }, { key: 'reference', label: 'Référence', type: 'text' },
                  { key: 'material', label: 'Matière', type: 'select', options: ['', ...mats] },
                  { key: 'netWeight', label: 'Poids net (g)', type: 'num' }, { key: 'runnerWeight', label: 'Carotte (g)', type: 'num' },
                  { key: 'cavities', label: 'Empreintes', type: 'num', dec: 0 }, { key: 'cycle', label: 'Cycle (s)', type: 'num' },
                  { key: 'qtyPerProduct', label: 'Qté / produit', type: 'num', dec: 0 },
                  { key: 'dec', label: 'Sérigraphie', type: 'check', get: (r) => r.processes?.decoration, set: (r, v) => ({ ...r, processes: { ...r.processes, decoration: v } }) },
                  { key: 'pnt', label: 'Peinture', type: 'check', get: (r) => r.processes?.painting, set: (r, v) => ({ ...r, processes: { ...r.processes, painting: v } }) },
                  { key: 'met', label: 'Métallisation', type: 'check', get: (r) => r.processes?.metallization, set: (r, v) => ({ ...r, processes: { ...r.processes, metallization: v } }) },
                ]} />
            </>
          )}

          {step === 2 && (
            <>
              <div className="card-title">Procédés communs à toutes les pièces</div>
              <div className="btn-row" style={{ marginBottom: 16 }}>
                {GLOBAL_PROCESSES.map((g) => (
                  <label key={g.key} className={`chip-check big ${globals[g.key] ? 'on' : ''}`}>
                    <input type="checkbox" checked={!!globals[g.key]} onChange={(e) => setGlobals({ ...globals, [g.key]: e.target.checked })} />{g.label}
                  </label>
                ))}
              </div>
              <div className="card-title">Organisation par défaut (modifiable ensuite par opération)</div>
              <div className="grid g4">
                <div className="field"><label>Heures / poste</label><NumInput value={schedule.hoursPerShift} onChange={(v) => setSchedule({ ...schedule, hoursPerShift: v })} /></div>
                <div className="field"><label>Postes / jour</label><NumInput value={schedule.shiftsPerDay} onChange={(v) => setSchedule({ ...schedule, shiftsPerDay: v })} /></div>
                <div className="field"><label>Jours / semaine</label><NumInput value={schedule.daysPerWeek} onChange={(v) => setSchedule({ ...schedule, daysPerWeek: v })} /></div>
                <div className="field"><label>Efficacité (%)</label><NumInput value={+(schedule.efficiency * 100).toFixed(1)} onChange={(v) => setSchedule({ ...schedule, efficiency: v / 100 })} /></div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="kpis">
                <div className="kpi hero"><div className="k-label">Opérations générées</div><div className="k-value">{data.operations.length}</div></div>
                <div className="kpi"><div className="k-label">Matière à commander</div><div className="k-value">{num(preview.cbn.totalKg, 0)} kg</div></div>
                <div className="kpi"><div className="k-label">Coût / pièce (provisoire)</div><div className="k-value">{money(preview.costing.total)}</div></div>
                <div className="kpi"><div className="k-label">Goulot</div><div className="k-value">{preview.capacity.bottleneck ? `${num(preview.capacity.bottleneck.coverage * 100, 0)} %` : '—'}</div></div>
              </div>
              <table className="t" style={{ marginTop: 14 }}>
                <thead><tr><th>Opération</th><th className="num">Cadence / h</th><th className="num">Capacité / sem.</th></tr></thead>
                <tbody>{preview.capacity.ops.map((o) => <tr key={o.id}><td>{o.label}</td><td className="num">{num(o.hourly, 0)}</td><td className="num">{num(o.weekly, 0)}</td></tr>)}</tbody>
              </table>
              <div className="card-sub" style={{ marginTop: 8 }}>Après création, le projet s'ouvre avec les onglets Chiffrage, CBN, Capacité, Planning, Gantt, Analyse et Conception 3D — tous calculés automatiquement à partir de ces données.</div>
            </>
          )}
        </div>

        <div className="wizard-foot">
          <button className="btn btn-light" onClick={() => (step ? setStep(step - 1) : onCancel())}><ChevronLeft size={15} /> {step ? 'Précédent' : 'Annuler'}</button>
          {step < STEPS.length - 1
            ? <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Suivant <ChevronRight size={15} /></button>
            : <button className="btn btn-primary" onClick={() => onCreate({ title: info.title.trim(), client: info.client, reference: info.reference, data })}><Plus size={15} /> Créer le projet</button>}
        </div>
      </div>
    </div>
  )
}
