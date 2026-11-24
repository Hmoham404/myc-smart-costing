import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calculator, LineChart, FileText, FlaskConical, Bell, LogOut, Search, Package, SlidersHorizontal,
  Sparkles, History, Users, Target, Box, Droplets, FolderKanban, ArrowLeftRight, Library, Activity, Moon, Sun, PanelLeftClose, PanelLeftOpen, Gauge,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Avatar } from './ui'
import Logo from './Logo'
import LanguageBar from './LanguageBar'
import { ROLE_LABEL, timeAgo } from '../lib/format'

export const NAV_GROUPS = [
  ['Pilotage', [
    ['/', LayoutDashboard, 'Tableau de bord'],
    ['/analyse', Gauge, 'Analyse what-if'],
    ['/objectifs', Target, 'Objectifs & IA'],
  ]],
  ['Calcul des coûts', [
    ['/calculateur', Calculator, 'Calculateur'],
    ['/simulateur', LineChart, 'Simulateur commercial'],
    ['/historique', History, 'Historique'],
  ]],
  ['Commercial', [
    ['/devis', FileText, 'Devis', 'pending'],
    ['/echantillons', FlaskConical, 'Échantillons'],
  ]],
  ['Données', [
    ['/pieces-3d', Box, 'Pièces 3D'],
    ['/produits', Package, 'Produits & clients'],
    ['/peinture', Droplets, 'Coût peinture'],
    ['/parametres', SlidersHorizontal, 'Paramètres'],
  ]],
  ['Équipe', [
    ['/assistant', Sparkles, 'Assistant IA'],
    ['/activite', Activity, 'Activité'],
    ['/equipe', Users, 'Équipe'],
  ]],
]
export const PROJECT_GROUPS = [
  ['Projets', [
    ['/', LayoutDashboard, 'Tableau de bord'],
    ['/projets', FolderKanban, 'Mes projets'],
  ]],
  ['Données', [
    ['/bibliotheque', Library, 'Bibliothèque'],
  ]],
]
const WS = {
  metal: { groups: NAV_GROUPS, label: 'Espace Métallisation', foot: 'MYC Smart Metallization Costing · Formules : Slah Dridi · Validation : M. Sami Ladjimi' },
  projects: { groups: PROJECT_GROUPS, label: 'Espace Projets', foot: 'MYC Projets injection · Chiffrage, besoin matière, capacité & planning' },
}
const allItems = (groups) => groups.flatMap(([, items]) => items)

function Sidebar({ pending, ws }) {
  const loc = useLocation()
  const isActive = (to) => {
    const [path, query] = to.split('?')
    if (query) return loc.pathname === path && loc.search.includes(query)
    if (path === '/') return loc.pathname === '/'
    return loc.pathname.startsWith(path)
  }
  return (
    <aside className="sidebar">
      <Link to="/" className="sb-brand" title="MYC Smart Costing"><Logo tone="light" height={46} /><span className="sb-space">{WS[ws].label}</span></Link>
      {WS[ws].groups.map(([group, items]) => (
        <div key={group}>
          <div className="sb-section">{group}</div>
          {items.map(([to, Icon, label, badge]) => (
            <Link key={to} to={to} className={`sb-link ${isActive(to) ? 'active' : ''}`} title={label}>
              <Icon size={18} /><span className="sb-label">{label}</span>
              {badge === 'pending' && pending > 0 && <span className="sb-badge">{pending}</span>}
            </Link>
          ))}
        </div>
      ))}
      <div className="sb-foot">{WS[ws].foot}</div>
    </aside>
  )
}

function Header({ collapsed, setCollapsed, setMobile, ws }) {
  const { profile, signOut, theme, toggleTheme, canSwitchWs, setWorkspace } = useApp()
  const [menu, setMenu] = useState(null)
  const [notifs, setNotifs] = useState([])
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  const current = allItems(WS[ws].groups).find(([to]) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to.split('?')[0])))
  useEffect(() => setMenu(null), [loc.pathname])
  useEffect(() => {
    supabase.from('mc_posts').select('id, content, kind, created_at, author:mc_profiles(full_name)')
      .order('created_at', { ascending: false }).limit(8).then(({ data }) => setNotifs(data || []))
  }, [loc.pathname])

  return (
    <header className="header">
      <button className="icon-btn" onClick={() => { setCollapsed(!collapsed); setMobile((m) => !m) }} title="Menu">
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
      <div>
        <div className="header-title">{current?.[2] || 'MYC Smart Costing'}</div>
        <div className="header-sub">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <div className="header-spacer" />
      {canSwitchWs && (
        <div className="seg ws-switch" title="Changer d'espace">
          <button className={ws === 'metal' ? 'on' : ''} onClick={() => { setWorkspace('metal'); nav('/') }}>Métallisation · Slah</button>
          <button className={ws === 'projects' ? 'on' : ''} onClick={() => { setWorkspace('projects'); nav('/') }}>Projets · Seif</button>
        </div>
      )}
      {ws === 'metal' && (
        <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/produits?q=${encodeURIComponent(q)}`) }}>
          <Search size={16} color="var(--muted)" />
          <input placeholder="Rechercher une pièce, un client…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      )}
      <LanguageBar compact />
      <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      {ws === 'metal' && (
        <button className="icon-btn" title="Notifications" onClick={() => setMenu(menu === 'notif' ? null : 'notif')}>
          <Bell size={18} />{notifs.length > 0 && <span className="badge">{notifs.length}</span>}
        </button>
      )}
      <button className="me-btn" onClick={() => setMenu(menu === 'me' ? null : 'me')}>
        <Avatar name={profile?.full_name || '?'} size={32} />
        <div><b>{profile?.full_name}</b><span>{ROLE_LABEL[profile?.role]}</span></div>
      </button>

      {menu === 'me' && (
        <div className="menu">
          {ws === 'metal' && <Link className="menu-item" to="/equipe"><span className="menu-icon"><Users size={16} /></span>Mon profil & équipe</Link>}
          {ws === 'metal' && <Link className="menu-item" to="/parametres"><span className="menu-icon"><SlidersHorizontal size={16} /></span>Paramètres</Link>}
          {canSwitchWs && <button className="menu-item" onClick={() => setWorkspace(null)}><span className="menu-icon"><ArrowLeftRight size={16} /></span>Choisir un autre espace</button>}
          <button className="menu-item" onClick={signOut}><span className="menu-icon"><LogOut size={16} /></span>Changer de profil</button>
        </div>
      )}
      {menu === 'notif' && (
        <div className="menu">
          <div className="card-title" style={{ padding: 8, margin: 0 }}>Activité récente</div>
          {notifs.length === 0 && <div className="empty">Aucune notification</div>}
          {notifs.map((n) => (
            <Link key={n.id} className="menu-item" to="/activite">
              <Avatar name={n.author?.full_name || 'MYC'} size={36} />
              <div style={{ fontSize: 13 }}>
                <b>{n.author?.full_name || 'MYC'}</b> {n.content.slice(0, 80)}{n.content.length > 80 ? '…' : ''}
                <div style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 600 }}>{timeAgo(n.created_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}

export default function Layout() {
  const { dbError, workspace } = useApp()
  const ws = workspace === 'projects' ? 'projects' : 'metal'
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('myc_sb') === '1' } catch { return false } })
  const [mobile, setMobile] = useState(false)
  const [pending, setPending] = useState(0)
  useEffect(() => { try { localStorage.setItem('myc_sb', collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => {
    setMobile(false)
    if (ws === 'metal') supabase.from('mc_quotes').select('*', { count: 'exact', head: true }).eq('status', 'soumis').then(({ count }) => setPending(count || 0))
  }, [loc.pathname])

  return (
    <div className={`app ws-${ws} ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
      <Sidebar pending={pending} ws={ws} />
      <div style={{ minWidth: 0 }}>
        <Header collapsed={collapsed} setCollapsed={setCollapsed} setMobile={setMobile} ws={ws} />
        <main className="content">
          {dbError && ws === 'metal' && (
            <div className="db-warning">
              <b>Base Supabase non initialisée.</b> Exécutez <code>supabase/schema.sql</code> dans Supabase → SQL Editor.
              Les calculs fonctionnent déjà avec les paramètres Excel par défaut.
              <div className="card-sub">Détail : {dbError}</div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

