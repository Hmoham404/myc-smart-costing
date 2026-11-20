// Traduction du site via le widget Google Traduction (piloté par notre propre barre de langues).
// La langue est mémorisée ; l'arabe passe la mise en page en droite-à-gauche.

export const LANGS = [
  { code: 'fr', g: 'fr', label: 'Français', short: 'FR', dir: 'ltr', ai: 'French' },
  { code: 'en', g: 'en', label: 'English', short: 'EN', dir: 'ltr', ai: 'English' },
  { code: 'it', g: 'it', label: 'Italiano', short: 'IT', dir: 'ltr', ai: 'Italian' },
  { code: 'zh', g: 'zh-CN', label: '中文', short: 'ZH', dir: 'ltr', ai: 'Simplified Chinese' },
  { code: 'ar', g: 'ar', label: 'العربية', short: 'AR', dir: 'rtl', ai: 'Arabic' },
]
export const langByCode = Object.fromEntries(LANGS.map((l) => [l.code, l]))

export function readLang() {
  try { return localStorage.getItem('myc_lang') || 'fr' } catch { return 'fr' }
}

function setCookie(value) {
  const host = location.hostname
  const exp = value ? '' : '; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = `googtrans=${value}; path=/${exp}`
  if (host.includes('.')) document.cookie = `googtrans=${value}; path=/; domain=.${host}${exp}`
}

let loading = null
function loadWidget() {
  if (loading) return loading
  loading = new Promise((resolve) => {
    window.googleTranslateElementInit = () => {
      // eslint-disable-next-line no-new
      new window.google.translate.TranslateElement(
        { pageLanguage: 'fr', includedLanguages: LANGS.map((l) => l.g).join(','), autoDisplay: false },
        'gt_element',
      )
      resolve()
    }
    const holder = document.createElement('div')
    holder.id = 'gt_element'
    holder.style.display = 'none'
    document.body.appendChild(holder)
    const s = document.createElement('script')
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    s.async = true
    document.body.appendChild(s)
  })
  return loading
}

function applyDir(code) {
  const l = langByCode[code] || LANGS[0]
  document.documentElement.lang = code
  document.documentElement.dir = l.dir
}

/** Applique la langue au démarrage (sans recharger). */
export async function initLang() {
  const code = readLang()
  applyDir(code)
  if (code === 'fr') return
  setCookie(`/fr/${langByCode[code].g}`)
  await loadWidget()
  pickInCombo(langByCode[code].g)
}

function pickInCombo(g, tries = 40) {
  const combo = document.querySelector('select.goog-te-combo')
  if (!combo || !combo.options.length) {
    if (tries > 0) setTimeout(() => pickInCombo(g, tries - 1), 150)
    return
  }
  combo.value = g
  combo.dispatchEvent(new Event('change'))
}

/** Change la langue du site. Le retour au français recharge la page (texte d'origine). */
export async function setLang(code) {
  try { localStorage.setItem('myc_lang', code) } catch { /* ignore */ }
  applyDir(code)
  if (code === 'fr') {
    setCookie('')
    location.reload()
    return
  }
  setCookie(`/fr/${langByCode[code].g}`)
  await loadWidget()
  pickInCombo(langByCode[code].g)
}
