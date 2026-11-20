import { useEffect, useState } from 'react'
import { initials } from '../lib/format'

const COLORS = ['#1877f2', '#42b72a', '#f02849', '#f7b928', '#8a3ffc', '#00a3a3', '#e8710a']
export const colorFor = (s = '') => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]

export function Avatar({ name = '?', size = 40, color }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: color || colorFor(name) }}>
      {initials(name)}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

/** Champ numérique : accepte la virgule décimale */
export function NumInput({ value, onChange, step = 'any', ...rest }) {
  const [txt, setTxt] = useState(value ?? '')
  useEffect(() => {
    const parsed = parseFloat(String(txt).replace(',', '.'))
    if (parsed !== Number(value)) setTxt(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value)
        const v = parseFloat(e.target.value.replace(',', '.'))
        onChange(Number.isFinite(v) ? v : 0)
      }}
      {...rest}
    />
  )
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export function Kpi({ label, value, hero }) {
  return (
    <div className={`kpi ${hero ? 'hero' : ''}`}>
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t) } }, [msg])
  return [msg ? <div className="toast">{msg}</div> : null, setMsg]
}
