import { useEffect, useState } from 'react'
import { Plus, X, ShieldCheck, Calculator, LineChart, Sparkles, ChevronRight, Moon, Sun } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Avatar } from '../components/ui'
import Logo from '../components/Logo'
import LanguageBar from '../components/LanguageBar'
import { ROLE_LABEL } from '../lib/format'

const ROLE_ORDER = { directeur: 0, admin: 1, ingenieur: 2, commercial: 3 }

/** Écran d'entrée sans mot de passe : choisir son compte dans la liste de l'équipe. */
export default function Login() {
  const { selectProfile, theme, toggleTheme } = useApp()
  const [profiles, setProfiles] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ full_name: '', job_title: '', role: 'ingenieur' })
  const [last, setLast] = useState(() => { try { return localStorage.getItem('myc_last_profile') } catch { return null } })

  useEffect(() => {
    supabase.from('mc_profiles').select('*').order('created_at').then(({ data, error }) => {
      if (error) setErr(error.message)
      setProfiles((data || []).sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)))
      setLoading(false)
    })
  }, [])

  const enter = (id) => {
    try { localStorage.setItem('myc_last_profile', id) } catch { /* ignore */ }
    setLast(id)
    selectProfile(id)
  }

  const create = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim()) return
    const { data, error } = await supabase.from('mc_profiles').insert({ ...form, full_name: form.full_name.trim() }).select('id').single()
    if (error) { setErr(error.message); return }
    enter(data.id)
  }

  const recent = profiles.find((p) => p.id === last)

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Logo tone="light" height={64} />
        <h1>MYC Smart <span>Metallization</span> Costing</h1>
        <p>Le chiffrage des pièces métallisées, fiable, traçable et assisté par l'IA.</p>
        <ul className="auth-features">
          <li><Calculator size={18} /> Formules Excel de Slah reproduites au centime près</li>
          <li><LineChart size={18} /> Analyse what-if : l'effet de chaque valeur en courbe</li>
          <li><Sparkles size={18} /> Assistant IA pour fixer et atteindre vos objectifs</li>
          <li><ShieldCheck size={18} /> Devis validés par la direction avant envoi</li>
        </ul>
        <div className="auth-foot">MYC Beauty Innovation Tunisia</div>
      </aside>

      <main className="auth-main">
        <div className="auth-top">
          <LanguageBar />
          <button className="icon-btn" onClick={toggleTheme} title="Thème">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>

        <div className="auth-panel">
          <h2>Choisissez votre compte</h2>
          <p className="card-sub" style={{ fontSize: 14, marginBottom: 22 }}>Cliquez sur votre profil pour entrer dans l'application.</p>

          {err && (
            <div className="db-warning">
              <b>Base non initialisée.</b> Exécutez <code>supabase/schema.sql</code> dans Supabase → SQL Editor, puis rechargez la page.
              <div className="card-sub">Détail : {err}</div>
            </div>
          )}
          {loading && <div className="card-sub">Chargement…</div>}

          {recent && (
            <button className="account-recent" onClick={() => enter(recent.id)}>
              <Avatar name={recent.full_name} size={52} />
              <div style={{ flex: 1, textAlign: 'start' }}>
                <div className="card-sub">Continuer en tant que</div>
                <b style={{ fontSize: 17 }}>{recent.full_name}</b>
              </div>
              <ChevronRight size={20} />
            </button>
          )}

          <div className="account-grid">
            {profiles.map((p) => (
              <button key={p.id} className="account-card" onClick={() => enter(p.id)}>
                <span className={`role-chip ${p.role}`}>{ROLE_LABEL[p.role]}</span>
                <Avatar name={p.full_name} size={72} />
                <b>{p.full_name}</b>
                <span className="card-sub">{p.job_title || ROLE_LABEL[p.role]}</span>
              </button>
            ))}
            {!err && !loading && (
              <button className="account-card add" onClick={() => setAdding(true)}>
                <span className="add-circle"><Plus size={30} /></span>
                <b>Ajouter un compte</b>
                <span className="card-sub">Nouveau membre de l'équipe</span>
              </button>
            )}
          </div>

          {adding && (
            <form className="card" style={{ marginTop: 18 }} onSubmit={create}>
              <div className="card-title">Nouveau compte <span className="spacer" /><button type="button" className="icon-btn" onClick={() => setAdding(false)}><X size={16} /></button></div>
              <div className="grid g3">
                <div className="field"><label>Nom complet</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required autoFocus /></div>
                <div className="field"><label>Fonction</label><input value={form.job_title} placeholder="ex. Ingénieur méthodes" onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
                <div className="field"><label>Rôle</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 14 }}>Créer et entrer</button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
