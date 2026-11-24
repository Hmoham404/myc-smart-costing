import { useState } from 'react'
import { Library as LibIcon } from 'lucide-react'
import EditTable from '../components/EditTable'
import { useLibrary, LIBRARY_KINDS } from '../lib/project/useLibrary'

/** Bibliothèque partagée des projets : utilisée automatiquement par le chiffrage, le CBN et la conception 3D */
export default function Library() {
  const { lib, save, error } = useLibrary()
  const [kind, setKind] = useState('materials')
  const def = LIBRARY_KINDS[kind]
  const blank = Object.fromEntries(def.cols.map(([k, , t]) => [k, t === 'num' ? 0 : '']))
  return (
    <>
      <div className="page-header"><h1><LibIcon size={22} /> Bibliothèque</h1></div>
      {error && <div className="db-warning"><b>Table bibliothèque absente.</b> Exécutez <code>supabase/schema.sql</code> puis <code>supabase/seed_projets.sql</code>.<div className="card-sub">{error}</div></div>}
      <div className="tabs">
        {Object.entries(LIBRARY_KINDS).map(([k, d]) => (
          <button key={k} className={`tab-btn ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{d.label} <span className="pill brouillon">{(lib[k] || []).length}</span></button>
        ))}
      </div>
      <div className="card">
        <EditTable rows={lib[kind] || []} onChange={(rows) => save(kind, rows)} newRow={blank}
          columns={def.cols.map(([key, label, type]) => ({ key, label, type, dec: type === 'num' ? 4 : undefined }))} />
        <div className="card-sub" style={{ marginTop: 8 }}>
          Enregistrement automatique. Les projets utilisent ces prix et taux horaires par leur nom ; la densité des matières sert au calcul de la masse en conception 3D.
        </div>
      </div>
    </>
  )
}
