import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { findIn } from '../../lib/project/engine'
import { useViz, axisProps, VizTooltip, Legend } from '../../components/viz'
import { money, num, pct } from '../../lib/format'

/** Onglet Calcul des besoins nets (formules YZA067A) */
export default function CBN({ data, lib, res }) {
  const c = useViz()
  const r = res.cbn
  const priceOf = (name) => Number(findIn(lib.materials, name)?.price ?? findIn(lib.masterbatches, name)?.price) || 0
  const orders = r.orders.map((o) => ({ ...o, price: priceOf(o.name), amount: o.kg * priceOf(o.name) }))
  const chart = r.items.map((it) => ({ name: it.name, resin: +it.resinKg.toFixed(1), mb: +it.mbKg.toFixed(1) }))

  return (
    <>
      <div className="dash">
        <div className="card span-7">
          <div className="card-title">Matières à commander — {num(data.quantity)} produits finis</div>
          <table className="t">
            <thead><tr><th>Matière</th><th className="num">Quantité (kg)</th><th className="num">Prix ($/kg)</th><th className="num">Montant</th></tr></thead>
            <tbody>
              {orders.map((o) => <tr key={o.name}><td><b>{o.name}</b></td><td className="num"><b>{num(o.kg, 1)}</b></td><td className="num">{o.price ? num(o.price, 2) : <span className="card-sub">bibliothèque</span>}</td><td className="num">{o.price ? money(o.amount, 'USD', 2) : '—'}</td></tr>)}
              <tr><td><b>Total</b></td><td className="num"><b>{num(r.totalKg, 1)} kg</b></td><td /><td className="num"><b>{money(orders.reduce((a, o) => a + o.amount, 0), 'USD', 2)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="card span-5">
          <div className="card-title">Besoin par pièce (kg)</div>
          <Legend items={[['Résine', c.s1], ['Mélange maître', c.s2]]} />
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid stroke={c.grid} vertical={false} /><XAxis dataKey="name" {...axisProps(c)} /><YAxis {...axisProps(c)} width={50} />
                <Tooltip content={<VizTooltip fmt={(v) => `${num(v, 1)} kg`} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey="resin" name="Résine" stackId="a" fill={c.s1} />
                <Bar isAnimationActive={false} dataKey="mb" name="Mélange maître" stackId="a" fill={c.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Quantités à produire — rebuts en cascade</div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Pièce</th><th className="num">Besoin</th><th className="num">Rebut injection</th><th className="num">Rebut SS/HS</th><th className="num">Rebut peinture / métal.</th><th className="num">Rebut assemblage</th><th className="num">À produire</th></tr></thead>
            <tbody>{r.items.map((it) => (
              <tr key={it.id}><td><b>{it.name}</b> <span className="card-sub">{it.reference}</span></td><td className="num">{num(it.planned)}</td>
                <td className="num">{num(it.scrap.injection)} <span className="card-sub">({pct(it.rates.injection, 1)})</span></td>
                <td className="num">{num(it.scrap.decoration)} <span className="card-sub">({pct(it.rates.decoration, 1)})</span></td>
                <td className="num">{num(it.scrap.painting)} <span className="card-sub">({pct(it.rates.painting, 1)})</span></td>
                <td className="num">{num(it.scrap.assembly)} <span className="card-sub">({pct(it.rates.assembly, 1)})</span></td>
                <td className="num"><b>{num(it.toProduce)}</b></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card-sub" style={{ marginTop: 6 }}>Les taux viennent de la pièce (injection) et des opérations qui la concernent (onglet Définition). Chaque rebut s'applique à la quantité cumulée de l'étape précédente.</div>
      </div>

      <div className="card">
        <div className="card-title">Besoin matière par pièce</div>
        <table className="t">
          <thead><tr><th>Pièce</th><th>Matière</th><th className="num">Empreintes</th><th className="num">Poids / injection (g)</th><th className="num">Coups (+ démarrage)</th><th className="num">Total (kg)</th><th className="num">Résine (kg)</th><th className="num">MB (kg)</th></tr></thead>
          <tbody>{r.items.map((it) => {
            const comp = data.components.find((x) => x.id === it.id)
            return (
              <tr key={it.id}><td><b>{it.name}</b></td><td>{it.material || '—'}{it.masterbatch ? ` + ${it.masterbatch}` : ''}</td><td className="num">{comp?.cavities}</td>
                <td className="num">{num(it.shotWeight, 2)}</td><td className="num">{num(it.shots)}</td><td className="num">{num(it.totalKg, 1)}</td>
                <td className="num"><b>{num(it.resinKg, 1)}</b></td><td className="num">{num(it.mbKg, 1)}</td></tr>
            )
          })}</tbody>
        </table>
        <div className="card-sub" style={{ marginTop: 6 }}>kg = (⌈à produire ÷ empreintes⌉ + cycles de démarrage) × (poids net × empreintes + carotte) ÷ 1000, réparti résine / mélange maître.</div>
      </div>
    </>
  )
}
