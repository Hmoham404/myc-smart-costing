import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Avatar, Field, useToast } from '../components/ui'
import { ROLE_LABEL } from '../lib/format'

export default function Team() {
  const { profile, reloadProfile } = useApp()
  const [toast, setToast] = useToast()
  const [team, setTeam] = useState([])
  const [me, setMe] = useState({ full_name: '', job_title: '' })

  const load = () => supabase.from('mc_profiles').select('*').order('created_at').then(({ data }) => setTeam(data || []))
  useEffect(() => { load() }, [])
  useEffect(() => { if (profile) setMe({ full_name: profile.full_name || '', job_title: profile.job_title || '' }) }, [profile])

  const saveMe = async () => {
    const { error } = await supabase.from('mc_profiles').update(me).eq('id', profile.id)
    if (error) setToast(error.message); else { setToast('Profil mis à jour ✔'); reloadProfile(); load() }
  }
  const setRole = async (id, role) => {
    const { error } = await supabase.from('mc_profiles').update({ role }).eq('id', id)
    if (error) setToast(error.message); else load()
  }

  return (
    <>
      {toast}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: 180, background: 'linear-gradient(120deg,#1877f2,#0b4fb3 60%,#111)' }} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', padding: '0 24px 16px', marginTop: -50 }}>
          <div style={{ border: '4px solid #fff', borderRadius: '50%' }}><Avatar name={profile?.full_name} size={140} /></div>
          <div style={{ paddingBottom: 12 }}>
            <h1 style={{ fontSize: 28 }}>{profile?.full_name}</h1>
            <div className="card-sub">{profile?.job_title || ROLE_LABEL[profile?.role]} · {ROLE_LABEL[profile?.role]}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Mon profil</div>
        <div className="grid g3" style={{ alignItems: 'end' }}>
          <Field label="Nom complet"><input value={me.full_name} onChange={(e) => setMe({ ...me, full_name: e.target.value })} /></Field>
          <Field label="Fonction"><input value={me.job_title} onChange={(e) => setMe({ ...me, job_title: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={saveMe}>Enregistrer</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><Users size={18} /> Équipe ({team.length})</div>
        <div className="grid g3">
          {team.map((p) => (
            <div key={p.id} className="kpi" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar name={p.full_name} size={56} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{p.full_name}</b>
                <div className="card-sub">{p.job_title}</div>
                {profile?.role === 'admin' ? (
                  <select className="input" style={{ marginTop: 4, padding: 4 }} value={p.role} onChange={(e) => setRole(p.id, e.target.value)}>
                    {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                ) : <span className="pill envoye" style={{ marginTop: 4 }}>{ROLE_LABEL[p.role]}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="card-sub" style={{ marginTop: 12 }}>
          Rôles : <b>Directeur</b> (M. Sami) valide les devis · <b>Ingénieur</b> (Slah, Mohamed) chiffre et modifie les paramètres · <b>Admin</b> gère les rôles.
        </div>
      </div>
    </>
  )
}
