"""Read official store reports; persist aggregate counts only, never credentials."""
import csv
import base64
import datetime as dt
import gzip
import io
import json
import os
import subprocess
import time
from decimal import Decimal
from urllib.parse import quote

APPS = {
 'uz.nfcstore.nova': ('NFCSTORE', '6818677020'),
 'uz.labguide.app': ('LabGuide', '6820790275'),
 'uz.forensicexpert.forensic_expert': ('FORENSIC EXPERT', '6819664116'),
 'uz.dentalexpert.app': ('Dental Expert', '6823927030'),
 'uz.nurseguide.app': ('NurseGuide', '6824262978'),
 'uz.bugunbor.app': ('BugunBor', '6821543877'),
 'com.mysteryroom.forgotteninstitute': ('Mystery Room', '6820786933'),
 'uz.hasharchilar.app': ('Hasharchilar', '6821544730'),
}
BUCKET = 'pubsite_prod_5851765534137174252'
VENDOR = '94930384'

def normalize_apple_key(value):
    value = value.strip().replace('\\n','\n')
    if '-----BEGIN PRIVATE KEY-----' in value: return value+'\n'
    body = ''.join(value.split())
    decoded = base64.b64decode(body,validate=True)
    if b'-----BEGIN PRIVATE KEY-----' in decoded: return decoded.decode().strip()+'\n'
    # The existing CI also accepts the base64 body of a PKCS#8 PEM.
    return '-----BEGIN PRIVATE KEY-----\n'+'\n'.join(body[i:i+64] for i in range(0,len(body),64))+'\n-----END PRIVATE KEY-----\n'

def decode_csv(raw, delimiter=','):
    if raw.startswith(b'\x1f\x8b'):
        raw = gzip.decompress(raw)
    encoding = 'utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'
    text = raw.decode(encoding)
    if '\x00' in text:
        text = raw.decode('utf-16-le')
    return [{str(k).strip(): v for k,v in r.items() if k is not None}
            for r in csv.DictReader(io.StringIO(text), delimiter=delimiter)]

def integer(value):
    if value in (None, ''): return None
    number = Decimal(str(value).replace(',', ''))
    if number != number.to_integral_value(): raise ValueError('fractional_count')
    return int(number)

def parse_google(raw, package, today):
    rows = [r for r in decode_csv(raw) if r.get('Package Name',r.get('Package name')) == package
            and r.get('Date','') < today.isoformat()]
    if not rows: return None
    # Overview has exactly one aggregate row per day. Reject a breakdown
    # rather than counting daily totals multiple times.
    by_day = {}
    for r in rows:
        day = dt.date.fromisoformat(r['Date']).isoformat()
        if day in by_day: raise ValueError('duplicate_overview_day')
        by_day[day] = {key: integer(r.get(header)) for key,header in {
          'newUsers':'Daily User Installs', 'deviceInstalls':'Daily Device Installs',
          'uninstalls':'Daily User Uninstalls', 'activeDevices':'Installs on active devices',
          'currentUsers':'Current User Installs', 'totalUsers':'Total User Installs',
        }.items()}
        if by_day[day]['activeDevices'] is None:
            by_day[day]['activeDevices'] = integer(r.get('Installs On Active Devices'))
    latest = max(by_day)
    if all(v is None for v in by_day[latest].values()): raise ValueError('unknown_google_columns')
    return {'status':'ok','date':latest,**by_day[latest], 'days':by_day}

def google_reports(today):
    raw_key = os.environ.get('PLAY_SA_JSON','')
    if not raw_key: return {p:{'status':'missing_key'} for p in APPS}
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import AuthorizedSession
        creds = service_account.Credentials.from_service_account_info(json.loads(raw_key), scopes=['https://www.googleapis.com/auth/devstorage.read_only'])
        session = AuthorizedSession(creds)
    except Exception: return {p:{'status':'invalid_key'} for p in APPS}
    months = {today.strftime('%Y%m'),(today-dt.timedelta(days=32)).strftime('%Y%m')}
    result = {}
    denied = False
    for package in APPS:
        if denied:
            result[package]={'status':'http_403'}; continue
        combined = {}
        status = 'no_report'
        for month in sorted(months):
            obj = f'stats/installs/installs_{package}_{month}_overview.csv'
            url = f'https://storage.googleapis.com/download/storage/v1/b/{BUCKET}/o/{quote(obj,safe="")}?alt=media'
            try:
                response = session.get(url,timeout=30)
                if response.status_code in (401,403):
                    status=f'http_{response.status_code}'; denied=True; break
                if response.status_code == 404: continue
                if response.status_code != 200:
                    status=f'http_{response.status_code}'; continue
                parsed = parse_google(response.content,package,today)
                if parsed: combined.update(parsed['days'])
            except Exception: status='fetch_or_format_error'
        if combined:
            latest = max(combined)
            recent = {day:v for day,v in combined.items() if (today-dt.timedelta(days=30)).isoformat() <= day < today.isoformat()}
            sums = {}
            for span in (7,30):
                subset = [v for day,v in recent.items() if day >= (today-dt.timedelta(days=span)).isoformat()]
                sums[str(span)] = {'coveredDays':len(subset), 'newUsers':sum(v['newUsers'] for v in subset) if subset and all(v['newUsers'] is not None for v in subset) else None}
            result[package]={'status':'ok','date':latest,**combined[latest],'periods':sums}
        else: result[package]={'status':status}
    return result

def parse_apple(raw, report_date):
    rows = decode_csv(raw,'\t')
    if not rows: return {}
    if 'Product Type Identifier' not in rows[0] or 'Units' not in rows[0]: raise ValueError('unknown_apple_columns')
    ids = {v[1]:p for p,v in APPS.items()}
    result = {p:{'newDownloads':0,'redownloads':0,'updates':0,'refunds':0} for p in APPS}
    fields = {'1':'newDownloads','1F':'newDownloads','1T':'newDownloads', '3':'redownloads','3F':'redownloads','7':'updates','7F':'updates','7T':'updates'}
    for r in rows:
        package = ids.get(r.get('Apple Identifier','').strip())
        field = fields.get(r.get('Product Type Identifier','').strip())
        if not package or not field: continue  # IAPs and subscriptions are not downloads.
        units = integer(r['Units'])
        if units is None: raise ValueError('missing_units')
        if units < 0: result[package]['refunds'] += -units
        else: result[package][field] += units
    return {p:{'date':report_date,**v} for p,v in result.items()}

def apple_reports(today):
    key = os.environ.get('APPLE_PRIVATE_KEY','')
    issuer = os.environ.get('APPLE_ISSUER_ID','')
    kid = os.environ.get('APPLE_KEY_ID','')
    if not all((key,issuer,kid)): return {p:{'status':'missing_key'} for p in APPS}
    try:
        import jwt
        import requests
        now = int(time.time())
        token = jwt.encode({'iss':issuer,'iat':now,'exp':now+900,'aud':'appstoreconnect-v1'},normalize_apple_key(key),algorithm='ES256',headers={'kid':kid,'typ':'JWT'})
    except Exception: return {p:{'status':'invalid_key'} for p in APPS}
    days = {p:[] for p in APPS}
    status = 'no_report'
    for offset in range(1,8):
        day = (today-dt.timedelta(days=offset)).isoformat()
        try:
            r = requests.get('https://api.appstoreconnect.apple.com/v1/salesReports',headers={'Authorization':f'Bearer {token}'},params={
             'filter[frequency]':'DAILY','filter[reportDate]':day,'filter[reportSubType]':'SUMMARY',
             'filter[reportType]':'SALES','filter[vendorNumber]':VENDOR,'filter[version]':'1_0'},timeout=30)
            if r.status_code in (401,403): status=f'http_{r.status_code}'; break
            if r.status_code == 404: continue  # Unavailable is never fabricated zero.
            if r.status_code != 200: status=f'http_{r.status_code}'; continue
            parsed = parse_apple(r.content,day)
            for p,v in parsed.items(): days[p].append(v)
        except Exception: status='fetch_or_format_error'
    result = {}
    for p,records in days.items():
        if not records: result[p]={'status':status}; continue
        latest = max(records,key=lambda r:r['date'])
        result[p]={'status':'ok',**latest,'availableDays':len(records),'availableDayDownloads':sum(r['newDownloads'] for r in records)}
    return result

def persist_snapshot(snapshot):
    # Reuse the existing UZ server credential only inside the runner. No
    # key is copied into source, artifacts, the snapshot, Telegram or logs.
    import requests
    host = os.environ['UZ_VPS_HOST']
    if not host or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:' for c in host): raise ValueError('invalid_host')
    token = subprocess.check_output(['sshpass','-e','ssh','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=20','-o','LogLevel=ERROR',f'root@{host}', '. /srv/nfcstore/secrets.env && printf %s "$DB_TOKEN"'],timeout=40,text=True).strip()
    if not token: raise ValueError('missing_db_token')
    # Mask before any subsequent operation can fail. Never print HTTP bodies.
    print('::add-mask::'+token)
    value = json.dumps(snapshot,separators=(',',':'))
    body = {'requests':[{'type':'execute','stmt':{'sql':"INSERT INTO admin_settings (key,value) VALUES ('store_downloads_snapshot_v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",'args':[{'type':'text','value':value}],'want_rows':False}},{'type':'close'}]}
    r = requests.post('https://db.nfcstore.uz/v2/pipeline',headers={'Authorization':f'Bearer {token}'},json=body,timeout=30)
    if r.status_code != 200: raise ValueError('snapshot_write_failed')
    data = r.json()
    if 'error' in data or not data.get('results') or any(x.get('type') == 'error' for x in data['results']): raise ValueError('snapshot_sql_failed')

def main():
    today = dt.datetime.now(dt.timezone.utc).date()
    snapshot = {'version':1,'fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(), 'google':google_reports(today),'apple':apple_reports(today)}
    for store in ('google','apple'):
        for package,row in snapshot[store].items():
            print(f'{store} {APPS[package][0]}: {row["status"]}'+(f' reportDate={row["date"]}' if 'date' in row else ''))
    if os.environ.get('WRITE_SNAPSHOT','false') == 'true':
        persist_snapshot(snapshot)
        print('Aggregate store snapshot saved.')
    if os.environ.get('WRITE_OUTPUT','false') == 'true':
        with open('store-snapshot.json','w') as f: json.dump(snapshot,f)

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('::error::store_report_failed ('+type(error).__name__+')')
        raise SystemExit(1)  # Never traceback credentials or report rows.
