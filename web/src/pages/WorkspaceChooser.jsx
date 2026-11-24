import { Calculator, FolderKanban, ArrowRight, LogOut, Moon, Sun } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Avatar } from '../components/ui'
import Logo from '../components/Logo'
import LanguageBar from '../components/LanguageBar'
import { ROLE_LABEL } from '../lib/format'

/** Choix de l'espace de travail (direction / admin) : Métallisation (Slah) ou Projets (Seif). */
export default function WorkspaceChooser() {
  const { profile, setWorkspace, signOut, theme, toggleTheme } = useApp()
  const spaces = [
    {
      key: 'metal', icon: Calculator, title: 'Espace Métallisation', owner: 'Slah Dridi',
      desc: 'Chiffrage des pièces métallisées : calculateur, simulateur, devis, échantillons, pièces 3D, coût peinture, paramètres, assistant IA.',
    },
    {
      key: 'projects', icon: FolderKanban, title: 'Espace Projets', owner: 'Seif',
      desc: 'Projets injection : chiffrage injection, besoin matière, capacité & planning (KIKO, SEPHORA…).',
    },
  ]
  return (
    <div className="ws-page">
      <div className="auth-top" style={{ padding: '20px 32px 0' }}>
        <LanguageBar />
        <button className="icon-btn" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      </div>
      <div className="ws-center">
        <Logo height={52} style={{ alignSelf: 'center', marginBottom: 18 }} />
        <div className="ws-who"><Avatar name={profile.full_name} size={44} /><div><b>Bonjour {profile.full_name.split(' ')[0]}</b><span className="card-sub">{ROLE_LABEL[profile.role]}</span></div></div>
        <h2>Quel espace voulez-vous ouvrir ?</h2>
        <div className="ws-grid">
          {spaces.map(({ key, icon: I, title, owner, desc }) => (
            <button key={key} className={`ws-card ws-${key}`} onClick={() => setWorkspace(key)}>
              <span className="ws-icon"><I size={28} /></span>
              <b>{title}</b>
              <span className="ws-owner"><Avatar name={owner} size={22} /> Espace de {owner}</span>
              <span className="card-sub">{desc}</span>
              <span className="ws-go">Ouvrir <ArrowRight size={16} /></span>
            </button>
          ))}
        </div>
        <button className="btn btn-light" style={{ marginTop: 22 }} onClick={signOut}><LogOut size={15} /> Changer de profil</button>
      </div>
    </div>
  )
}
