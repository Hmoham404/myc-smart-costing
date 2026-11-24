"""
Génère, à partir des 3 classeurs Excel d'exemple :
  - supabase/seed_projets.sql          (PRIVÉ, non versionné) : bibliothèque + 3 projets exemples
  - web/src/lib/fixtures.private.json  (PRIVÉ) : données + résultats Excel attendus pour les tests
Chaque classeur devient un PROJET au format unique (composants + opérations + besoin client) ;
le chiffrage, le CBN, la capacité, le planning et le Gantt sont ensuite calculés par l'application.
Usage (depuis le dossier du projet) : python supabase/build_seed_projets.py
"""
import json
import uuid
import openpyxl

INJ = 'YZA089A Product Costing Analysis Sheet v1.xlsx'
MAT = 'YZA067A- Injection molding material requirements worksheet.xlsx'
CAP = 'Project management MAJ KIKO 28-04-2026_650K Pieces.xlsx'


def s(x):
    return str(x).strip() if x is not None else ''


def num(x):
    return x if isinstance(x, (int, float)) else 0


def uid(prefix):
    return f'{prefix}-{uuid.uuid4().hex[:8]}'


# Densités usuelles (g/cm³) pour la conception 3D (poids = volume × densité)
DENSITY = {'pet': 1.38, 'petg': 1.27, 'claro': 1.38, 'abs': 1.05, 'pp': 0.91, 'ldpe': 0.92, 'hdpe': 0.95, 'pom': 1.41, 'pcr pp': 0.91}


def density(name):
    k = name.lower()
    for key in ('pcr pp', 'petg', 'ldpe', 'hdpe', 'pom', 'abs', 'claro', 'pet', 'pp'):
        if key in k:
            return DENSITY[key]
    return 1.0


# ================================================================ BIBLIOTHÈQUE (YZA089A / Data)
wb = openpyxl.load_workbook(INJ, data_only=True)
cap, data = wb[' CAP 1'], wb['Data']


def col(c1, c2, c3=None):
    out = []
    for r in range(3, 15):
        name = s(data[f'{c1}{r}'].value)
        if not name:
            continue
        out.append({'name': name, 'price': num(data[f'{c2}{r}'].value)} if not c3 else
                   {'name': name, 'labor': num(data[f'{c2}{r}'].value), 'machineCost': num(data[f'{c3}{r}'].value)})
    return out


library = {
    'materials': [dict(m, density=density(m['name'])) for m in col('C', 'D')] + [{'name': 'PCR PP', 'price': 0, 'density': 0.91}],
    'masterbatches': col('F', 'G') + [{'name': 'PT2338C', 'price': 0}],
    'machines': col('I', 'J', 'K'),
    'packaging': col('M', 'N'),
    'inks': col('P', 'Q'),
    'components': [x for x in col('S', 'T') if x['name']],
    'assembly': [{'name': s(data[f'V{r}'].value), 'machineCost': num(data[f'W{r}'].value), 'labor': num(data[f'X{r}'].value)}
                 for r in range(3, 15) if s(data[f'V{r}'].value)],
}
for m in library['machines']:
    m['category'] = 'injection' if any(k in m['name'].upper() for k in ('FANUC', 'DAPAI')) else ('decoration' if 'silk' in m['name'].lower() or 'stamping' in m['name'].lower() else 'assembly')

SCHED = {'hoursPerShift': 7.5, 'shiftsPerDay': 3, 'daysPerWeek': 6, 'efficiency': 0.85}

# ================================================================ PROJET 1 : SEPHORA YZA089A (chiffrage)
comps1, ops1 = [], []
for rr, ri in ((4, 11), (6, 12)):
    cid = uid('c')
    comps1.append({'id': cid, 'name': s(cap[f'C{rr}'].value), 'reference': f"YZA089A-{s(cap[f'C{rr}'].value).upper()}",
                   'material': s(cap[f'D{rr}'].value), 'color': s(cap[f'E{rr}'].value), 'masterbatch': '', 'mbShare': 0,
                   'netWeight': num(cap[f'F{rr}'].value), 'runnerWeight': num(cap[f'I{rr}'].value), 'qtyPerProduct': num(cap[f'J{rr}'].value) or 1,
                   'rejectInjection': num(cap[f'M{rr}'].value), 'asmReject': num(cap[f'P{rr}'].value),
                   'cavities': num(cap[f'E{ri}'].value), 'cycle': num(cap[f'D{ri}'].value), 'startupCycles': 0, 'recyclingRate': 0})
    ops1.append({'id': uid('o'), 'category': 'injection', 'label': f"Injection {s(cap[f'C{rr}'].value)}", 'componentIds': [cid],
                 'machine': s(cap[f'K{ri}'].value), 'machines': 1, 'workers': num(cap[f'I{ri}'].value), 'asmReject': num(cap[f'P{ri}'].value), 'startWeek': ''})
ops1.append({'id': uid('o'), 'category': 'decoration', 'label': 'Sérigraphie cap', 'componentIds': [comps1[0]['id']],
             'machine': s(cap['K21'].value), 'machines': 1, 'workers': num(cap['I21'].value), 'cycle': num(cap['E21'].value),
             'ink': s(cap['D21'].value), 'inkWeight': num(cap['M21'].value), 'reject': num(cap['P21'].value), 'startWeek': ''})
for r in range(27, 33):
    step = s(cap[f'C{r}'].value)
    ops1.append({'id': uid('o'), 'category': 'assembly', 'label': step, 'step': step, 'componentIds': [], 'machines': 1,
                 'workers': num(cap[f'I{r}'].value), 'cycle': num(cap[f'E{r}'].value), 'reject': num(cap[f'P{r}'].value), 'startWeek': ''})
p1 = {'quantity': 0, 'startDate': '2026-11-30', 'schedule': SCHED, 'components': comps1, 'operations': ops1,
      'purchased': [{'name': s(cap['C24'].value), 'qty': num(cap['M24'].value), 'reject': num(cap['P24'].value)}],
      'packing': {'layers': num(cap['E35'].value), 'perLayer': num(cap['H35'].value),
                  'items': [{'name': s(cap[f'C{r}'].value), 'qty': num(cap[f'K{r}'].value)} for r in range(35, 40)]},
      'transport': num(cap['R42'].value), 'margin': 0, 'weeks': [], 'holidays': [], 'tasks': [], 'models': {}}
exp1 = {'total': cap['R43'].value, 'resin': cap['R9'].value, 'injection': cap['R13'].value, 'packing': cap['Q35'].value}

# ================================================================ PROJET 2 : YZA067A (CBN)
ws = openpyxl.load_workbook(MAT, data_only=True)['CBN']
comps2, ops2 = [], []
for row, base in ((8, 14), (9, 20), (10, 26)):
    cid = uid('c')
    comps2.append({'id': cid, 'name': s(ws[f'C{row}'].value), 'reference': s(ws[f'D{row}'].value), 'material': s(ws[f'D{base}'].value),
                   'color': '', 'masterbatch': s(ws[f'E{base}'].value), 'mbShare': round(1 - num(ws[f'D{base + 1}'].value), 6),
                   'netWeight': num(ws[f'F{base + 1}'].value), 'runnerWeight': num(ws[f'I{base + 1}'].value), 'cavities': num(ws[f'G{base + 1}'].value),
                   'cycle': 0, 'qtyPerProduct': 1, 'rejectInjection': num(ws[f'G{row}'].value), 'asmReject': 0,
                   'startupCycles': num(ws[f'O{base + 1}'].value), 'recyclingRate': num(ws[f'K{base + 1}'].value)})
    ops2.append({'id': uid('o'), 'category': 'injection', 'label': f"Injection {s(ws[f'C{row}'].value)}", 'componentIds': [cid], 'machine': '', 'machines': 1, 'workers': 1, 'startWeek': ''})
by_name = {c['name']: c['id'] for c in comps2}
ops2 += [
    {'id': uid('o'), 'category': 'decoration', 'label': 'SS/HS COVER', 'componentIds': [by_name['COVER']], 'reject': num(ws['I8'].value), 'machines': 1, 'workers': 1, 'cycle': 0, 'startWeek': ''},
    {'id': uid('o'), 'category': 'painting', 'label': 'Peinture COVER & BASE', 'componentIds': [by_name['COVER'], by_name['BASE']], 'reject': num(ws['K8'].value), 'machines': 1, 'workers': 1, 'cycle': 0, 'startWeek': ''},
    {'id': uid('o'), 'category': 'assembly', 'label': 'Assemblage', 'componentIds': [], 'reject': num(ws['N8'].value), 'machines': 1, 'workers': 1, 'cycle': 0, 'startWeek': ''},
]
p2 = {'quantity': num(ws['E8'].value), 'startDate': '2026-09-28', 'schedule': SCHED, 'components': comps2, 'operations': ops2,
      'purchased': [], 'packing': {'layers': 0, 'perLayer': 0, 'items': []}, 'transport': 0, 'margin': 0, 'weeks': [], 'holidays': [], 'tasks': [], 'models': {},
      'note': "Classeur : le mélange maître de la synthèse est nommé « P9240C/P4052C » alors que les pièces utilisent « PT2338C » ; le taux de recyclage (5 %) est saisi mais n'entre pas dans le calcul."}
exp2 = {'resin': ws['E33'].value, 'mb': ws['E34'].value, 'cover_to_produce': ws['O8'].value}

# ================================================================ PROJET 3 : KIKO YZA037 (capacité, planning, Gantt)
wb = openpyxl.load_workbook(CAP, data_only=True)
nom, pc, summ, gantt, jf = wb['Nomenclature et phases '], wb['Production Capacity '], wb['Capacity Planning Summary'], wb['Gantt Chart  '], wb['JF']
comp_rows = {s(pc[f'D{r}'].value): (s(pc[f'E{r}'].value), num(pc[f'F{r}'].value), num(pc[f'G{r}'].value)) for r in (6, 10, 14)}
comps3, cid_of = [], {}
for code, (name, cyc, cav) in comp_rows.items():
    cid = uid('c'); cid_of[code] = cid
    comps3.append({'id': cid, 'name': name, 'reference': code, 'material': '', 'color': '', 'masterbatch': '', 'mbShare': 0, 'netWeight': 0,
                   'runnerWeight': 0, 'cavities': cav, 'cycle': cyc, 'qtyPerProduct': 1, 'rejectInjection': 0, 'asmReject': 0, 'startupCycles': 0, 'recyclingRate': 0})
weeks3 = [{'label': s(summ.cell(6, c).value).upper(), 'need': num(summ.cell(5, c).value)} for c in range(6, 21)]
first_out = {}  # 1re semaine de production + montée en cadence (synthèse)
for r, key in ((7, 'YZA037AA|Injection'), (11, 'YZA037FA|Injection'), (15, 'YZA037BA|Injection'), (19, 'Ultrasonic Welding'), (23, 'Metallization'),
               (31, 'Silk screen'), (35, 'Automatic assembling'), (38, 'Manual assembling')):
    vals = [num(summ.cell(r, c).value) for c in range(6, 21)]
    i = next((k for k, v in enumerate(vals) if v > 0), 0)
    first_out[key] = (weeks3[i]['label'], round(min(1, vals[i] / max(1, num(summ.cell(r, 4).value))), 4))
CAT = {'injection': 'injection', 'metallization': 'metallization', 'silk screen': 'decoration', 'ultrasonic welding': 'assembly',
       'automatic assembling': 'assembly', 'manual assembling': 'assembly'}
ops3 = []
for r in range(7, 16):
    proc, code = s(nom[f'F{r}'].value), s(nom[f'E{r}'].value)
    cat = CAT.get(proc.lower(), 'assembly')
    codes = [cid_of[c.strip()] for c in code.replace('&', ',').split(',') if c.strip() in cid_of]
    key = f'{code}|{proc}' if cat == 'injection' else next((k for k in first_out if proc.lower().startswith(k.lower())), proc)
    sw, ramp = first_out.get(key, (weeks3[0]['label'], 1))
    op = {'id': uid('o'), 'category': cat, 'label': f"{proc} — {s(nom[f'G{r}'].value)}", 'componentIds': codes if cat != 'assembly' or 'Insert' in s(nom[f'G{r}'].value) and 'Cover' not in s(nom[f'G{r}'].value) else [],
          'machine': s(nom[f'H{r}'].value), 'machines': num(nom[f'I{r}'].value), 'workers': num(nom[f'R{r}'].value),
          'hoursPerShift': num(nom[f'M{r}'].value), 'shiftsPerDay': num(nom[f'N{r}'].value), 'daysPerWeek': num(nom[f'O{r}'].value),
          'efficiency': num(nom[f'P{r}'].value), 'reject': num(nom[f'Q{r}'].value), 'objective': num(nom[f'W{r}'].value),
          'availability': s(nom[f'J{r}'].value), 'delivery': s(nom[f'K{r}'].value), 'startWeek': sw, 'ramp': ramp}
    if cat == 'metallization':
        op.update({'speed': num(pc['F59'].value), 'jumps': num(pc['G59'].value), 'pitchMm': 44.45})
        if r == 12:
            op['workers'] = 0  # ligne partagée avec la cover (MOD déjà comptée dans le classeur)
    elif cat != 'injection':
        op['cycle'] = num(nom[f'L{r}'].value)
    if proc.lower().startswith('manual'):
        vals = [num(summ.cell(38, c).value) for c in range(6, 21)]
        last = max((k for k, v in enumerate(vals) if v > 0), default=0)
        op['endWeek'] = weeks3[last]['label']  # renfort ponctuel dans la synthèse (W21–W22)
    ops3.append(op)
tasks3 = []
group = ''
for r in range(7, 20):
    name, start, end = s(gantt[f'A{r}'].value), gantt[f'D{r}'].value, gantt[f'E{r}'].value
    if start is None:
        group = name
        continue
    tasks3.append({'id': uid('t'), 'group': group, 'name': name, 'equipment': s(gantt[f'B{r}'].value), 'progress': num(gantt[f'C{r}'].value),
                   'start': start.strftime('%Y-%m-%d'), 'end': end.strftime('%Y-%m-%d'), 'excelWorkDays': gantt[f'F{r}'].value})
holidays3 = [{'date': row[0].value.strftime('%Y-%m-%d'), 'label': s(row[1].value)} for row in jf.iter_rows(min_row=3) if row[0].value]
p3 = {'quantity': 650000, 'startDate': gantt['B3'].value.strftime('%Y-%m-%d'), 'schedule': SCHED, 'components': comps3, 'operations': ops3,
      'purchased': [], 'packing': {'layers': 0, 'perLayer': 0, 'items': []}, 'transport': 0, 'margin': 0,
      'weeks': weeks3, 'holidays': holidays3, 'tasks': tasks3, 'models': {}}
exp3 = {f"{s(nom[f'E{r}'].value)}|{s(nom[f'F{r}'].value)}": {'hourly': nom[f'T{r}'].value, 'weekly': nom[f'V{r}'].value} for r in range(7, 16)}

# ================================================================ SORTIES
projects = [
    ('SEPHORA YZA089A — étui transparent cap + base', 'SEPHORA', 'YZA089A', p1),
    ('YZA067A — cover, insert, base (225 000 pcs)', 'KIKO', 'YZA067A', p2),
    ('KIKO YZA037 — 650 000 pièces', 'KIKO', 'YZA037', p3),
]


def q(x):
    return json.dumps(x, ensure_ascii=False).replace('$json$', '')


sql = ['-- PRIVÉ (non versionné) — généré par supabase/build_seed_projets.py depuis les classeurs Excel d\'exemple.',
       '-- À exécuter APRÈS supabase/schema.sql. Ré-exécutable.', '',
       '-- Bibliothèque (matières, presses, encres, composants, emballages, étapes d\'assemblage)']
for kind, items in library.items():
    sql.append(f"insert into public.mc_library (kind, items) values ('{kind}', $json${q(items)}$json$::jsonb)\n"
               f"on conflict (kind) do nothing;")
sql += ['', "-- Anciennes versions des projets exemples (format par fichier) remplacées par le format unique",
        "delete from public.mc_projects where type in ('injection','materials','capacity');", '']
for title, client, ref, data in projects:
    sql.append("insert into public.mc_projects (type, title, client, reference, status, owner_id, data)\n"
               f"select 'project', '{title.replace(chr(39), chr(39) * 2)}', '{client}', '{ref}', 'en_cours',\n"
               "       (select id from public.mc_profiles where full_name = 'Seif' limit 1),\n"
               f"       $json${q(data)}$json$::jsonb\n"
               f"where not exists (select 1 from public.mc_projects where type = 'project' and reference = '{ref}');\n")
open('supabase/seed_projets.sql', 'w', encoding='utf-8').write('\n'.join(sql))
json.dump({'library': library, 'p1': {'data': p1, 'expected': exp1}, 'p2': {'data': p2, 'expected': exp2}, 'p3': {'data': p3, 'expected': exp3}},
          open('web/src/lib/fixtures.private.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', exp1['total'], exp2['resin'], len(ops3), 'opérations KIKO,', len(tasks3), 'tâches Gantt')
