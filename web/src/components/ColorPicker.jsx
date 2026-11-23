import { Link } from 'react-router-dom'

/** Choix de la teinte (couleurs enregistrées en ligne). null = système peinture des paramètres. */
export default function ColorPicker({ colors, value, onChange }) {
  return (
    <div className="field">
      <label>Teinte (recette peinture) — <Link to="/peinture">gérer les couleurs</Link></label>
      <div className="color-select">
        <button type="button" className={`color-chip ${!value ? 'on' : ''}`} onClick={() => onChange(null)}>
          <i style={{ background: 'repeating-linear-gradient(45deg,#cbd5e1 0 3px,#f1f5f9 3px 6px)' }} />Paramètres par défaut
        </button>
        {colors.map((c) => (
          <button key={c.id} type="button" className={`color-chip ${value === c.id ? 'on' : ''}`} onClick={() => onChange(c)} title={c.family === 'special' ? 'Couleur spéciale' : 'Standard'}>
            <i style={{ background: c.metallic ? `linear-gradient(135deg,#fff 0%,${c.hex} 50%,#333 120%)` : c.hex }} />{c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
