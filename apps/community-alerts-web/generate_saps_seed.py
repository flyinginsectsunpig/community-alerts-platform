import openpyxl, json, random, calendar
from datetime import datetime
from collections import defaultdict

ALL_STATIONS = {
    'Athlone':           (-33.9694, 18.5162, 'athlone',       'Athlone'),
    'Atlantis':          (-33.5880, 18.4919, 'atlantis',      'Atlantis'),
    'Belhar':            (-33.9604, 18.6305, 'belhar',        'Belhar'),
    'Bellville':         (-33.9001, 18.6293, 'bellville',     'Bellville'),
    'Bellville South':   (-33.9210, 18.6340, 'bellville_s',   'Bellville South'),
    'Bishop Lavis':      (-33.9453, 18.5800, 'bishop_lavis',  'Bishop Lavis'),
    'Bothasig':          (-33.8720, 18.5560, 'bothasig',      'Bothasig'),
    'Brackenfell':       (-33.8710, 18.6896, 'brackenfell',   'Brackenfell'),
    'Camps Bay':         (-33.9524, 18.3763, 'camps_bay',     'Camps Bay'),
    'Cape Town Central': (-33.9249, 18.4241, 'cbd',           'Cape Town CBD'),
    'Claremont':         (-33.9979, 18.4703, 'claremont',     'Claremont'),
    'Delft':             (-33.9820, 18.6410, 'delft',         'Delft'),
    'Dieprivier':        (-34.0320, 18.4910, 'dieprivier',    'Dieprivier'),
    'Durbanville':       (-33.8335, 18.6579, 'durbanville',   'Durbanville'),
    'Elsies River':      (-33.9390, 18.5690, 'elsies',        'Elsies River'),
    'Fish Hoek':         (-34.1365, 18.4290, 'fish_hoek',     'Fish Hoek'),
    'Goodwood':          (-33.9020, 18.5481, 'goodwood',      'Goodwood'),
    'Gordons Bay':       (-34.1650, 18.8640, 'gordons_bay',   "Gordon's Bay"),
    'Grassy Park':       (-34.0273, 18.5003, 'grassy',        'Grassy Park'),
    'Gugulethu':         (-33.9794, 18.5784, 'gugulethu',     'Gugulethu'),
    'Harare':            (-34.0010, 18.6880, 'harare',        'Harare'),
    'Hout Bay':          (-34.0486, 18.3535, 'hout_bay',      'Hout Bay'),
    'Kensington':        (-33.9400, 18.5200, 'kensington',    'Kensington'),
    'Khayelitsha':       (-34.0423, 18.6763, 'khayelitsha',   'Khayelitsha'),
    'Kirstenhof':        (-34.0580, 18.4820, 'kirstenhof',    'Kirstenhof'),
    'Kleinvlei':         (-34.0270, 18.6740, 'kleinvlei',     'Kleinvlei'),
    'Kraaifontein':      (-33.8448, 18.7241, 'kraaifontein',  'Kraaifontein'),
    'Kuilsrivier':       (-33.9349, 18.6781, 'kuilsrivier',   'Kuils River'),
    'Langa':             (-33.9497, 18.5296, 'langa',         'Langa'),
    'Lansdowne':         (-33.9960, 18.5030, 'lansdowne',     'Lansdowne'),
    'Lentegeur':         (-34.0565, 18.6285, 'lentegeur',     'Lentegeur'),
    'Lingelethu-West':   (-34.0180, 18.7100, 'lingelethu',    'Lingelethu-West'),
    'Lwandle':           (-34.1020, 18.8380, 'lwandle',       'Lwandle'),
    'Macassar':          (-34.0780, 18.7730, 'macassar',      'Macassar'),
    'Maitland':          (-33.9290, 18.5030, 'maitland',      'Maitland'),
    'Makhaza':           (-34.0340, 18.7040, 'makhaza',       'Makhaza'),
    'Manenberg':         (-33.9890, 18.5590, 'manenberg',     'Manenberg'),
    'Melkbosstrand':     (-33.7230, 18.4400, 'melkbos',       'Melkbosstrand'),
    'Mfuleni':           (-34.0110, 18.6980, 'mfuleni',       'Mfuleni'),
    'Milnerton':         (-33.8670, 18.4920, 'milnerton',     'Milnerton'),
    'Mitchells Plain':   (-34.0530, 18.6154, 'mitch',         'Mitchells Plain'),
    'Mowbray':           (-33.9480, 18.4740, 'mowbray',       'Mowbray'),
    'Muizenberg':        (-34.1060, 18.4710, 'muizenberg',    'Muizenberg'),
    'Nyanga':            (-33.9990, 18.5970, 'nyanga',        'Nyanga'),
    'Ocean View':        (-34.1810, 18.3780, 'ocean_view',    'Ocean View'),
    'Parow':             (-33.8970, 18.5811, 'parow',         'Parow'),
    'Philadelphia':      (-33.6950, 18.5750, 'philadelphia',  'Philadelphia'),
    'Philippi':          (-33.9980, 18.6160, 'philippi',      'Philippi'),
    'Philippi East':     (-34.0090, 18.6380, 'philippi_e',    'Philippi East'),
    'Pinelands':         (-33.9420, 18.5080, 'pinelands',     'Pinelands'),
    'Ravensmead':        (-33.9270, 18.5660, 'ravensmead',    'Ravensmead'),
    'Rondebosch':        (-33.9760, 18.4730, 'rondebosch',    'Rondebosch'),
    'Samora Machel':     (-34.0210, 18.6570, 'samora',        'Samora Machel'),
    'Sea Point':         (-33.9205, 18.3924, 'sea_point',     'Sea Point'),
    "Simon's Town":      (-34.1916, 18.4346, 'simons_town',   "Simon's Town"),
    'Somerset West':     (-34.0830, 18.8440, 'somerset_west', 'Somerset West'),
    'Steenberg':         (-34.0560, 18.4840, 'steenberg',     'Steenberg'),
    'Strand':            (-34.1148, 18.8280, 'strand',        'Strand'),
    'Strandfontein':     (-34.0870, 18.5590, 'strandfontein', 'Strandfontein'),
    'Table Bay Harbour': (-33.9063, 18.4278, 'harbour',       'Table Bay Harbour'),
    'Table View':        (-33.8143, 18.4910, 'tableview',     'Table View'),
    'Woodstock':         (-33.9270, 18.4460, 'woodstock',     'Woodstock'),
    'Wynberg':           (-34.0150, 18.4700, 'wynberg',       'Wynberg'),
}

CRIME_TYPE_MAP = {
    'Murder':'crime','Attempted murder':'crime',
    'Robbery with aggravating circumstances':'crime','Common robbery':'crime',
    'Rape':'crime','Assault with the intent to inflict grievous bodily harm':'crime',
    'Common assault':'crime','Kidnapping':'crime','Carjacking':'crime',
    'Burglary at residential premises':'crime','Burglary at non-residential premises':'crime',
    'Theft of motor vehicle and motor cycle':'crime',
    'Theft out of or from motor vehicle':'crime',
    'All theft not mentioned elsewhere':'crime',
    'Arson':'fire','Malicious damage to property':'suspicious',
    'Public violence':'suspicious','Drug-related crime':'suspicious',
    'Illegal possession of firearms and ammunition':'suspicious',
    'Driving under the influence of alcohol or drugs':'accident',
}
SEVERITY_MAP = {
    'Murder':5,'Attempted murder':5,'Carjacking':5,'Rape':5,'Kidnapping':5,
    'Robbery with aggravating circumstances':4,
    'Assault with the intent to inflict grievous bodily harm':4,'Arson':4,
    'Illegal possession of firearms and ammunition':4,
    'Common robbery':3,'Burglary at residential premises':3,
    'Theft of motor vehicle and motor cycle':3,'Public violence':3,
    'Malicious damage to property':3,
    'Burglary at non-residential premises':2,'Common assault':2,
    'Drug-related crime':2,'Theft out of or from motor vehicle':2,
    'All theft not mentioned elsewhere':1,
    'Driving under the influence of alcohol or drugs':2,
}
TITLES = {
    'Murder':['Fatal shooting in {area}','Homicide at {station}','Murder reported in {area}','Body found in {area}'],
    'Attempted murder':['Shooting in {area}, victim critical','Attempted murder near {station}','Gunshot victim in {area}'],
    'Robbery with aggravating circumstances':['Armed robbery in {area}','Business robbery at {station}','Aggravated robbery in {area}'],
    'Common robbery':['Street mugging in {area}','Phone snatch near {station}','Robbery on foot in {area}'],
    'Carjacking':['Carjacking at gunpoint in {area}','Vehicle hijacked in {area}'],
    'Rape':['Sexual assault reported in {area}'],
    'Kidnapping':['Abduction reported in {area}'],
    'Assault with the intent to inflict grievous bodily harm':['GBH assault in {area}','Stabbing near {station}'],
    'Common assault':['Assault in {area}','Domestic disturbance in {area}'],
    'Burglary at residential premises':['House break-in in {area}','Residential burglary at {station}'],
    'Burglary at non-residential premises':['Business burgled in {area}','Shop break-in near {station}'],
    'Theft of motor vehicle and motor cycle':['Vehicle stolen in {area}','Car theft at {station}'],
    'Theft out of or from motor vehicle':['Smash and grab in {area}','Car broken into near {station}'],
    'All theft not mentioned elsewhere':['Theft reported in {area}'],
    'Arson':['Structure fire in {area}','Arson attack near {station}'],
    'Malicious damage to property':['Property vandalised in {area}'],
    'Public violence':['Public disturbance in {area}','Protest action at {station}'],
    'Drug-related crime':['Drug bust in {area}','Narcotics seized at {station}'],
    'Illegal possession of firearms and ammunition':['Illegal firearm seized in {area}'],
    'Driving under the influence of alcohol or drugs':['Drunk driver arrested in {area}'],
}
DESCS = {
    'Murder':'Victim found deceased. SAPS and forensics on scene. Area cordoned off.',
    'Attempted murder':'Victim with gunshot wound hospitalised. Suspect at large.',
    'Robbery with aggravating circumstances':'Armed suspects robbed premises and fled. Description circulated.',
    'Common robbery':'Victim robbed of belongings. Suspect fled on foot.',
    'Carjacking':'Vehicle taken at gunpoint. Registration circulated. SAPS tracking.',
    'Rape':'Incident reported. Under investigation. Victim receiving support.',
    'Kidnapping':'Person abducted. Investigation underway.',
    'Assault with the intent to inflict grievous bodily harm':'Victim hospitalised with serious injuries.',
    'Common assault':'Altercation with injuries. Parties known to each other.',
    'Burglary at residential premises':'Suspects forced entry. Electronics and valuables taken.',
    'Burglary at non-residential premises':'Business entered overnight. CCTV under review.',
    'Theft of motor vehicle and motor cycle':'Vehicle stolen and circulated on SAPS system.',
    'Theft out of or from motor vehicle':'Window smashed and items stolen from vehicle.',
    'All theft not mentioned elsewhere':'Property reported stolen. Case opened.',
    'Arson':'Fire deliberately set. Fire department attended. Under investigation.',
    'Malicious damage to property':'Property deliberately damaged. Witnesses interviewed.',
    'Public violence':'Group disturbance. Police deployed, situation stabilised.',
    'Drug-related crime':'Suspects arrested with narcotics. Charged and remanded.',
    'Illegal possession of firearms and ammunition':'Unlicensed firearm seized. Suspect arrested.',
    'Driving under the influence of alcohol or drugs':'Driver arrested at sobriety checkpoint. Vehicle impounded.',
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
    'Theft out of or from motor vehicle':['Smash & grab','Window smashed'],
    'All theft not mentioned elsewhere':['Theft','Property'],
    'Arson':['Fire','Deliberate','Investigated'],
    'Malicious damage to property':['Vandalism','Damage'],
    'Public violence':['Group','Disturbance','Police'],
    'Drug-related crime':['Narcotics','Arrested','Charged'],
    'Illegal possession of firearms and ammunition':['Illegal firearm','Ammunition','Arrested'],
    'Driving under the influence of alcohol or drugs':['DUI','Sobriety','Impounded'],
}

def extract_quarter(filepath, month_cols, qlabel):
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb['RAW Data']
    rows = list(ws.iter_rows(values_only=True))
    result = []
    for row in rows[3:]:
        station = str(row[4] or '').strip()
        district = str(row[5] or '')
        crime_cat = str(row[7] or '').strip()
        if 'Cape Town' not in district: continue
        if station not in ALL_STATIONS: continue
        inc_type = CRIME_TYPE_MAP.get(crime_cat)
        if not inc_type: continue
        total = int(row[28] or 0)
        if total == 0: continue
        entry = {'station':station,'suburb_id':ALL_STATIONS[station][2],'crime_category':crime_cat,'type':inc_type,'severity':SEVERITY_MAP.get(crime_cat,2),'quarter':qlabel,'total':total}
        for col_idx, key in month_cols:
            entry[key] = int(row[col_idx] or 0)
        result.append(entry)
    return result

def make_date(year, month):
    _, days = calendar.monthrange(year, month)
    return datetime(year, month, random.randint(1,days), random.randint(0,23), random.randint(0,59)).isoformat()

def time_ago(iso):
    dt = datetime.fromisoformat(iso)
    days = (datetime(2026,1,15)-dt).days
    if days<1: return 'Today'
    if days<30: return f'{days}d ago'
    return f'{days//30}mo ago'

def jitter(c): return round(c+random.uniform(-0.008,0.008),5)

q1_data = extract_quarter('/tmp/saps_q1.xlsx',[(25,'apr_2025'),(26,'may_2025'),(27,'jun_2025')],'Q1_2025')
q3_data = extract_quarter('/tmp/saps_q3.xlsx',[(25,'oct_2025'),(26,'nov_2025'),(27,'dec_2025')],'Q3_2025')

QMONTHS = {
    'Q1_2025':[('apr_2025',2025,4),('may_2025',2025,5),('jun_2025',2025,6)],
    'Q3_2025':[('oct_2025',2025,10),('nov_2025',2025,11),('dec_2025',2025,12)],
}

q3_by_st = defaultdict(int)
q1_by_st = defaultdict(int)
for r in q3_data: q3_by_st[r['station']] += r['total']
for r in q1_data: q1_by_st[r['station']] += r['total']
max_val = max(q3_by_st.values())

print(f"\n{'Station':<25} {'Q1':>8} {'Q3':>8}  Change")
print('='*52)
for s,v in sorted(q3_by_st.items(),key=lambda x:-x[1]):
    q1v=q1_by_st.get(s,0); chg=((v-q1v)/q1v*100) if q1v else 0
    print(f"{s:<25} {q1v:>8} {v:>8}  {'+' if chg>=0 else ''}{chg:.1f}%")

incidents=[]
iid=1000
for row in q1_data+q3_data:
    sid=row['suburb_id']; cat=row['crime_category']; sname=row['station']; quarter=row['quarter']
    lat,lng,_,dname=ALL_STATIONS[sname]
    tpls=TITLES.get(cat,[f'{cat} in {dname}'])
    desc=DESCS.get(cat,'Incident reported.')
    tags=TAGS.get(cat,[cat])
    for mkey,yr,mo in QMONTHS[quarter]:
        count=row.get(mkey,0)
        if count==0: continue
        created=make_date(yr,mo)
        incidents.append({'id':iid,'suburb':sid,'type':row['type'],'title':random.choice(tpls).format(area=dname,station=sname),'description':f'[SAPS {quarter} — {sname}] {desc} Station monthly count: {count}.','tags':tags[:3],'time':time_ago(created),'createdAt':created,'lat':jitter(lat),'lng':jitter(lng),'severity':row['severity'],'comments':[],'commentCount':0,'isFromBackend':False,'saps_station':sname,'saps_crime_category':cat,'saps_quarter':quarter,'saps_monthly_count':count})
        iid+=1

print(f"\nTotal incidents: {len(incidents)}")
by_q=defaultdict(int)
for i in incidents: by_q[i['saps_quarter']]+=1
print(f"Q1: {by_q['Q1_2025']}  Q3: {by_q['Q3_2025']}")

def alert_level(w):
    if w>=45: return 'RED'
    if w>=25: return 'ORANGE'
    if w>=10: return 'YELLOW'
    return 'GREEN'

suburb_lines=[]
seen=set()
for sname,v in sorted(q3_by_st.items(),key=lambda x:-x[1]):
    lat,lng,sid,dname=ALL_STATIONS[sname]
    if sid in seen: continue
    seen.add(sid)
    w=max(1,round((v/max_val)*60))
    q1v=q1_by_st.get(sname,0)
    suburb_lines.append(f"  // {sname}: Q1={q1v} | Q3={v}")
    suburb_lines.append(f"  {{ id: '{sid}', name: '{dname}', lat: {lat}, lng: {lng}, weight: {w}, alertLevel: '{alert_level(w)}' }},")

all_ids=[ALL_STATIONS[s][2] for s in ALL_STATIONS]
forum_empty=', '.join([f"'{i}': []" for i in all_ids if i not in ['khayelitsha','mitch','nyanga','delft','manenberg','langa','woodstock','mowbray','cbd']])

ts = """// SAPS Full Cape Town — All 63 stations — Q1 + Q3 2025
// https://www.saps.gov.za/services/crimestats.php
// Weights from Q3 2025 (most recent). Refresh when new quarter drops.
// Retention: live map <90d | analytics 12-24mo | DB never delete

import type { Suburb, Incident, ForumPostsBySuburb } from '@/lib/types';

export const FALLBACK_SUBURBS: Suburb[] = [
""" + '\n'.join(suburb_lines) + """
];

// """ + str(len(incidents)) + """ incidents — """ + str(len(seen)) + """ Cape Town suburbs (all 63 SAPS stations)
export const SEED_INCIDENTS: Incident[] = """ + json.dumps(incidents,indent=2) + """ as unknown as Incident[];

export const FORUM_POSTS: ForumPostsBySuburb = {
  khayelitsha: [
    { user: 'NomthandoS', avatar: '#ef4444', time: '2 hr ago', text: 'Khayelitsha at 4,509 Q3 incidents. CPF meeting Saturday.', likes: 24, liked: false },
  ],
  mitch: [
    { user: 'RasheedaN', avatar: '#f97316', time: '5 hr ago', text: 'Mitchells Plain 9,410 Q3. Westgate area still dangerous.', likes: 15, liked: false },
  ],
  nyanga: [
    { user: 'BonganiM', avatar: '#ef4444', time: '1 hr ago', text: 'Nyanga 5,619 Q3. We need urgent government intervention.', likes: 41, liked: false },
  ],
  delft: [
    { user: 'FaridahK', avatar: '#f97316', time: '3 hr ago', text: 'Delft 8,471 — second highest. Gang violence out of control on N2 side.', likes: 28, liked: false },
  ],
  cbd: [
    { user: 'AndrewP', avatar: '#3b82f6', time: '30 min ago', text: 'CBD leads at 11,127 Q3 — mostly theft. Avoid the station precinct at night.', likes: 37, liked: false },
  ],
  woodstock: [
    { user: 'ClaireD', avatar: '#22c55e', time: '1 hr ago', text: "Car break-ins on Albert Rd every night. Don't leave anything visible!", likes: 19, liked: false },
  ],
  """ + forum_empty + """: [],
};
"""

with open('/tmp/fallback_full.ts','w') as f:
    f.write(ts)
print(f"TS file: {len(ts):,} chars")
print("Saved /tmp/fallback_full.ts")
