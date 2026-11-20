// Palette graphique validée (scripts/validate_palette.js — clair & sombre)
import { useApp } from '../context/AppContext'

const PALETTES = {
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', grid: '#e3e7ef', axis: '#64748b', ref: '#0f172a', neutral: '#94a3b8', good: '#16a34a', bad: '#dc2626' },
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', grid: '#243044', axis: '#8b97a8', ref: '#e5e9f0', neutral: '#64748b', good: '#22c55e', bad: '#f87171' },
}

export function useViz() {
  const { theme } = useApp()
  return PALETTES[theme === 'dark' ? 'dark' : 'light']
}

export const axisProps = (c) => ({
  stroke: c.axis, tick: { fill: c.axis, fontSize: 11 }, tickLine: false, axisLine: { stroke: c.grid },
})

/** Tooltip au format de l'application (valeurs en encre texte, pastille couleur = identité) */
export function VizTooltip({ active, payload, label, labelFmt, fmt }) {
  if (!active || !payload?.length) return null
  return (
    <div className="viz-tip">
      <div className="tt">{labelFmt ? labelFmt(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="row">
          <span className="sw" style={{ background: p.color || p.stroke || p.fill }} />
          <span>{p.name}</span>
          <b style={{ marginLeft: 'auto', paddingLeft: 12 }}>{fmt ? fmt(p.value, p.dataKey) : p.value}</b>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="legend" style={{ marginBottom: 8 }}>
      {items.map(([label, color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}
    </div>
  )
}
