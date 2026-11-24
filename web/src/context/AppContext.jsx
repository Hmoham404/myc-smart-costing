import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_PARAMS } from '../lib/defaults'
import { readLang, initLang, setLang } from '../lib/i18n'

const AppCtx = createContext(null)

/** Espace autorisé d'un profil : 'metal' (Slah), 'projects' (Seif) ou 'both' (direction / admin). */
export function allowedWorkspace(profile) {
  if (!profile) return null
  if (profile.workspace) return profile.workspace
  if (/^seif\b/i.test(profile.full_name || '')) return 'projects'
  if (['admin', 'directeur'].includes(profile.role)) return 'both'
  return 'metal'
}
const readWs = () => { try { return sessionStorage.getItem('myc_ws') } catch { return null } }
export const useApp = () => useContext(AppCtx)

const KEY = 'myc_profile_id'
const readId = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const writeId = (id) => { try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

/** Application sans login : l'utilisateur choisit son profil dans la liste de l'équipe. */
export function AppProvider({ children }) {
  const [profileId, setProfileId] = useState(readId)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(!!readId())
  const [paramSet, setParamSet] = useState({ id: null, name: 'Paramètres par défaut (Excel)', version: 0, data: DEFAULT_PARAMS })
  const [dbError, setDbError] = useState(null)

  const loadProfile = useCallback(async () => {
    if (!profileId) { setProfile(null); setLoading(false); return }
    const { data, error } = await supabase.from('mc_profiles').select('*').eq('id', profileId).maybeSingle()
    if (error) setDbError(error.message)
    else setDbError(null)
    if (!data) { writeId(null); setProfileId(null); setProfile(null) } else setProfile(data)
    setLoading(false)
  }, [profileId])

  const loadParams = useCallback(async () => {
    const { data } = await supabase.from('mc_parameter_sets').select('*').eq('is_active', true).maybeSingle()
    if (data) setParamSet({ ...data, data: { ...DEFAULT_PARAMS, ...data.data } })
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])
  useEffect(() => { loadParams() }, [loadParams])

  const [chosenWs, setChosenWs] = useState(readWs)
  const selectProfile = (id) => { writeId(id); setLoading(true); setProfileId(id); setChosenWs(null); try { sessionStorage.removeItem('myc_ws') } catch { /* ignore */ } }
  const allowedWs = allowedWorkspace(profile)
  const workspace = allowedWs === 'both' ? (['metal', 'projects'].includes(chosenWs) ? chosenWs : null) : allowedWs
  const setWorkspace = (ws) => { try { ws ? sessionStorage.setItem('myc_ws', ws) : sessionStorage.removeItem('myc_ws') } catch { /* ignore */ } setChosenWs(ws) }

  // Thème clair / sombre (préférence mémorisée, sinon celle du système)
  const [theme, setTheme] = useState(() => {
    try { const t = localStorage.getItem('myc_theme'); if (t) return t } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('myc_theme', theme) } catch { /* ignore */ }
  }, [theme])

  // Langue du site (traduction) — appliquée au démarrage
  const [lang, setLangState] = useState(readLang)
  useEffect(() => { initLang() }, [])
  const changeLang = (code) => { setLangState(code); setLang(code) }

  const value = {
    lang, changeLang,
    profile, loading, dbError, theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    params: paramSet.data, paramSet, reloadParams: loadParams, reloadProfile: loadProfile,
    canApprove: ['admin', 'directeur'].includes(profile?.role),
    workspace, allowedWs, setWorkspace, canSwitchWs: allowedWs === 'both',
    selectProfile,
    signOut: () => { writeId(null); setProfileId(null); setProfile(null); setWorkspace(null) },
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
