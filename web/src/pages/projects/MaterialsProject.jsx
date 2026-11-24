import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { computeMaterials } from '../../lib/materials'
import EditTable from '../../components/EditTable'
import { NumInput } from '../../components/ui'
import { useViz, axisProps, VizTooltip, Legend } from '../../components/viz'
import { money, num } from '../../lib/format'

export default function MaterialsProject({ data, setData }) {
  const c = useViz()
  const r = useMemo(() => computeMaterials(data), [data])
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: v }))
  const chart = r.items.map((it) => ({ name: it.name, resin: +it.resinKg.toFixed(1), mb: +it.mbKg.toFixed(1) }))

  return (
    <>
      <div className="dash">
        <div className="card span-7">
          <div className="card-title">Matières à commander</div>
          <table className="t">
            <thead><tr><th>Matière</th><th className="num">Quantité (kg)</th><th className="num">Prix ($/kg)</th><th className="num">Montant</th></tr></thead>
            <tbody>
              {r.orders.map((o) => (
                <tr key={o.name}>
                  <td><b>{o.name}</b></td>
                  <td className="num"><b>{num(o.kg, 1)}</b></td>
                  <td className="num"><NumInput className="input num-in" value={(data.prices || {})[o.name] || 0} onChange={(v) => setData((d) => ({ ...d, prices: { ...(d.prices || {}), [o.name]: v } }))} /></td>
                  <td className="num">{o.price ? money(o.amount, 'USD', 2) : '—'}</td>
                </tr>
              ))}
              <tr><td><b>Total</b></td><td className="num"><b>{num(r.totalKg, 1)} kg</b></td><td /><td className="num"><b>{r.totalAmount ? money(r.totalAmount, 'USD', 2) : '—'}</b></td></tr>
            </tbody>
          </table>
          {data.note && <div className="alert info" style={{ marginTop: 10 }}><div><b>Note du classeur</b>{data.note}</div></div>}
        </div>
        <div className="card span-5">
          <div className="card-title">Besoin par pièce (kg)</div>
          <Legend items={[['Résine', c.s1], ['Mélange maître', c.s2]]} />
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps(c)} /><YAxis {...axisProps(c)} width={50} />
                <Tooltip content={<VizTooltip fmt={(v) => `${num(v, 1)} kg`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey="resin" name="Résine" stackId="a" fill={c.s1} />
                <Bar isAnimationActive={false} dataKey="mb" name="Mélange maître" stackId="a" fill={c.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">1. Quantités à produire (rebuts en cascade)</div>
        <EditTable rows={data.items || []} onChange={set('items')}
          newRow={{ name: 'PIÈCE', reference: '', planned: 100000, scrapInjection: 0.03, scrapDecoration: 0, scrapPainting: 0, scrapAssembly: 0.03, resin: data.items?.[0]?.resin || '', masterbatch: data.items?.[0]?.masterbatch || '', resinShare: 0.92, unitWeight: 10, cavities: 8, runnerWeight: 0, recyclingRate: 0, startupCycles: 100 }}
          columns={[
            { key: 'name', label: 'Pièce', type: 'text' }, { key: 'reference', label: 'Référence', type: 'text' }, { key: 'planned', label: 'Prévu', type: 'num', dec: 0 },
            { key: 'scrapInjection', label: 'Rebut inj. %', type: 'pct' }, { key: 'scrapDecoration', label: 'SS/HS %', type: 'pct' },
            { key: 'scrapPainting', label: 'Peinture %', type: 'pct' }, { key: 'scrapAssembly', label: 'Assemb. %', type: 'pct' },
            { key: 'tp', label: 'À produire', type: 'calc', value: (_, i) => num(r.items[i]?.toProduce, 0) },
          ]} />
      </div>
      <div className="card">
        <div className="card-title">2. Données d'injection et besoin matière</div>
        <EditTable rows={data.items || []} onChange={set('items')}
          columns={[
            { key: 'name', label: 'Pièce', type: 'calc', value: (row) => row.name },
            { key: 'resin', label: 'Résine', type: 'text' }, { key: 'masterbatch', label: 'Mélange maître', type: 'text' },
            { key: 'resinShare', label: '% résine', type: 'pct' }, { key: 'unitWeight', label: 'Poids (g)', type: 'num' },
            { key: 'cavities', label: 'Empreintes', type: 'num', dec: 0 }, { key: 'runnerWeight', label: 'Carotte (g)', type: 'num' },
            { key: 'startupCycles', label: 'Cycles démarrage', type: 'num', dec: 0 }, { key: 'recyclingRate', label: 'Recyclage %', type: 'pct' },
            { key: 'shots', label: 'Coups', type: 'calc', value: (_, i) => num(r.items[i]?.shots, 0) },
            { key: 'rk', label: 'Résine (kg)', type: 'calc', value: (_, i) => num(r.items[i]?.resinKg, 1) },
            { key: 'mk', label: 'MB (kg)', type: 'calc', value: (_, i) => num(r.items[i]?.mbKg, 1) },
          ]} />
        <div className="card-sub" style={{ marginTop: 8 }}>Formule du classeur : kg = (⌈quantité ÷ empreintes⌉ + cycles de démarrage) × (poids × empreintes + carotte) ÷ 1 000 × part. Le taux de recyclage est saisi mais n'entre pas dans le calcul (comme dans Excel).</div>
      </div>
    </>
  )
}
