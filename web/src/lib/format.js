export const money = (v, cur = 'USD', d = 4) =>
  `${Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} ${cur === 'USD' ? '$' : cur}`
export const num = (v, d = 0) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (v, d = 0) => `${(Number(v || 0) * 100).toLocaleString('fr-FR', { maximumFractionDigits: d })} %`

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`
  return new Date(date).toLocaleDateString('fr-FR')
}

export const initials = (name = '?') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

export const ROLE_LABEL = { admin: 'Administrateur', directeur: 'Directeur', ingenieur: 'Ingénieur méthodes', commercial: 'Commercial' }
export const STATUS_LABEL = { brouillon: 'Brouillon', soumis: 'Soumis à validation', valide: 'Validé', envoye: 'Envoyé', refuse: 'Refusé' }
