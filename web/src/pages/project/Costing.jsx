import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import EditTable from '../../components/EditTable'
import { NumInput } from '../../components/ui'
import { SECTION_LABEL, CATEGORIES } from '../../lib/project/engine'
import { useViz, axisProps, VizTooltip } from '../../components/viz'
import { money, num, pct } from '../../lib/format'

const $ = (v, d = 4) => money(v, 'USD', d)

/** Onglet Chiffrage (formules YZA089A) */
export default function Costing({ data, setData, lib, res }) {
  const c = useViz()
  const r = res.costing
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: v }))
  const sections = Object.entries(r.sections).filter(([, v]) => v > 0).map(([k, v]) => ({ name: SECTION_LABEL[k], v }))
  const PAL = [c.s1, c.s2, c.s3]
  const names = (k) => (lib[k] || []).map((x) => x.name)

  return (
    <>
      <div className="dash">
        <div className="card span-8">
          <div className="kpis">
            <div className="kpi hero"><div className="k-label">Coût de revient / pièce</div><div className="k-value">{$(r.total)}</div></div>
            <div className="kpi"><div className="k-label">Prix de vente</div><div className="k-value">{$(r.salePrice)}</div><div className="k-delta flat">marge {pct(data.margin || 0, 1)}</div></div>
            <div className="kpi"><div className="k-label">Coût de la commande</div><div className="k-value">{$(r.orderCost, 0)}</div><div className="k-delta flat">{num(data.quantity)} pièces</div></div>
            <div className="kpi"><div className="k-label">Chiffre d'affaires</div><div className="k-value">{$(r.salePrice * (data.quantity || 0), 0)}</div></div>
          </div>
          <div className="grid g3" style={{ marginTop: 14 }}>
            <div className="field"><label>Marge commerciale (%)</label><NumInput value={+((data.margin || 0) * 100).toFixed(2)} onChange={(v) => set('margin')(v / 100)} /></div>
            <div className="field"><label>Transport ($ / pièce)</label><NumInput value={data.transport || 0} onChange={set('transport')} /></div>
          </div>
          {r.missing.length > 0 && (
            <div className="alert warning" style={{ marginTop: 12 }}><AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} />
              <div><b>Données à compléter</b>{r.missing.join(' · ')}</div></div>
          )}
        </div>
        <div className="card span-4">
          <div className="card-title">Structure du coût</div>
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <BarChart data={sections} layout="vertical" margin={{ left: 0, right: 14 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={130} {...axisProps(c)} axisLine={false} />
                <Tooltip content={<VizTooltip fmt={(v) => `${$(v)} (${pct(v / (r.total || 1), 0)})`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey="v" name="Coût / pièce" radius={[0, 4, 4, 0]} barSize={14}>{sections.map((_, i) => <Cell key={i} fill={PAL[i % 3]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">1. Matière par pièce <span className="spacer" /><b>{$(r.sections.resin)}</b></div>
        <table className="t">
          <thead><tr><th>Pièce</th><th className="num">Poids unitaire (g)</th><th className="num">Prix matière ($/kg)</th><th className="num">Coût</th></tr></thead>
          <tbody>{r.resin.map((x) => <tr key={x.id}><td><b>{x.name}</b></td><td className="num">{num(x.unitWeight, 2)}</td><td className="num">{num(x.price, 2)}</td><td className="num">{$(x.cost)}</td></tr>)}</tbody>
        </table>
        <div className="card-sub" style={{ marginTop: 6 }}>Poids unitaire = poids net + carotte ÷ empreintes · coût = prix ÷ 1000 × poids × qté/produit × (1 + rebut injection).</div>
      </div>

      <div className="card">
        <div className="card-title">2. Opérations <span className="spacer" /><b>{$(r.sections.injection + r.sections.decoration + r.sections.metallization + r.sections.assembly)}</b></div>
        <table className="t">
          <thead><tr><th>Opération</th><th>Procédé</th><th className="num">Cadence / h (1 machine)</th><th className="num">MOD $/h</th><th className="num">Machine $/h</th><th className="num">Coût / pièce</th></tr></thead>
          <tbody>{r.ops.map((o) => (
            <tr key={o.id}><td><b>{o.label}</b></td><td className="card-sub">{CATEGORIES[o.category]}</td><td className="num">{num(o.capacity, 0)}</td>
              <td className="num">{num(o.labor, 2)}</td><td className="num">{num(o.machineCost, 2)}</td><td className="num">{$(o.cost)}</td></tr>
          ))}</tbody>
        </table>
        <div className="card-sub" style={{ marginTop: 6 }}>Coût = (machine + MOD × opérateurs) ÷ cadence × (1 + rebut) ; décoration : + prix encre × grammes ÷ 1000. Les taux horaires viennent de la bibliothèque.</div>
      </div>

      <div className="dash">
        <div className="card span-5">
          <div className="card-title">3. Composants achetés <span className="spacer" /><b>{$(r.sections.purchased)}</b></div>
          <EditTable rows={data.purchased || []} onChange={set('purchased')} newRow={{ name: names('components')[0] || '', qty: 1, reject: 0.03 }}
            columns={[{ key: 'name', label: 'Composant', type: 'select', options: names('components') }, { key: 'qty', label: 'Qté / produit', type: 'num' },
              { key: 'reject', label: 'Rebut %', type: 'pct' }, { key: 'c', label: 'Coût', type: 'calc', value: (_, i) => $(r.purchased[i]?.cost) }]} />
        </div>
        <div className="card span-7">
          <div className="card-title">4. Emballage <span className="spacer" /><b>{$(r.sections.packing)}</b></div>
          <div className="grid g3" style={{ marginBottom: 8 }}>
            <div className="field"><label>Couches / carton</label><NumInput value={data.packing?.layers || 0} onChange={(v) => setData((d) => ({ ...d, packing: { ...d.packing, layers: v } }))} /></div>
            <div className="field"><label>Pièces / couche</label><NumInput value={data.packing?.perLayer || 0} onChange={(v) => setData((d) => ({ ...d, packing: { ...d.packing, perLayer: v } }))} /></div>
            <div className="field"><label>Pièces / carton</label><input readOnly value={num(r.perCarton)} /></div>
          </div>
          <EditTable rows={data.packing?.items || []} onChange={(v) => setData((d) => ({ ...d, packing: { ...d.packing, items: v } }))} newRow={{ name: names('packaging')[0] || '', qty: 1 }}
            columns={[{ key: 'name', label: 'Article', type: 'select', options: names('packaging') }, { key: 'qty', label: 'Qté / carton', type: 'num' },
              { key: 'u', label: 'Prix', type: 'calc', value: (_, i) => $(r.packItems[i]?.unit) }, { key: 't', label: 'Total carton', type: 'calc', value: (_, i) => $(r.packItems[i]?.total, 3) }]} />
        </div>
      </div>
    </>
  )
}
