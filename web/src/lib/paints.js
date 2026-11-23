// Références peinture UVCHEM → rôle dans le système de métallisation
// (d'après TEST RESULT et COST PAINT-VACCUM du classeur D&G). Les prix viennent de la base (factures).

export const ROLES = {
  treatment: 'Agent de traitement (anti-huile)',
  primer: 'Primer',
  basecoat: 'Basecoat VM',
  topcoat: 'Topcoat VM',
  pigment: 'Pigment',
  thinner: 'Diluant',
  additive: 'Additif',
  other: 'Autre (à préciser)',
}

export const PAINT_CODES = {
  'PEC93821': { role: 'treatment', label: 'Oil resistant agent — ABS' },
  'PEC9PP-08': { role: 'primer', label: 'Primer (équivalent PP)' },
  'PEC95230-20': { role: 'basecoat', label: 'ABS VM Basecoat' },
  'PEC95631-7': { role: 'basecoat', label: 'PET VM Basecoat' },
  'PEC95610-16': { role: 'topcoat', label: 'VM Topcoat' },
  'PEC95610H': { role: 'topcoat', label: 'VM Topcoat (variante H)' },
  'PEC95911-5': { role: 'other', label: 'Polyester coating — usage à préciser' },
  'PEC9M-16': { role: 'other', label: 'Polyester coating — usage à préciser' },
  'PEC9TN-T': { role: 'thinner', label: 'Diluant (TN) — à confirmer' },
  'PEC9TN-025': { role: 'thinner', label: 'Diluant (TN) — à confirmer' },
  'PEC9TD-101': { role: 'additive', label: 'Additif (fourni gratuitement)' },
  'PEC9HD-04J': { role: 'additive', label: 'Additif (fourni gratuitement)' },
  'PEC9BROWN 1701': { role: 'pigment', label: 'Pigment marron', pigment: 'Brown pigment' },
  'PEC9RED 1101': { role: 'pigment', label: 'Pigment rouge', pigment: 'Red pigment' },
  'PEC9YELLOW 1302': { role: 'pigment', label: 'Pigment jaune', pigment: 'Yellow pigment' },
  'PEC9BLACK 1901': { role: 'pigment', label: 'Pigment noir', pigment: 'Black pigment' },
  'PEC9BLUE 1504': { role: 'pigment', label: 'Pigment bleu', pigment: 'Blue pigment' },
  'PEC9AG-10': { role: 'other', label: 'Agent AG — usage à préciser' },
}
export const infoFor = (code) => PAINT_CODES[code] || { role: 'other', label: 'Référence non répertoriée' }

// Système par défaut pour une pièce ABS métallisée sous vide (TEST RESULT) — consommations du classeur PUPA
export const DEFAULT_SYSTEM = {
  layers: [
    { role: 'treatment', code: 'PEC93821', cons: 0.8 },
    { role: 'basecoat', code: 'PEC95230-20', cons: 1.2 },
    { role: 'topcoat', code: 'PEC95610-16', cons: 1.0 },
  ],
  pigments: [
    { code: 'PEC9BROWN 1701', cons: 0.061 },
    { code: 'PEC9BLACK 1901', cons: 0.0194 },
    { code: 'PEC9RED 1101', cons: 0.012 },
    { code: 'PEC9BLUE 1504', cons: 0.041 },
  ],
}

/** Dernier prix connu de chaque code (facture la plus récente qui le contient) */
export function latestPrices(invoices, items) {
  const byId = Object.fromEntries(invoices.map((i) => [i.id, i]))
  const out = {}
  for (const it of items) {
    const inv = byId[it.invoice_id]
    if (!inv) continue
    const cur = out[it.code]
    if (!cur || inv.invoice_date > cur.date) out[it.code] = { price: Number(it.price_usd_kg), date: inv.invoice_date, invoice: inv.invoice_no }
  }
  return out
}
