import { useApp } from '../context/AppContext'

/**
 * Logo MYC transparent.
 * tone="light"  → logo blanc (fonds foncés : barre latérale, panneau de connexion)
 * tone="dark"   → logo noir (fonds clairs)
 * tone="auto"   → suit le thème clair / sombre
 */
export default function Logo({ tone = 'auto', height = 40, style }) {
  const { theme } = useApp()
  const white = tone === 'light' || (tone === 'auto' && theme === 'dark')
  return (
    <img
      src={white ? '/logo-myc-white.png' : '/logo-myc-dark.png'}
      alt="MYC Beauty Innovation Tunisia"
      className="notranslate"
      translate="no"
      style={{ height, width: 'auto', maxWidth: '100%', objectFit: 'contain', alignSelf: 'flex-start', display: 'block', ...style }}
    />
  )
}
