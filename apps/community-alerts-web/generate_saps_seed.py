import openpyxl, json, random
from datetime import datetime
from collections import defaultdict
import calendar

SUBURB_MAP = {
    'Mitchells Plain':'mitch','Khayelitsha':'khaye','Gugulethu':'gugulethu',
    'Grassy Park':'grassy','Athlone':'athlone','Woodstock':'wood',
    'Claremont':'clar','Bellville':'bellv','Bellville South':'bellv',
    'Parow':'parow','Cape Town Central':'gardensct','Table View':'tableview',
    'Mowbray':'obs','Sea Point':'gardensct',
}
CRIME_TYPE_MAP = {
    'Murder':'crime','Attempted murder':'crime',
    'Robbery with aggravating circumstances':'crime','Common robbery':'crime',
    'Rape':'crime','Assault with the intent to inflict grievous bodily harm':'crime',
    'Common assault':'crime','Kidnapping':'crime','Carjacking':'crime',
    'Burglary at residential premises':'crime','Burglary at non-residential premises':'crime',
    'Theft of motor vehicle and motor cycle':'crime',
    'Arson':'fire','Public violence':'suspicious','Drug-related crime':'suspicious',
}
SEVERITY_MAP = {
    'Murder':5,'Attempted murder':5,'Carjacking':5,'Rape':5,'Kidnapping':5,
    'Robbery with aggravating circumstances':4,
    'Assault with the intent to inflict grievous bodily harm':4,'Arson':4,
    'Common robbery':3,'Burglary at residential premises':3,
    'Theft of motor vehicle and motor cycle':3,'Public violence':3,
    'Burglary at non-residential premises':2,'Common assault':2,'Drug-related crime':2,
}
SUBURB_COORDS = {
    'mitch':(-34.050,18.615),'khaye':(-34.042,18.676),'gugulethu':(-33.979,18.578),
    'grassy':(-34.027,18.500),'athlone':(-33.969,18.516),'wood':(-33.927,18.446),
    'obs':(-33.938,18.472),'clar':(-33.998,18.470),'bellv':(-33.900,18.629),
    'parow':(-33.897,18.581),'gardensct':(-33.930,18.417),'tableview':(-33.814,18.491),
}
SUBURB_NAMES = {
    'mitch':'Mitchells Plain','khaye':'Khayelitsha','gugulethu':'Gugulethu',
    'grassy':'Grassy Park','athlone':'Athlone','wood':'Woodstock',
    'obs':'Observatory','clar':'Claremont','bellv':'Bellville',
    'parow':'Parow','gardensct':'Gardens (CT)','tableview':'Table View',
}
TITLES = {
    'Murder':['Fatal shooting — {area}','Homicide at {station}','Murder reported — {area}'],
    'Attempted murder':['Shooting — {area}, victim critical','Attempted murder near {station}'],
    'Robbery with aggravating circumstances':['Armed robbery — {area}','Business robbery at {station}','Cash heist — {area}'],
    'Common robbery':['Street mugging — {area}','Phone snatch near {station}'],
    'Carjacking':['Carjacking at gunpoint — {area}','Vehicle hijacked — {area}'],
    'Rape':['Sexual assault reported — {area}'],
    'Kidnapping':['Abduction reported — {area}'],
    'Assault with the intent to inflict grievous bodily harm':['GBH assault — {area}','Serious assault at {station}'],
    'Common assault':['Assault reported — {area}','Domestic disturbance near {station}'],
    'Burglary at residential premises':['House break-in — {area}','Residential burglary at {station}'],
    'Burglary at non-residential premises':['Business burgled — {area}','Shop break-in near {station}'],
    'Theft of motor vehicle and motor cycle':['Vehicle stolen — {area}','Car theft at {station}'],
    'Arson':['Structure fire — {area}','Arson attack near {station}'],
    'Public violence':['Public disturbance — {area}','Protest action at {station}'],
    'Drug-related crime':['Drug bust — {area}','Narcotics seized at {station}'],
}
DESCS = {
    'Murder':'Victim found deceased. SAPS and forensics on scene. Area cordoned off.',
    'Attempted murder':'Victim with gunshot wound transported to hospital. Suspect at large.',
    'Robbery with aggravating circumstances':'Armed suspects robbed premises and fled. Description circulated to SAPS.',
    'Common robbery':'Victim robbed of personal belongings. Suspect fled on foot.',
    'Carjacking':'Vehicle taken at gunpoint. Registration circulated. SAPS tracking.',
    'Rape':'Incident reported and under investigation. Victim receiving support.',
    'Kidnapping':'Person reported abducted. Investigation underway.',
    'Assault with the intent to inflict grievous bodily harm':'Victim hospitalised with serious injuries. Suspect known to police.',
    'Common assault':'Altercation with injuries reported. Parties known to each other.',
    'Burglary at residential premises':'Suspects forced entry and stole electronics and valuables.',
    'Burglary at non-residential premises':'Business entered overnight. CCTV footage under review.',
    'Theft of motor vehicle and motor cycle':'Vehicle reported stolen. Circulated on SAPS system.',
    'Arson':'Fire deliberately set. Fire department attended. Under investigation.',
    'Public violence':'Group disturbance. Police deployed, situation stabilised.',
    'Drug-related crime':'Suspects arrested with narcotics. Charged and remanded.',
}
TAGS = {
    'Murder':['Fatal','Armed','SAPS forensics'],
    'Attempted murder':['Firearm','Critical','Hospitalised'],
    'Robbery with aggravating circumstances':['Armed','Business','Fled scene'],
    'Common robbery':['Street robbery','On foot','Phone/wallet'],
    'Carjacking':['Gunpoint','Vehicle','Circulated'],
    'Rape':['Sexual assault','Investigation'],
    'Kidnapping':['Abduction','Investigation'],
    'Assault with the intent to inflict grievous bodily harm':['GBH','Hospitalised','Serious'],
    'Common assault':['Domestic','Dispute','Injuries'],
    'Burglary at residential premises':['Break-in','Residential','Electronics'],
    'Burglary at non-residential premises':['Business','Overnight','CCTV'],
    'Theft of motor vehicle and motor cycle':['Vehicle theft','Circulated','SAPS'],
    'Arson':['Fire','Deliberate','Investigated'],
    'Public violence':['Group','Disturbance','Police'],
    'Drug-related crime':['Narcotics','Arrested','Charged'],
}

def extract_quarter(filepath, month_cols, quarter_label):
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb['RAW Data']
    rows = list(ws.iter_rows(values_only=True))
    result = []
    for row in rows[3:]:
        station = str(row[4] or '')
        district = str(row[5] or '')
        crime_cat = str(row[7] or '')
        if 'Cape Town' not in district:
            continue
        suburb_id = next((sid for sname, sid in SUBURB_MAP.items() if sname.lower() in station.lower()), None)
        if not suburb_id:
            continue
        inc_type = CRIME_TYPE_MAP.get(crime_cat)
        if not inc_type:
            continue
        total = int(row[28] or 0)
        if total == 0:
            continue
        entry = {
            'station': station, 'suburb_id': suburb_id, 'crime_category': crime_cat,
            'type': inc_type, 'severity': SEVERITY_MAP.get(crime_cat, 3),
            'quarter': quarter_label, 'total': total,
        }
        for col_idx, key in month_cols:
            entry[key] = int(row[col_idx] or 0)
        result.append(entry)
    return result

def make_date(year, month):
    _, days = calendar.monthrange(year, month)
    d = random.randint(1, days)
    return datetime(year, month, d, random.randint(0, 23), random.randint(0, 59)).isoformat()

def time_ago(iso):
    dt = datetime.fromisoformat(iso)
    now = datetime(2026, 1, 15)
    days = (now - dt).days
    if days < 1: return 'Today'
    if days < 30: return f'{days}d ago'
    return f'{days // 30}mo ago'

def jitter(c):
    return round(c + random.uniform(-0.011, 0.011), 5)

# Extract both quarters
q1_data = extract_quarter('/tmp/saps_q1.xlsx',
    [(25,'apr_2025'),(26,'may_2025'),(27,'jun_2025')], 'Q1_2025')
q3_data = extract_quarter('/tmp/saps_q3.xlsx',
    [(25,'oct_2025'),(26,'nov_2025'),(27,'dec_2025')], 'Q3_2025')

QUARTER_MONTHS = {
    'Q1_2025': [('apr_2025',2025,4),('may_2025',2025,5),('jun_2025',2025,6)],
    'Q3_2025': [('oct_2025',2025,10),('nov_2025',2025,11),('dec_2025',2025,12)],
}

# Build suburb heat weights from Q3 (most recent)
q3_by_suburb = defaultdict(int)
for r in q3_data:
    q3_by_suburb[r['suburb_id']] += r['total']
max_total = max(q3_by_suburb.values())
suburb_weights = {k: max(1, round((v / max_total) * 60)) for k, v in q3_by_suburb.items()}

# Also compute Q1 for trend comparison
q1_by_suburb = defaultdict(int)
for r in q1_data:
    q1_by_suburb[r['suburb_id']] += r['total']

# Print comparison table
print(f"{'Suburb':<14} {'Q1 Apr-Jun':>12} {'Q3 Oct-Dec':>12} {'Change':>10}")
print('-' * 52)
for sid in sorted(q3_by_suburb, key=lambda x: -q3_by_suburb[x]):
    q1v = q1_by_suburb.get(sid, 0)
    q3v = q3_by_suburb[sid]
    chg = ((q3v - q1v) / q1v * 100) if q1v else 0
    arrow = '+' if chg >= 0 else ''
    print(f"{SUBURB_NAMES.get(sid,sid):<20} {q1v:>8}     {q3v:>8}  {arrow}{chg:.1f}%")

# Generate incidents
incidents = []
iid = 1000
for row in q1_data + q3_data:
    sid = row['suburb_id']
    cat = row['crime_category']
    lat, lng = SUBURB_COORDS.get(sid, (-33.96, 18.55))
    area = SUBURB_NAMES.get(sid, sid)
    station = row['station']
    quarter = row['quarter']
    title_tpls = TITLES.get(cat, [f'{cat} — {area}'])
    desc = DESCS.get(cat, 'Incident reported.')
    tags = TAGS.get(cat, [cat])

    for month_key, yr, mo in QUARTER_MONTHS[quarter]:
        count = row.get(month_key, 0)
        if count == 0:
            continue
        created = make_date(yr, mo)
        incidents.append({
            'id': iid,
            'suburb': sid,
            'type': row['type'],
            'title': random.choice(title_tpls).format(area=area, station=station),
            'description': f'[SAPS {quarter} — {station}] {desc} Station monthly count: {count} incidents.',
            'tags': tags[:3],
            'time': time_ago(created),
            'createdAt': created,
            'lat': jitter(lat),
            'lng': jitter(lng),
            'severity': row['severity'],
            'comments': [],
            'commentCount': 0,
            'isFromBackend': False,
            'saps_station': station,
            'saps_crime_category': cat,
            'saps_quarter': quarter,
            'saps_monthly_count': count,
        })
        iid += 1

print(f"\nGenerated {len(incidents)} total incidents ({len([i for i in incidents if i['saps_quarter']=='Q1_2025'])} Q1 + {len([i for i in incidents if i['saps_quarter']=='Q3_2025'])} Q3)")

# Save incidents JSON
json.dump(incidents, open('/tmp/all_incidents.json', 'w'), indent=2)

# Build TypeScript fallback file
def alert_level(w):
    if w >= 40: return 'RED'
    if w >= 25: return 'ORANGE'
    if w >= 10: return 'YELLOW'
    return 'GREEN'

SUBURB_ORDER = ['mitch','khaye','gugulethu','grassy','athlone','wood','obs','clar','bellv','parow','gardensct','tableview']

ts_lines = [
    "// ─── SAPS Seed Data: Q1 2025 (Apr-Jun) + Q3 2025 (Oct-Dec) ─────────────────",
    "// Source: South African Police Service",
    "// https://www.saps.gov.za/services/crimestats.php",
    "//",
    "// DATA RETENTION POLICY:",
    "//   Live map:   show incidents < 90 days old (filter by createdAt in your API)",
    "//   Analytics:  keep all data for trend comparisons (12-24 months)",
    "//   Database:   never delete — set an 'archived' flag after 90 days",
    "//   Refresh:    new SAPS quarterly data drops ~6 weeks after each quarter ends",
    "//               Q2 (Jul-Sep) → available ~mid-November",
    "//               Q4 (Jan-Mar) → available ~mid-May",
    "//",
    "// SUBURB WEIGHTS: Calculated from Q3 2025 (most recent quarter) incident totals",
    "// ALERT LEVELS:   GREEN <10 | YELLOW 10-24 | ORANGE 25-39 | RED 40+",
    "",
    "import type { Suburb, Incident, ForumPostsBySuburb } from '@/lib/types';",
    "",
    "export const FALLBACK_SUBURBS: Suburb[] = [",
]

for sid in SUBURB_ORDER:
    lat, lng = SUBURB_COORDS[sid]
    name = SUBURB_NAMES[sid]
    w = suburb_weights.get(sid, 5)
    level = alert_level(w)
    q1v = q1_by_suburb.get(sid, 0)
    q3v = q3_by_suburb.get(sid, 0)
    ts_lines.append(f"  // Q1: {q1v} incidents | Q3: {q3v} incidents")
    ts_lines.append(f"  {{ id: '{sid}', name: '{name}', lat: {lat}, lng: {lng}, weight: {w}, alertLevel: '{level}' }},")

ts_lines.append("];")
ts_lines.append("")
ts_lines.append(f"// {len(incidents)} incidents from Q1 2025 and Q3 2025 SAPS data")
ts_lines.append("// Each entry = 1 crime category at 1 police station for 1 month")
ts_lines.append("export const SEED_INCIDENTS: Incident[] = " + json.dumps(incidents, indent=2) + " as unknown as Incident[];")
ts_lines.append("")
ts_lines.append("""export const FORUM_POSTS: ForumPostsBySuburb = {
  khaye: [
    { user: 'NomthandoS', avatar: '#ef4444', time: '2 hr ago', text: 'SAPS Q3 data shows Khayelitsha at 1,261 incidents Oct-Dec. CPF meeting this Saturday at the civic centre.', likes: 24, liked: false },
    { user: 'SiyandaM', avatar: '#3b82f6', time: '4 hr ago', text: 'New streetlights on Mew Way are finally working. Small win but it makes a difference.', likes: 11, liked: false },
  ],
  mitch: [
    { user: 'RasheedaN', avatar: '#f97316', time: '5 hr ago', text: 'Mitchells Plain Q3 was 2,733 incidents — up 20% from Q1. Westgate area is getting worse. Stay alert.', likes: 15, liked: false },
    { user: 'AbdullahK', avatar: '#a855f7', time: '8 hr ago', text: 'Community patrol was active last night around Westgate. Thanks to everyone who came out.', likes: 32, liked: false },
  ],
  wood: [
    { user: 'ClaireD', avatar: '#22c55e', time: '1 hr ago', text: "Car break-ins on Albert Rd every night this week. Don't leave anything visible in your car!", likes: 19, liked: false },
  ],
  obs: [
    { user: 'ZakM', avatar: '#3b82f6', time: '6 hr ago', text: 'Observatory had the biggest Q3 drop in the city — down 26% from Q1. Neighbourhood watch is working.', likes: 14, liked: false },
  ],
  gugulethu: [
    { user: 'ThembaD', avatar: '#22c55e', time: '3 hr ago', text: 'Gugulethu up 20% Q3 vs Q1 according to the SAPS stats. We need more police visibility on NY1.', likes: 8, liked: false },
  ],
  grassy: [], athlone: [], clar: [], bellv: [], parow: [], gardensct: [], tableview: [],
};""")

ts_content = '\n'.join(ts_lines)
with open('/tmp/saps_seed_data.ts', 'w') as f:
    f.write(ts_content)
print(f"TypeScript file: {len(ts_content):,} chars")
print("Saved: /tmp/saps_seed_data.ts")
