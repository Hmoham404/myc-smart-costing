import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LineChart as LineIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useApp } from '../context/AppContext'
import { computeCosting, commercialTiers, coefForQuantity } from '../lib/engine'
import { DEFAULT_PRODUCT } from '../lib/defaults'
import { Field, NumInput, Seg, Kpi } from '../components/ui'
import { money, num } from '../lib/format'

const GRID_LABEL = {
  known_standard: 'Client connu — couleur standard',
  known_special: 'Client connu — couleur spéciale',
  new_standard: 'Nouveau petit client — standard',
  new_special: 'Nouveau petit client — spéciale',
}

export default function Simulator() {
  const { params: P } = useApp()
  const loc = useLocation()
  const product = loc.state?.product || DEFAULT_PRODUCT
  const calc = useMemo(() => computeCosting({ ...product, quantity: 50000 }, P, 'excel'), [product, P])
  const [base, setBase] = useState(Number(calc.totals.finalPrice.toFixed(4)))
  const [clientType, setClientType] = useState(product.client_type || 'known')
  const [color, setColor] = useState(product.color || 'standard')
  const [qty, setQty] = useState(15000)
  const [cnPrice, setCnPrice] = useState(0.1463876689916473)

  const tiers = commercialTiers(base, P, clientType, color)
  const chart = tiers.map((t) => ({ name: t.key, 'Prix unitaire': +t.unit.toFixed(4), 'Prix de revient': +calc.totals.unitCost.toFixed(4) }))
  const coef = coefForQuantity(qty, P, clientType, color)
  const unit = base * coef
  const handling = qty < P.handling_cost.below_qty ? P.handling_cost.amount : 0

  return (
    <>
      <div className="page-header"><h1><LineIcon size={24} style={{ verticalAlign: -3 }} /> Simulateur commercial</h1></div>
      <div className="card">
        <div className="card-title">Prix de base X (prix TN pour 50K)</div>
        <div className="grid g4">
          <Field label="X — prix 50K ($)" hint={`Calculé pour ${product.client} / ${product.reference} : ${money(calc.totals.finalPrice)}`}>
            <NumInput value={base} onChange={setBase} />
          </Field>
          <Field label="Type de client"><Seg value={clientType} onChange={setClientType} options={[['known', 'Connu'], ['new', 'Nouveau']]} /></Field>
          <Field label="Couleur"><Seg value={color} onChange={setColor} options={[['standard', 'Standard'], ['special', 'Spéciale']]} /></Field>
          <Field label="Prix de revient (référence)"><input readOnly value={money(calc.totals.unitCost)} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Grille de prix par quantité</div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Palier</th>{tiers.map((t) => <th key={t.key} className="num">{t.key}</th>)}</tr></thead>
            <tbody>
              <tr><td>Coefficient</td>{tiers.map((t) => <td key={t.key} className="num">× {t.coef}</td>)}</tr>
              <tr><td><b>Prix unitaire</b></td>{tiers.map((t) => <td key={t.key} className="num"><b>{money(t.unit)}</b></td>)}</tr>
              <tr><td>Frais de handling</td>{tiers.map((t) => <td key={t.key} className="num">{t.handling ? money(t.handling, 'USD', 0) : '—'}</td>)}</tr>
              <tr><td>Montant total</td>{tiers.map((t) => <td key={t.key} className="num">{money(t.total, 'USD', 2)}</td>)}</tr>
              <tr><td>Marge / pièce</td>{tiers.map((t) => <td key={t.key} className="num">{money(t.unit - calc.totals.unitCost)}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <div style={{ height: 260, marginTop: 12 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" /><YAxis />
              <Tooltip formatter={(v) => money(v)} /><Legend />
              <Bar isAnimationActive={false} dataKey="Prix unitaire" fill="#1877f2" radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Prix de revient" fill="#ced0d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-title">Quantité libre</div>
          <Field label="Quantité"><NumInput value={qty} onChange={setQty} /></Field>
          <div className="kpis" style={{ marginTop: 12 }}>
            <Kpi label="Coefficient" value={`× ${coef}`} />
            <Kpi label="Prix unitaire" value={money(unit)} hero />
            <Kpi label="Total HT" value={money(unit * qty + handling, 'USD', 2)} />
          </div>
          {handling > 0 && <div className="alert warning" style={{ marginTop: 12 }}><div><b>Frais de handling</b>Quantité &lt; {num(P.handling_cost.below_qty)} : +{P.handling_cost.amount} $ inclus.</div></div>}
        </div>
        <div className="card">
          <div className="card-title">Conversion prix Chine → Tunisie</div>
          <Field label="Prix CN Y ($)" hint="Feuille QUOTATION STANDARD FORMULA : X = 1,65 Y"><NumInput value={cnPrice} onChange={setCnPrice} /></Field>
          <div className="kpis" style={{ marginTop: 12 }}>
            <Kpi label="Prix TN X (50K)" value={money(cnPrice * P.cn_to_tn_factor)} hero />
            <Kpi label="Écart vs calcul" value={money(cnPrice * P.cn_to_tn_factor - calc.totals.finalPrice)} />
          </div>
          <button className="btn btn-soft" style={{ marginTop: 12 }} onClick={() => setBase(+(cnPrice * P.cn_to_tn_factor).toFixed(4))}>Utiliser comme X</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Matrice des coefficients MYC</div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Catégorie</th>{P.tiers.map((t) => <th key={t.key} className="num">{t.key}</th>)}</tr></thead>
            <tbody>
              {Object.entries(P.commercial_grid).map(([k, arr]) => (
                <tr key={k} style={k === `${clientType}_${color}` ? { background: 'var(--blue-soft)' } : null}>
                  <td>{GRID_LABEL[k]}</td>{arr.map((c, i) => <td key={i} className="num">{c} X</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
