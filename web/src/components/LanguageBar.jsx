import { Languages } from 'lucide-react'
import { LANGS } from '../lib/i18n'
import { useApp } from '../context/AppContext'

// Drapeaux en SVG (les émojis drapeaux ne s'affichent pas sous Windows)
const FLAGS = {
  fr: (
    <svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#0055A4" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#EF4135" /></svg>
  ),
  en: (
    <svg viewBox="0 0 60 30"><clipPath id="uk"><path d="M0,0 v30 h60 v-30 z" /></clipPath><g clipPath="url(#uk)"><path d="M0,0 v30 h60 v-30 z" fill="#012169" /><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" /><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2.4" /><path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" /><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" /></g></svg>
  ),
  it: (
    <svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#009246" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#CE2B37" /></svg>
  ),
  zh: (
    <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#DE2910" /><polygon points="5,2 6.2,5.6 10,5.6 6.9,7.8 8.1,11.4 5,9.2 1.9,11.4 3.1,7.8 0,5.6 3.8,5.6" fill="#FFDE00" /><circle cx="11" cy="2.5" r="0.9" fill="#FFDE00" /><circle cx="13" cy="4.5" r="0.9" fill="#FFDE00" /><circle cx="13" cy="7.5" r="0.9" fill="#FFDE00" /><circle cx="11" cy="9.5" r="0.9" fill="#FFDE00" /></svg>
  ),
  ar: (
    <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#E70013" /><circle cx="15" cy="10" r="5" fill="#fff" /><circle cx="15.6" cy="10" r="3.6" fill="#E70013" /><circle cx="16.6" cy="10" r="2.9" fill="#fff" /><polygon points="16.1,10 18.6,9.2 17.1,11.3 17.1,8.7 18.6,10.8" fill="#E70013" /></svg>
  ),
}

export default function LanguageBar({ compact = false }) {
  const { lang, changeLang } = useApp()
  return (
    <div className="langbar notranslate" translate="no">
      {!compact && <span className="langbar-title"><Languages size={14} /> Traduction</span>}
      {LANGS.map((l) => (
        <button key={l.code} type="button" className={`lang-pill ${lang === l.code ? 'on' : ''}`} onClick={() => changeLang(l.code)} title={l.label}>
          <span className="flag">{FLAGS[l.code]}</span>
          <span className="lang-txt"><b>{l.short}</b>{!compact && <small>{l.label}</small>}</span>
        </button>
      ))}
    </div>
  )
}
