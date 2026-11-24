import { RefreshCw, Info } from 'lucide-react'
import EditTable from '../../components/EditTable'
import { NumInput } from '../../components/ui'
import { CATEGORIES } from '../../lib/project/engine'
import { generateOperations, newComponent, uid } from '../../lib/project/templates'
import { num } from '../../lib/format'

/** Onglet Définition : LA source de tous les calculs (composants + opérations). */
export default function Definition({ data, setData, lib, res }) {
  const comps = data.components || []
  const mats = (lib.materials || []).map((m) => m.name)
  const mbs = (lib.masterbatches || []).map((m) => m.name)
  const machines = (lib.machines || []).map((m) => m.name)
  const inks = (lib.inks || []).map((m) => m.name)
  const steps = (lib.assembly || []).map((m) => m.name)
  const compOpts = comps.map((c) => ({ value: c.id, label: c.name }))
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: v }))
  const capById = Object.fromEntries(res.capacity.ops.map((o) => [o.id, o]))

  const regenerate = () => {
    if (!confirm('Régénérer les opérations à partir des pièces ? Les opérations actuelles seront remplacées.')) return
    const first = data.weeks?.find((w) => w.need > 0)?.label || data.weeks?.[0]?.label || ''
    setData((d) => ({ ...d, operations: generateOperations(d.components, { assembly: true, inspection: true, packaging: true }, first) }))
  }
  const addInjectionFor = (c) => setData((d) => ({ ...d, operations: [...d.operations, { id: uid('o'), category: 'injection', label: `Injection ${c.name}`, componentIds: [c.id], machines: 1, workers: 1, startWeek: d.weeks?.[0]?.label || '', ramp: 1 }] }))
  const orphans = comps.filter((c) => !(data.operations || []).some((o) => o.category === 'injection' && o.componentIds?.[0] === c.id))

  return (
    <>
      <div className="card">
        <div className="grid g4" style={{ alignItems: 'end' }}>
          <div className="field"><label>Quantité totale (produits finis)</label><NumInput value={data.quantity || 0} onChange={(v) => set('quantity')(Math.round(v))} /></div>
          <div className="field"><label>Date de début</label><input type="date" value={data.startDate || ''} onChange={(e) => set('startDate')(e.target.value)} /></div>
          <div className="kpi"><div className="k-label">Coût / pièce</div><div className="k-value">{num(res.costing.total, 4)} $</div></div>
          <div className="kpi"><div className="k-label">Matière totale</div><div className="k-value">{num(res.cbn.totalKg, 0)} kg</div></div>
        </div>
        {data.note && <div className="alert info" style={{ marginTop: 12 }}><Info size={16} style={{ flex: 'none', marginTop: 2 }} /><div><b>Note</b>{data.note}</div></div>}
      </div>

      <div className="card">
        <div className="card-title">Pièces injectées <span className="card-sub">— matière, moule et rebut de chaque pièce</span></div>
        <EditTable rows={comps} onChange={set('components')} newRow={() => newComponent(comps.length + 1)}
          columns={[
            { key: 'name', label: 'Pièce', type: 'text' }, { key: 'reference', label: 'Référence', type: 'text' },
            { key: 'material', label: 'Matière', type: 'select', options: ['', ...mats] }, { key: 'color', label: 'Couleur', type: 'text' },
            { key: 'masterbatch', label: 'Mélange maître', type: 'select', options: ['', ...mbs] }, { key: 'mbShare', label: '% MB', type: 'pct' },
            { key: 'netWeight', label: 'Poids net (g)', type: 'num' }, { key: 'runnerWeight', label: 'Carotte (g)', type: 'num' },
            { key: 'cavities', label: 'Empreintes', type: 'num', dec: 0 }, { key: 'cycle', label: 'Cycle presse (s)', type: 'num' },
            { key: 'qtyPerProduct', label: 'Qté / produit', type: 'num', dec: 0 }, { key: 'rejectInjection', label: 'Rebut inj. %', type: 'pct' },
            { key: 'startupCycles', label: 'Cycles démarrage', type: 'num', dec: 0 }, { key: 'recyclingRate', label: 'Recyclage %', type: 'pct' },
          ]} />
        {orphans.length > 0 && (
          <div className="alert warning" style={{ marginTop: 8 }}><div><b>Pièce sans opération d'injection</b>
            {orphans.map((c) => <button key={c.id} className="btn btn-light" style={{ marginInlineEnd: 6, marginTop: 4 }} onClick={() => addInjectionFor(c)}>+ Injection {c.name}</button>)}</div></div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Opérations (gamme de fabrication)
          <span className="spacer" /><button className="btn btn-light" onClick={regenerate}><RefreshCw size={14} /> Régénérer depuis les pièces</button></div>
        <EditTable rows={data.operations || []} onChange={set('operations')}
          newRow={() => ({ id: uid('o'), category: 'assembly', label: 'Nouvelle opération', componentIds: [], machines: 1, workers: 1, cycle: 6, reject: 0, startWeek: data.weeks?.[0]?.label || '', ramp: 1 })}
          columns={[
            { key: 'category', label: 'Procédé', type: 'select', options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })) },
            { key: 'label', label: 'Libellé', type: 'text' },
            { key: 'componentIds', label: 'Pièces concernées', type: 'multi', options: compOpts, emptyLabel: 'Toutes' },
            { key: 'machine', label: 'Machine', type: 'select', options: ['', ...machines] },
            { key: 'step', label: 'Étape (assemblage)', type: 'select', options: ['', ...steps] },
            { key: 'machines', label: 'Nb machines', type: 'num', dec: 0 }, { key: 'workers', label: 'Opérateurs / poste', type: 'num', dec: 0 },
            { key: 'cycle', label: 'Cycle / pièce (s)', type: 'num' },
            { key: 'speed', label: 'Vitesse (m/min)', type: 'num' }, { key: 'jumps', label: 'Sauts', type: 'num', dec: 0 },
            { key: 'ink', label: 'Encre', type: 'select', options: ['', ...inks] }, { key: 'inkWeight', label: 'Encre (g)', type: 'num', dec: 3 },
            { key: 'reject', label: 'Rebut %', type: 'pct' }, { key: 'asmReject', label: 'Rebut assemb. %', type: 'pct' },
            { key: 'unitCost', label: 'Coût saisi $/pc', type: 'num', dec: 4 },
            { key: 'cyc', label: 'Cycle retenu', type: 'calc', value: (o) => num(capById[o.id]?.cycle, 3) },
            { key: 'h', label: 'Cadence / h', type: 'calc', value: (o) => num(capById[o.id]?.hourly, 0) },
          ]} />
        <div className="card-sub" style={{ marginTop: 6 }}>
          Injection : cycle = cycle presse ÷ empreintes de la pièce · Métallisation : vitesse et sauts de la chaîne · Autres : cycle par pièce saisi.
          « Coût saisi » remplace le calcul (ex. métallisation chiffrée dans l'espace Métallisation). Tout est recalculé dans les autres onglets.
        </div>
      </div>
    </>
  )
}
