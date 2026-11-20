// Paramètres par défaut — repris des classeurs de Slah Dridi
// Source : "FICHE QUANTIFICATION PIECE D&G ... PUPA 05-11-26.xlsx"
//          feuilles COST PAINT-VACCUM / FEUILLE CHIFFREAGE MYC TN / QUOTATION STANDARD FORMULA

export const DEFAULT_PARAMS = {
  currency: 'USD',
  shift_hours: 8, // U7 / L7
  daily_efficiency: 0.8, // S7 « Daily Efficiency »
  capacity_method: 'pitch', // 'pitch' = formule PUPA (sauts+1) ; 'simple' = formule BELOTTI

  // COST PAINT-VACCUM — ligne 7 : consommables par poste de 8 h ($)
  consumables: {
    spray_booth_filters: 4,
    other_consumables: 10,
    tungsten_wire: 36.4,
    aluminum_sheets: 14,
    gun_cleaning_fluid: 14.411764705882355,
    filters: 4,
    oil_pipes: 2,
  },

  // COST PAINT-VACCUM — ligne 11 : coûts horaires ($/h)
  hourly: {
    amort_uv_vacuum: 56.25,
    amort_paint: 43.875,
    labor_per_worker: 2.5,
    location: 28.75,
    other_elec: 22.5,
  },

  // Effectif (Q7 : IF(VACCUM;10;13))
  workers: { vacuum: 10, spray: 13 },

  // Capacité des chaînes (lignes 16 et 21)
  lines: {
    vacuum: { jumps: 4, spacing_mm: 44.45, speed_m_min: 7.11, efficiency: 0.9 },
    spray: { jumps: 1, spacing_mm: 33.81, speed_m_min: 7.11, efficiency: 0.9 },
  },

  // Capacité machine de métallisation sous vide (ligne 26) — informatif
  vacuum_machine: {
    steel_length: 28,
    square_steel_per_turntable: 6,
    turntables_per_machine: 8,
    machines: 2,
    cycles_per_hour: 4,
    hours: 7,
    efficiency: 0.9,
  },

  // COST PAINT-VACCUM — lignes 16 à 19 : peinture
  paint: {
    base: [
      { name: 'Treatment agent', price: 6.8, cons: 0.8 },
      { name: 'Primer (basecoat)', price: 7.9, cons: 1.2 },
      { name: 'Topcoat', price: 6.8, cons: 1 },
    ],
    pigments: [
      { name: 'Brown pigment', price: 30.4, cons: 0.061 },
      { name: 'Black pigment', price: 27.2, cons: 0.0194 },
      { name: 'Red pigment', price: 22.4, cons: 0.012 },
      { name: 'Blue pigment', price: 27.5, cons: 0.041 },
    ],
    shipment_coef: 1.1, // I17
    include_pigments: false, // E19 = ... * 0 dans le fichier Excel
    use_surface_coef: true, // K18 = SUM(cons) * B24
  },

  // Surface de référence (BASIC SURFACE PUPA — B20)
  reference_surface: { shape: 'circular', d1: 23, d2: 23, h: 26, label: 'BASIC SURFACE PUPA' },

  // Prix
  pricing_mode: 'coefficient', // 'coefficient' (PUPA : X7 = 1,65) ou 'margin' (BELOTTI : V + W*V)
  coefficient: 1.65,
  margin: 0.8,

  // Règle de rebut (conditions 25TN008) : diamètre < 75 mm → 12 %, sinon 15 %
  scrap_rule: { threshold_mm: 75, below: 0.12, above: 0.15 },

  // QUOTATION STANDARD FORMULA — coefficients commerciaux appliqués à X (prix TN 50K)
  tiers: [
    { key: '5K', qty: 5000 },
    { key: '10K', qty: 10000 },
    { key: '25K', qty: 25000 },
    { key: '50K', qty: 50000 },
    { key: '100K+', qty: 100000 },
  ],
  commercial_grid: {
    known_standard: [1.8, 1.2, 1.1, 1, 0.95],
    known_special: [1.9, 1.26, 1.16, 1.05, 1],
    new_standard: [2.25, 1.5, 1.375, 1.25, 1.19],
    new_special: [2.35, 1.56, 1.435, 1.3, 1.24],
  },
  cn_to_tn_factor: 1.65, // X = 1,65 Y
  handling_cost: { below_qty: 25000, amount: 300 },
  artwork_cost: 300,
}

export const STANDARD_CONDITIONS = [
  ['1. Packing', 'Ranged on layers'],
  ['2. Artwork Origination Costs', '300$ each'],
  ['3. Handling Cost', 'If quantity less than 25K, please add USD300 extra cost'],
  ['4. Shipping Conditions', 'EXW Tunisia'],
  ['5. Lead Time', '3 Weeks for PPS upon artwork approval - 9/10 weeks after PPS approval'],
  ['6. Payment Conditions', '30% in advance - Balance before shipment'],
  ['7. Quotation valid', '60 Days - If the currency rate or material price fluctuates over 5%, we have to adjust the quotation. The quotation is based on the currency rate between USD and RMB'],
  ['8. Scrap percentage allowed', 'If the part diameter is less than 75 mm, the scrap rate is 12%; otherwise, for 75 mm or more, it is 15%'],
  ['Quantity tolerance', '±5%'],
  ['AQL', 'CRITICAL: 0.65'],
  ['', 'COMPATIBILITY TEST IS UNDER CUSTOMER RESPONSIBILITY'],
  ['', 'ALL ORDERS ARE SUBJECT TO OUR WRITTEN CONFIRMATION'],
]

export const LEGAL_NOTE =
  'NOTES: Since MYC has no control on any downstream process and is not aware of the formulations that will be in contact with the packaging, all the needed tests which relate to migration, conditions of use, stability and compatibility are under the full responsibility of the customer. MYC, therefore, declines all responsibilities in case of any compatibility failure between the formulation and the packaging.'

export const DEFAULT_PRODUCT = {
  client: 'PUPA',
  client_type: 'known',
  reference: 'CAP',
  material: 'ABS',
  shape: 'rectangular',
  length: 140,
  width: 90,
  height: 8,
  d1: 0,
  d2: 0,
  process: 'vacuum',
  color: 'special',
  quantity: 50000,
  scrap: 0.12,
  jumps: null, // null = auto (ROUNDUP diagonale / pas)
  jig_price: 0,
  color_coef: 1,
}

export const PROCESS_LABEL = { vacuum: 'Métallisation sous vide', spray: 'Peinture / Spray' }
export const COLOR_LABEL = { standard: 'Couleur standard (Or / Argent)', special: 'Couleur spéciale' }
export const SHAPE_LABEL = { rectangular: 'Rectangulaire', circular: 'Circulaire / Ronde' }
