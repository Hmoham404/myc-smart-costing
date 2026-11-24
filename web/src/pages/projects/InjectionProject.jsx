import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { computeInjection, SECTION_LABEL } from '../../lib/injection'
import EditTable from '../../components/EditTable'
import { NumInput, Seg } from '../../components/ui'
import { useViz, axisProps, VizTooltip } from '../../components/viz'
import { money, num, pct } from '../../lib/format'

const $ = (v, d = 4) => money(v, 'USD', d)

export default function InjectionProject({ data, setData }) {
  const c = useViz()
  const [tab, setTab] = useState('cost')
  const r = useMemo(() => computeInjection(data), [data])
  const R = data.refs || {}
  const names = (list) => (list || []).map((x) => x.name)
  const parts = [...new Set([...(data.resin || []), ...(data.injection || [])].map((x) => x.part).filter(Boolean))]
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: v }))
  const setRefs = (k) => (v) => setData((d) => ({ ...d, refs: { ...d.refs, [k]: v } }))
  const sections = Object.entries(r.sections).map(([k, v]) => ({ name: SECTION_LABEL[k], v }))
  const PAL = [c.s1, c.s2, c.s3, c.s1, c.s2, c.s3, c.s1]

  return (
    <>
      <div className="dash">
        <div className="card span-8">
          <div className="kpis">
            <div className="kpi hero"><div className="k-label">Coût de revient / pièce</div><div className="k-value">{$(r.total)}</div></div>
            <div className="kpi"><div className="k-label">Prix de vente</div><div className="k-value">{$(r.salePrice)}</div><div className="k-delta flat">marge {pct(data.margin || 0, 1)}</div></div>
            <div className="kpi"><div className="k-label">Pour 1 000 pièces</div><div className="k-value">{$(r.total * 1000, 2)}</div></div>
            <div className="kpi"><div className="k-label">Pièces / carton</div><div className="k-value">{num(r.perCarton)}</div></div>
          </div>
          <div className="grid g3" style={{ marginTop: 14 }}>
            <div className="field"><label>Marge commerciale (%)</label><NumInput value={+((data.margin || 0) * 100).toFixed(2)} onChange={(v) => set('margin')(v / 100)} /></div>
            <div className="field"><label>Transport ($ / pièce)</label><NumInput value={data.transport || 0} onChange={set('transport')} /></div>
            <div className="field"><label>Vue</label><Seg value={tab} onChange={setTab} options={[['cost', 'Chiffrage'], ['refs', 'Bibliothèque (prix & machines)']]} /></div>
          </div>
        </div>
        <div className="card span-4">
          <div className="card-title">Répartition du coût</div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer>
              <BarChart data={sections} layout="vertical" margin={{ left: 0, right: 14 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={110} {...axisProps(c)} axisLine={false} />
                <Tooltip content={<VizTooltip fmt={(v) => `${$(v)} (${pct(v / (r.total || 1), 0)})`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey="v" name="Coût / pièce" radius={[0, 4, 4, 0]} barSize={14}>{sections.map((_, i) => <Cell key={i} fill={PAL[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {tab === 'cost' ? (
        <>
          <div className="card">
            <div className="card-title">1. Matière <span className="spacer" /><b>{$(r.sections.resin)}</b></div>
            <EditTable rows={data.resin || []} onChange={set('resin')} newRow={{ part: parts[0] || '', material: '', color: '', netWeight: 0, runnerWeight: 0, rate: 1, reject: 0.03, assemblyReject: 0, masterbatch: '', mbRate: 0 }}
              columns={[
                { key: 'part', label: 'Pièce', type: 'text' }, { key: 'material', label: 'Matière', type: 'select', options: names(R.materials) },
                { key: 'color', label: 'Couleur', type: 'text' }, { key: 'netWeight', label: 'Poids net (g)', type: 'num' },
                { key: 'runnerWeight', label: 'Carotte (g)', type: 'num' }, { key: 'rate', label: 'Taux', type: 'num' },
                { key: 'masterbatch', label: 'Mélange maître', type: 'select', options: ['', ...names(R.masterbatches)] }, { key: 'mbRate', label: 'Taux MB', type: 'num' },
                { key: 'reject', label: 'Rebut inj. %', type: 'pct' },
                { key: 'w', label: 'Poids unit. (g)', type: 'calc', value: (_, i) => num(r.resin[i]?.unitWeight, 2) },
                { key: 'c', label: 'Coût', type: 'calc', value: (_, i) => $(r.resin[i]?.cost) },
              ]} />
          </div>
          <div className="card">
            <div className="card-title">2. Injection <span className="spacer" /><b>{$(r.sections.injection)}</b></div>
            <EditTable rows={data.injection || []} onChange={set('injection')} newRow={{ part: '', cycle: 30, cavity: 4, workers: 1, machine: names(R.machines)[0] || '', reject: 0.03, assemblyReject: 0.03 }}
              columns={[
                { key: 'part', label: 'Pièce', type: 'text' }, { key: 'cycle', label: 'Cycle (s)', type: 'num' }, { key: 'cavity', label: 'Empreintes', type: 'num' },
                { key: 'workers', label: 'Opérateurs', type: 'num' }, { key: 'machine', label: 'Presse', type: 'select', options: names(R.machines) },
                { key: 'reject', label: 'Rebut %', type: 'pct' }, { key: 'assemblyReject', label: 'Rebut assemb. %', type: 'pct' },
                { key: 'cap', label: 'Cadence / h', type: 'calc', value: (_, i) => num(r.injection[i]?.capacity, 0) },
                { key: 'c', label: 'Coût', type: 'calc', value: (_, i) => $(r.injection[i]?.cost) },
              ]} />
          </div>
          <div className="card">
            <div className="card-title">3. Décoration SS/HS (sérigraphie, marquage à chaud) <span className="spacer" /><b>{$(r.sections.decoration)}</b></div>
            <EditTable rows={data.decoration || []} onChange={set('decoration')} newRow={{ part: '', ink: names(R.inks)[0] || '', cycle: 6, workers: 1, machine: '', inkWeight: 0.02, reject: 0.03 }}
              columns={[
                { key: 'part', label: 'Pièce', type: 'text' }, { key: 'ink', label: 'Encre / film', type: 'select', options: names(R.inks) },
                { key: 'cycle', label: 'Cycle (s)', type: 'num' }, { key: 'workers', label: 'Opérateurs', type: 'num' },
                { key: 'machine', label: 'Machine', type: 'select', options: names(R.machines) }, { key: 'inkWeight', label: 'Encre (g)', type: 'num', dec: 3 },
                { key: 'reject', label: 'Rebut %', type: 'pct' },
                { key: 'cap', label: 'Cadence / h', type: 'calc', value: (_, i) => num(r.decoration[i]?.capacity, 0) },
                { key: 'c', label: 'Coût', type: 'calc', value: (_, i) => $(r.decoration[i]?.cost) },
              ]} />
          </div>
          <div className="dash">
            <div className="card span-5">
              <div className="card-title">4. Composants <span className="spacer" /><b>{$(r.sections.components)}</b></div>
              <EditTable rows={data.components || []} onChange={set('components')} newRow={{ name: names(R.components)[0] || '', description: '', qty: 1, reject: 0.03 }}
                columns={[
                  { key: 'name', label: 'Composant', type: 'select', options: names(R.components) }, { key: 'qty', label: 'Qté / pièce', type: 'num' },
                  { key: 'reject', label: 'Rebut %', type: 'pct' }, { key: 'c', label: 'Coût', type: 'calc', value: (_, i) => $(r.components[i]?.cost) },
                ]} />
            </div>
            <div className="card span-7">
              <div className="card-title">5. Assemblage <span className="spacer" /><b>{$(r.sections.assembly)}</b></div>
              <EditTable rows={data.assembly || []} onChange={set('assembly')} newRow={{ operation: names(R.assembly)[0] || '', cycle: 6, workers: 1, reject: 0.03 }}
                columns={[
                  { key: 'operation', label: 'Opération', type: 'select', options: names(R.assembly) }, { key: 'cycle', label: 'Cycle (s)', type: 'num' },
                  { key: 'workers', label: 'Opérateurs', type: 'num' }, { key: 'reject', label: 'Rebut %', type: 'pct' },
                  { key: 'cap', label: 'Cadence / h', type: 'calc', value: (_, i) => num(r.assembly[i]?.capacity, 0) },
                  { key: 'c', label: 'Coût', type: 'calc', value: (_, i) => $(r.assembly[i]?.cost) },
                ]} />
            </div>
          </div>
          <div className="card">
            <div className="card-title">6. Emballage <span className="spacer" /><b>{$(r.sections.packing)}</b></div>
            <div className="grid g4" style={{ marginBottom: 10 }}>
              <div className="field"><label>Couches par carton</label><NumInput value={data.packing?.layers || 0} onChange={(v) => setData((d) => ({ ...d, packing: { ...d.packing, layers: v } }))} /></div>
              <div className="field"><label>Pièces par couche</label><NumInput value={data.packing?.perLayer || 0} onChange={(v) => setData((d) => ({ ...d, packing: { ...d.packing, perLayer: v } }))} /></div>
              <div className="field"><label>Pièces par carton</label><input readOnly value={num(r.perCarton)} /></div>
            </div>
            <EditTable rows={data.packing?.items || []} onChange={(v) => setData((d) => ({ ...d, packing: { ...d.packing, items: v } }))} newRow={{ name: names(R.packaging)[0] || '', qty: 1 }}
              columns={[
                { key: 'name', label: 'Article', type: 'select', options: names(R.packaging) }, { key: 'qty', label: 'Qté / carton', type: 'num' },
                { key: 'u', label: 'Prix unitaire', type: 'calc', value: (_, i) => $(r.packItems[i]?.unit) }, { key: 't', label: 'Total carton', type: 'calc', value: (_, i) => $(r.packItems[i]?.total, 3) },
              ]} />
          </div>
        </>
      ) : (
        <div className="dash">
          {[['materials', 'Matières (prix $/kg TTC)', 'price'], ['masterbatches', 'Mélanges maîtres ($/kg)', 'price'], ['inks', 'Encres / films ($/kg)', 'price'],
            ['components', 'Composants ($/u)', 'price'], ['packaging', 'Emballages ($/u)', 'price']].map(([k, label]) => (
            <div key={k} className="card span-4">
              <div className="card-title">{label}</div>
              <EditTable rows={R[k] || []} onChange={setRefs(k)} newRow={{ name: '', price: 0 }}
                columns={[{ key: 'name', label: 'Nom', type: 'text' }, { key: 'price', label: 'Prix', type: 'num', dec: 4 }]} />
            </div>
          ))}
          <div className="card span-6">
            <div className="card-title">Machines (coût horaire $)</div>
            <EditTable rows={R.machines || []} onChange={setRefs('machines')} newRow={{ name: '', labor: 3, machineCost: 0 }}
              columns={[{ key: 'name', label: 'Machine', type: 'text' }, { key: 'labor', label: 'MOD $/h', type: 'num' }, { key: 'machineCost', label: 'Machine $/h', type: 'num' }]} />
          </div>
          <div className="card span-6">
            <div className="card-title">Étapes d'assemblage (coût horaire $)</div>
            <EditTable rows={R.assembly || []} onChange={setRefs('assembly')} newRow={{ name: '', machineCost: 0, labor: 3 }}
              columns={[{ key: 'name', label: 'Étape', type: 'text' }, { key: 'machineCost', label: 'Machine $/h', type: 'num' }, { key: 'labor', label: 'MOD $/h', type: 'num' }]} />
          </div>
        </div>
      )}
    </>
  )
}
