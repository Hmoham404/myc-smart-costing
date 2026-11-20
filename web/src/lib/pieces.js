// =====================================================================
//  Catalogue des pièces présentes dans les classeurs Excel de Slah
//  Sources : RICHIESTA QUOTAZIONE D&G (feuilles 25TN008-CN Standard,
//  RFQ Belotti-Sami DG MYCCN, 25TN008-TN Standard, TEST RESULT)
//  et FICHE QUANTIFICATION PUPA (FEUILLE CHIFFREAGE MYC TN).
//  Dimensions en mm. Prix en USD tels qu'ils figurent dans Excel.
// =====================================================================

// Formes 3D : round (disque), oval, rrect (rectangle arrondi), squircle (carré arrondi),
// pebble (galet), egg (goutte), heart (cœur), tab (plaque à bout arrondi), plate (plaque)
export const SHAPES = {
  round: 'Ronde', oval: 'Ovale', rrect: 'Rectangle arrondi', squircle: 'Carré arrondi',
  pebble: 'Galet', egg: 'Goutte', heart: 'Cœur', tab: 'Plaque à bout arrondi', plate: 'Plaque',
  logo_dg: 'Logo D&G découpé (tracé photo)',
}
// Style : compact (couvercle + base avec joint) / domed (dessus bombé) / flat (plaque)
export const STYLES = { compact: 'Boîtier (couvercle + base)', domed: 'Disque bombé', flat: 'Plaque' }

export const FINISHES = {
  silver: { label: 'Shiny Silver', color: '#e6e9ee', metal: 0.95, rough: 0.16 },
  gold: { label: 'Clear Gold', color: '#d8b04c', metal: 1, rough: 0.16 },
  red: { label: 'Rouge métallisé', color: '#c3262e', metal: 0.85, rough: 0.2 },
  blue: { label: 'Bleu métallisé', color: '#2f63c8', metal: 0.85, rough: 0.2 },
  copper: { label: 'Cuivre', color: '#c47a4f', metal: 1, rough: 0.2 },
  abs_white: { label: 'ABS naturel blanc', color: '#ecebe4', metal: 0, rough: 0.55 },
  abs_black: { label: 'ABS naturel noir', color: '#1d1d1f', metal: 0, rough: 0.45 },
}

export const EXCEL_PIECES = [
  // ---- D&G 17700 (25TN008-TN Standard / RFQ Belotti-Sami DG MYCTN / TEST RESULT) ----
  { id: '17700-cover', reference: '17700 COVER', client: 'BELOTTI', brand: 'Dolce & Gabbana', sheet: '25TN008-TN Standard',
    shape: 'tab', style: 'flat', L: 140, W: 90, H: 8, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'COVER SHINY SILVER METALLIZATION (KNOWN COLOR)', photos: ['image24.png', 'image21.png'],
    excel: { tiers: { '5K': 0.8856, '10K': 0.5904, '25K': 0.5412, '50K': 0.492, '100K+': 0.4674 } },
    samples: { received: 216, ok: 19, nok: 186 },
    notes: ['Gabarit / jig : 50 × 35 mm', 'Agent anti-huile PEC93821 · Basecoat ABS VM PEC95230-20 · Topcoat VM PEC95610-16', 'Consommation estimée pour tous les échantillons : 6 kg par couche'] },
  { id: '17700-base', reference: '17700 BASE', client: 'BELOTTI', brand: 'Dolce & Gabbana', sheet: '25TN008-TN Standard',
    shape: 'tab', style: 'flat', L: 140, W: 90, H: 8, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'BASE SHINY SILVER METALLIZATION (KNOWN COLOR)', photos: ['image25.png', 'image27.png'],
    excel: { tiers: { '5K': 0.8856, '10K': 0.5904, '25K': 0.5412, '50K': 0.492, '100K+': 0.4674 } },
    samples: { received: 224, ok: 74, nok: 125 },
    notes: ['Gabarit / jig : 50 × 35 mm', 'Peinture équivalente : Primer PEC9PP-08 · PET VM Basecoat PEC95631-7 · Topcoat PEC95610-16'] },
  { id: '17700-logo', reference: '17700 LOGO D&G', client: 'BELOTTI', brand: 'Dolce & Gabbana', sheet: '25TN008-TN Standard',
    shape: 'logo_dg', style: 'flat', L: 110, W: 80, H: 2, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'LOGO SHINY SILVER METALLIZATION (KNOWN COLOR) — Ø 136 mm', photos: ['image26.png', 'image22.png', 'image31.png'],
    excel: { tiers: { '5K': 0.6912, '10K': 0.4608, '25K': 0.4224, '50K': 0.384, '100K+': 0.3648 } },
    samples: { received: 210, ok: 165, nok: 39 },
    notes: ['Forme 3D : contour tracé depuis la photo de l\'échantillon (TEST RESULT), mis à l\'échelle 110 × 80 × 2 mm','Gabarit / jig avec logo D&G (voir photo TEST RESULT)'] },

  // ---- PUPA (FEUILLE CHIFFREAGE MYC TN) ----
  { id: 'pupa-cap', reference: 'CAP', client: 'PUPA', brand: 'PUPA Milano', sheet: 'FEUILLE CHIFFREAGE MYC TN',
    shape: 'rrect', style: 'compact', L: 140, W: 90, H: 8, finish: 'gold', color: 'special', process: 'vacuum',
    decoration: 'VACCUM METALLIZATION — SPECIAL COLOR', photos: [],
    excel: { computed: { unitCost: 0.298611, finalPrice: 0.492708, quantity: 50000, hours: 38 } },
    notes: ['Quantité 50 000 pcs, rebut 12 % → 56 000 à produire', 'Coefficient 1,65 · 10 opérateurs'] },

  // ---- Coffrets Belotti / D&G (25TN008-CN Standard + RFQ Belotti-Sami DG MYCCN) ----
  { id: 'lid-75', reference: 'LID/BASE Ø75 H14.1', client: 'BELOTTI', sheet: '25TN008-CN Standard',
    shape: 'round', style: 'compact', L: 75, W: 75, H: 14.1, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization', photos: ['image10.png'],
    excel: { tiers: { '5K': 0.352545, '10K': 0.241215, '25K': 0.22266, '50K': 0.1948275, '100K+': 0.192972 }, cn: 0.11 } },
  { id: 'heart-79', reference: 'HEART 79.1×78 H22', client: 'BELOTTI', sheet: '25TN008-CN Standard',
    shape: 'heart', style: 'compact', L: 79.1, W: 78, H: 22, finish: 'red', color: 'special', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Red', photos: ['image11.png'],
    excel: { tiers: { '5K': 0.3564, '10K': 0.2376, '25K': 0.2178, '50K': 0.198, '100K+': 0.1881 }, cn: 0.12 } },
  { id: 'mb-13800', reference: 'MB-13800 H.11', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'rrect', style: 'compact', L: 66, W: 46, H: 18, finish: 'blue', color: 'special', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Blue', photos: ['image6.png'],
    excel: { quoted50k: 0.205, cn: 0.1016, tiers: { '5K': 0.33782, '10K': 0.23114, '25K': 0.21336, '50K': 0.18669, '100K+': 0.184912 } } },
  { id: 'mb-12400', reference: 'MB-12400/N H.9,5', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'round', style: 'compact', L: 51, W: 51, H: 16.5, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image7.png'],
    excel: { quoted50k: 0.157, cn: 0.0938 } },
  { id: 'mb-13400', reference: 'MB-13400/N H.10', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'round', style: 'compact', L: 62, W: 62, H: 17.5, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image8.png'],
    excel: { quoted50k: 0.161, cn: 0.0938 } },
  { id: 'mb-11600n', reference: 'MB-11600/N H.11,5', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'round', style: 'compact', L: 75, W: 75, H: 19, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image9.png'],
    excel: { quoted50k: 0.195, cn: 0.1237 } },
  { id: 'mb-13500', reference: 'MB-13500', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'squircle', style: 'compact', L: 70.2, W: 70.2, H: 21, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image12.png'],
    excel: { quoted50k: 0.242, cn: 0.1463876689916473 } },
  { id: 'sag-a1', reference: 'COMPACT SAGOMATI A1', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'pebble', style: 'compact', L: 107.5, W: 100, H: 17.5, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image13.png'],
    excel: { quoted50k: 0.304, cn: 0.18226699962685494 } },
  { id: 'sag-a1-1', reference: 'COMPACT SAGOMATI A1-1', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'egg', style: 'compact', L: 88.15, W: 70, H: 14, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image14.png'],
    excel: { quoted50k: 0.259, cn: 0.14351732254083066 } },
  { id: 'placca-a1', reference: 'SAGOMATI CON PLACCA A1', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'pebble', style: 'domed', L: 107.5, W: 100, H: 17.5, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image15.png'],
    excel: { quoted50k: 0.304, cn: 0.18226699962685494 } },
  { id: 'placca-a1-1', reference: 'SAGOMATI CON PLACCA A1-1', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'egg', style: 'domed', L: 88.15, W: 70, H: 14, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image16.png'],
    excel: { quoted50k: 0.259, cn: 0.14351732254083066 } },
  { id: 'mb-15300', reference: 'MB-15300', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'squircle', style: 'compact', L: 100, W: 100, H: 9.05, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image18.png'],
    excel: { quoted50k: 0.304, cn: 0.18226699962685494 } },
  { id: 'mb-15200', reference: 'MB-15200', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'squircle', style: 'compact', L: 75, W: 75, H: 8.6, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid + Base Metallization Shiny Silver', photos: ['image17.png'],
    excel: { quoted50k: 0.259, cn: 0.14351732254083066 } },
  { id: 'mb-12900', reference: 'MB-12900', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'round', style: 'domed', L: 96, W: 96, H: 18, finish: 'silver', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid Metallization Shiny Silver', photos: ['image19.png'],
    excel: { quoted50k: 0.213, cn: 0.1277304170613393 } },
  { id: 'mb-11600', reference: 'MB-11600', client: 'BELOTTI', sheet: 'RFQ Belotti-Sami DG MYCCN',
    shape: 'round', style: 'domed', L: 75, W: 75, H: 8.8, finish: 'copper', color: 'standard', process: 'vacuum',
    decoration: 'ABS Lid Metallization Shiny Silver', photos: ['image20.png'],
    excel: { quoted50k: 0.159, cn: 0.107637991905623 } },
]

export const FIXTURE_PHOTOS = ['image29.png', 'image30.png', 'image31.png']

/** Pièce 3D → entrée du moteur de calcul (formules Excel : rectangulaire ou circulaire) */
export function pieceToProduct(p, extra = {}) {
  const circular = ['round', 'oval'].includes(p.shape)
  return {
    client: p.client, client_type: 'known', reference: p.reference, material: 'ABS',
    shape: circular ? 'circular' : 'rectangular',
    length: p.L, width: p.W, height: p.H, d1: circular ? p.L : 0, d2: circular ? p.W : 0,
    process: p.process || 'vacuum', color: p.color || 'standard',
    quantity: 50000, scrap: 0.12, jumps: null, jig_price: 0, color_coef: 1,
    ...extra,
  }
}
