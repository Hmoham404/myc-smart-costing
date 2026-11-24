import { Plus, Trash2 } from 'lucide-react'
import { NumInput } from './ui'
import { num } from '../lib/format'

/**
 * Tableau éditable générique.
 * columns: [{ key, label, type: 'text'|'num'|'pct'|'select'|'calc', options?, width?, dec?, value?(row, i) }]
 * 'pct' : stocké en fraction (0,03), affiché en % (3) ; 'calc' : lecture seule via value(row, i)
 */
export default function EditTable({ columns, rows, onChange, newRow, minRows = 0, footer }) {
  const set = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  return (
    <div className="table-wrap">
      <table className="t edit-t">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} className={c.type === 'text' || c.type === 'select' ? '' : 'num'} style={{ width: c.width }}>{c.label}</th>)}
            {onChange && newRow && <th style={{ width: 40 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => {
                if (c.type === 'calc') return <td key={c.key} className="num calc">{c.value(r, i)}</td>
                if (!onChange) return <td key={c.key} className={c.type === 'text' || c.type === 'select' ? '' : 'num'}>{c.type === 'pct' ? `${num((r[c.key] || 0) * 100, 2)} %` : c.type === 'num' ? num(r[c.key], c.dec ?? 2) : r[c.key]}</td>
                if (c.type === 'select') {
                  const opts = typeof c.options === 'function' ? c.options(r) : c.options
                  return (
                    <td key={c.key}><select className="input" value={r[c.key] ?? ''} onChange={(e) => set(i, c.key, e.target.value)}>
                      {!opts.some((o) => (o.value ?? o) === r[c.key]) && <option value={r[c.key] ?? ''}>{r[c.key] || '—'}</option>}
                      {opts.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
                    </select></td>
                  )
                }
                if (c.type === 'text') return <td key={c.key}><input className="input" value={r[c.key] ?? ''} onChange={(e) => set(i, c.key, e.target.value)} /></td>
                if (c.type === 'pct') return <td key={c.key} className="num"><NumInput className="input num-in" value={+((Number(r[c.key]) || 0) * 100).toFixed(4)} onChange={(v) => set(i, c.key, v / 100)} /></td>
                return <td key={c.key} className="num"><NumInput className="input num-in" value={r[c.key] ?? 0} onChange={(v) => set(i, c.key, v)} /></td>
              })}
              {onChange && newRow && (
                <td><button className="btn btn-danger" style={{ padding: '3px 6px' }} disabled={rows.length <= minRows} onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={12} /></button></td>
              )}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
      {onChange && newRow && <button className="btn btn-light" style={{ marginTop: 6 }} onClick={() => onChange([...rows, typeof newRow === 'function' ? newRow() : { ...newRow }])}><Plus size={13} /> Ligne</button>}
    </div>
  )
}
