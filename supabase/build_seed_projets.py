"""
Génère supabase/seed_projets.sql (PRIVÉ, non versionné) et web/src/lib/fixtures.private.json
à partir des 3 classeurs Excel : YZA089A (chiffrage injection), YZA067A (besoin matière),
Project management KIKO (capacité & planning).
Usage : python supabase/build_seed_projets.py   (depuis le dossier du projet)
"""
import json
import openpyxl

INJ = 'YZA089A Product Costing Analysis Sheet v1.xlsx'
MAT = 'YZA067A- Injection molding material requirements worksheet.xlsx'
CAP = 'Project management MAJ KIKO 28-04-2026_650K Pieces.xlsx'


def v(ws, cell):
    return ws[cell].value


def s(x):
    return (str(x).strip() if x is not None else '')


# ---------------------------------------------------------------- YZA089A
wb = openpyxl.load_workbook(INJ, data_only=True)
cap, data = wb[' CAP 1'], wb['Data']


def table(c1, c2, c3=None, rows=range(3, 15)):
    out = []
    for r in rows:
        name = data[f'{c1}{r}'].value
        if s(name):
            row = {'name': s(name), 'price': data[f'{c2}{r}'].value or 0}
            if c3:
                row = {'name': s(name), 'labor': data[f'{c2}{r}'].value or 0, 'machineCost': data[f'{c3}{r}'].value or 0}
            out.append(row)
    return out


refs = {
    'materials': table('C', 'D'),
    'masterbatches': table('F', 'G'),
    'machines': table('I', 'J', 'K'),
    'packaging': table('M', 'N'),
    'inks': table('P', 'Q'),
    'components': [x for x in table('S', 'T') if x['name']],
    'assembly': [{'name': s(data[f'V{r}'].value), 'machineCost': data[f'W{r}'].value or 0, 'labor': data[f'X{r}'].value or 0}
                 for r in range(3, 15) if s(data[f'V{r}'].value)],
}
injection_project = {
    'client': 'SEPHORA', 'reference': 'YZA089A', 'quantity': 0, 'margin': 0,
    'resin': [
        {'part': s(v(cap, f'C{r}')), 'material': s(v(cap, f'D{r}')), 'color': s(v(cap, f'E{r}')),
         'netWeight': v(cap, f'F{r}'), 'runnerWeight': v(cap, f'I{r}') or 0, 'rate': v(cap, f'J{r}'),
         'reject': v(cap, f'M{r}'), 'assemblyReject': v(cap, f'P{r}') or 0, 'masterbatch': '', 'mbRate': 0}
        for r in (4, 6)],
    'injection': [
        {'part': s(v(cap, f'C{r}')), 'cycle': v(cap, f'D{r}'), 'cavity': v(cap, f'E{r}'), 'workers': v(cap, f'I{r}'),
         'machine': s(v(cap, f'K{r}')), 'reject': v(cap, f'M{r}'), 'assemblyReject': v(cap, f'P{r}')}
        for r in (11, 12)],
    'decoration': [
        {'part': s(v(cap, 'C21')), 'ink': s(v(cap, 'D21')), 'cycle': v(cap, 'E21'), 'workers': v(cap, 'I21'),
         'machine': s(v(cap, 'K21')), 'inkWeight': v(cap, 'M21'), 'reject': v(cap, 'P21')}],
    'components': [{'name': s(v(cap, 'C24')), 'description': s(v(cap, 'F24')), 'qty': v(cap, 'M24'), 'reject': v(cap, 'P24')}],
    'assembly': [
        {'operation': s(v(cap, f'C{r}')), 'cycle': v(cap, f'E{r}'), 'workers': v(cap, f'I{r}'), 'reject': v(cap, f'P{r}')}
        for r in range(27, 33)],
    'packing': {'layers': v(cap, 'E35'), 'perLayer': v(cap, 'H35'),
                'items': [{'name': s(v(cap, f'C{r}')), 'qty': v(cap, f'K{r}')} for r in range(35, 40)]},
    'transport': v(cap, 'R42'),
    'refs': refs,
}
injection_expected = v(cap, 'R43')

# ---------------------------------------------------------------- YZA067A
ws = openpyxl.load_workbook(MAT, data_only=True)['CBN']
items = []
for row, base in ((8, 14), (9, 20), (10, 26)):
    items.append({
        'name': s(v(ws, f'C{row}')), 'reference': s(v(ws, f'D{row}')), 'planned': v(ws, f'E{row}'),
        'scrapInjection': v(ws, f'G{row}') or 0, 'scrapDecoration': v(ws, f'I{row}') or 0,
        'scrapPainting': v(ws, f'K{row}') or 0, 'scrapAssembly': v(ws, f'N{row}') or 0,
        'resin': s(v(ws, f'D{base}')), 'masterbatch': s(v(ws, f'E{base}')), 'resinShare': v(ws, f'D{base + 1}'),
        'unitWeight': v(ws, f'F{base + 1}'), 'cavities': v(ws, f'G{base + 1}'), 'runnerWeight': v(ws, f'I{base + 1}') or 0,
        'recyclingRate': v(ws, f'K{base + 1}') or 0, 'startupCycles': v(ws, f'O{base + 1}') or 0,
    })
materials_project = {'client': 'KIKO', 'reference': 'YZA067A', 'items': items, 'prices': {},
                     'note': "Classeur : le mélange maître de la synthèse est nommé « P9240C/P4052C » alors que les pièces utilisent « PT2338C »."}
materials_expected = {'resin': v(ws, 'E33'), 'mb': v(ws, 'E34')}

# ---------------------------------------------------------------- KIKO capacité
wb = openpyxl.load_workbook(CAP, data_only=True)
nom, pc, summ = wb['Nomenclature et phases '], wb['Production Capacity '], wb['Capacity Planning Summary']
KIND = {'injection': 'injection', 'metallization': 'metallization'}
inj_cycles = {s(v(pc, f'D{r}')): (v(pc, f'F{r}'), v(pc, f'G{r}')) for r in (6, 10, 14)}
met = (v(pc, 'F59'), v(pc, 'G59'))
start = {  # semaine de démarrage + montée en cadence (1re semaine) d'après la synthèse
    'YZA037AA|Injection': ('w20', 25000 / 84738.46), 'YZA037FA|Injection': ('w20', 25000 / 110160),
    'YZA037BA|Injection': ('w20', 25000 / 86968.42), 'Ultrasonic Welding': ('w20', 25000 / 82620),
    'Metallization': ('w20', 20000 / 75806.52), 'Silk screen': ('w21', 30000 / 96000),
    'Automatic assembling': ('w21', 20000 / 97200), 'Manual assembling': ('w21', 1.0),
}
ops = []
for r in range(7, 16):
    proc = s(v(nom, f'F{r}'))
    code = s(v(nom, f'E{r}'))
    kind = KIND.get(proc.lower(), 'cycle')
    op = {'id': f'op{r}', 'process': proc, 'component': s(v(nom, f'G{r}')), 'code': code, 'machine': s(v(nom, f'H{r}')),
          'kind': kind, 'machines': v(nom, f'I{r}'), 'availability': s(v(nom, f'J{r}')), 'delivery': s(v(nom, f'K{r}')),
          'hoursPerShift': v(nom, f'M{r}'), 'shiftsPerDay': v(nom, f'N{r}'), 'daysPerWeek': v(nom, f'O{r}'),
          'efficiency': v(nom, f'P{r}'), 'scrap': v(nom, f'Q{r}') or 0, 'modPerShift': v(nom, f'R{r}'), 'objective': v(nom, f'W{r}')}
    if kind == 'injection':
        op['machineCycle'], op['cavities'] = inj_cycles.get(code, (None, None))
    elif kind == 'metallization':
        op['speed'], op['jumps'], op['pitchMm'] = met[0], met[1], 44.45
        if r == 12:
            op['modPerShift'] = 0  # ligne partagée avec la cover (MOD déjà comptée)
    else:
        op['cycle'] = v(nom, f'L{r}')
    key = f'{code}|{proc}' if proc == 'Injection' else next((k for k in start if proc.startswith(k)), proc)
    sw, ramp = start.get(key, ('w20', 1.0))
    op['startWeek'], op['rampFirstWeek'] = sw, round(min(1, ramp), 4)
    ops.append(op)
weeks = [{'label': s(summ.cell(6, c).value), 'need': summ.cell(5, c).value or 0} for c in range(6, 21)]
capacity_project = {'client': 'KIKO', 'reference': 'YZA037', 'totalPieces': 650000, 'operations': ops, 'weeks': weeks}
capacity_expected = {s(v(nom, f'E{r}')) + '|' + s(v(nom, f'F{r}')): {'hourly': v(nom, f'T{r}'), 'weekly': v(nom, f'V{r}')} for r in range(7, 16)}

# ---------------------------------------------------------------- sorties
projects = [
    ('injection', 'SEPHORA YZA089A — chiffrage injection (cap + base)', 'SEPHORA', 'YZA089A', injection_project),
    ('materials', 'YZA067A — besoin matière injection (225 000 pcs)', 'KIKO', 'YZA067A', materials_project),
    ('capacity', 'KIKO YZA037 — capacité & planning 650K pièces', 'KIKO', 'YZA037', capacity_project),
]
sql = ["-- PRIVÉ (non versionné) — généré par supabase/build_seed_projets.py depuis les classeurs Excel.",
       "-- À exécuter APRÈS supabase/schema.sql. Ré-exécutable (pas de doublon).", ""]
for typ, title, client, ref, data in projects:
    payload = json.dumps(data, ensure_ascii=False).replace("'", "''")
    sql.append(
        "insert into public.mc_projects (type, title, client, reference, status, owner_id, data)\n"
        f"select '{typ}', '{title.replace(chr(39), chr(39) * 2)}', '{client}', '{ref}', 'en_cours',\n"
        "       (select id from public.mc_profiles where full_name = 'Seif' limit 1),\n"
        f"       $json${payload}$json$::jsonb\n"
        f"where not exists (select 1 from public.mc_projects where type = '{typ}' and reference = '{ref}');\n")
open('supabase/seed_projets.sql', 'w', encoding='utf-8').write('\n'.join(sql))
json.dump({'injection': {'data': injection_project, 'expected': injection_expected},
           'materials': {'data': materials_project, 'expected': materials_expected},
           'capacity': {'data': capacity_project, 'expected': capacity_expected}},
          open('web/src/lib/fixtures.private.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', injection_expected, materials_expected)
