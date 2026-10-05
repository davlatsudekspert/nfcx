"""NFCSTORE Nova — App Store Connect: metadata, skrinshotlar, build, yuborish.

Egasining ruxsati (2026-10-04): App Store Connect'ni API orqali to'ldirish;
review'ga yuborish FAQAT egasi "chiqar" deganidan keyin (mode=submit).

Rejimlar (argv[1]):
  fill    — matnlar, URL'lar, kategoriya, yosh reytingi, content rights,
            copyright, review ma'lumotlari (demo akkaunt), mavjudlik
  shots   — ci/asc/screenshots/*.png ni en-US 6.7" to'plamiga yuklaydi
            (eski skrinshotlar almashtiriladi)
  attach  — BUILD raqamli build'ni versiyaga biriktiradi
  submit  — versiyani App Review'ga yuboradi

Natija ::notice:: annotatsiyalarida. Parol hech qachon chiqarilmaydi.
"""
import base64, hashlib, json, os, sys, time, urllib.error, urllib.parse, urllib.request
import jwt

KEY = open(os.environ['ASC_KEY_FILE']).read()
BUNDLE = os.environ.get('IOS_BUNDLE_ID', 'uz.nfcstore.nova')
API = 'https://api.appstoreconnect.apple.com'
LOG = []


def tok():
    now = int(time.time())
    return jwt.encode({'iss': os.environ['API_ISSUER_ID'], 'iat': now, 'exp': now + 1100,
                       'aud': 'appstoreconnect-v1'}, KEY, algorithm='ES256',
                      headers={'kid': os.environ['API_KEY_ID'], 'typ': 'JWT'})


def call(method, path, body=None, params=None, raw_url=None, data=None, headers=None):
    url = raw_url or (API + path + ('?' + urllib.parse.urlencode(params) if params else ''))
    h = headers or {'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json'}
    payload = data if data is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=payload, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            txt = r.read()
            return r.status, (json.loads(txt) if txt and r.headers.get('Content-Type', '').startswith('application/json') else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            j = json.loads(txt)
            parts = []
            for x in j.get('errors', []):
                parts.append(f"{x.get('code')}: {x.get('detail')} {((x.get('source') or {}).get('pointer') or '')}")
                # 409 "check associated errors" — haqiqiy sabablar meta.associatedErrors ichida.
                for res, errs in ((x.get('meta') or {}).get('associatedErrors') or {}).items():
                    for ae in errs or []:
                        parts.append(f"  ↳ {res}: {ae.get('code')}: {ae.get('detail')}")
            msg = '; '.join(parts)[:3000]
        except Exception:
            msg = txt
        return e.code, {'_error': msg}


def note(line):
    LOG.append(str(line))
    print(line)


def flush(title):
    # Annotatsiya: bitta notice, qatorlar %0A bilan.
    for i in range(0, len(LOG), 40):
        chunk = LOG[i:i + 40]
        msg = '%0A'.join(l.replace('%', '%25').replace('\n', ' ') for l in chunk)
        print(f'::notice title={title} {i // 40 + 1}::{msg}')


def ok(code):
    return 200 <= code < 300


# ── matnlar ────────────────────────────────────────────────────────────
DESCRIPTION = """NFCSTORE turns a tap into a connection. Create your digital business card, link it to an NFC card or sticker, and share your contacts, links and work with one touch.

• Digital profile — name, photo, bio, phone, messengers, social links and a QR code in one place.
• NFC writing — write your profile link to an NFC card or sticker straight from your iPhone, and activate NFCSTORE stickers with their code.
• Business pages — present your company with a cover, logo, contacts and a product or service catalog.
• Feed, Reels and Stories — share photos, short videos and stories; like, comment and save.
• Analytics — see how many people viewed your profile, posts and Reels.
• Safety — report and block, content rules, automatic screening of uploads, PIN / Face ID app lock and in-app account deletion.

The person you share with doesn't need the app: your profile opens in any phone's browser.

NFCSTORE is made in Uzbekistan and available in Uzbek, Russian and English."""

# Qidiruv uchun (egasi, 2026-10-05): "NFC tools" deb qidirganlar topsin,
# lekin "NFC Tools" brend iborasi va "Instagram" so'zi ISHLATILMAYDI.
APP_NAME = "NFCSTORE: Social NFC"
KEYWORDS_LIST = ['nfc', 'tools', 'tag', 'writer', 'reader', 'yozish', 'vizitka', 'social', 'reels',
                 'biznes', 'qr', 'card', 'profil', 'karta']
PROMO = "Tap. Share. Connect — your social NFC profile, feed and Reels on an NFC card or sticker."
SUBTITLE = "NFC Writer, Social ID, Reels"

# "What's New" — YANGILANISH matni (birinchi versiyada Apple uni qabul
# qilmaydi; yangilanishda MAJBURIY). Faqat ilovada HAQIQATAN bor narsa
# yoziladi: va'da qilingan, lekin yo'q imkoniyat — rad etish sababi (2.3).
WHATS_NEW = {
    'en': """What's new in 1.1.1

• Reels: new Friends tab — the latest reels from people and businesses you follow, in one place.
• Stories: swipe between people, hold to pause (videos too), new stories are marked with a ring, and you can see how many people viewed your story.
• Notifications: tapping a like or a comment now opens that exact post or reel.
• Posts: tap a photo to zoom, double-tap a video to like, see when it was posted, and load more comments.
• Comments: authors can remove comments under their posts; businesses can delete their own posts.
• Reels: "Not interested" hides a reel you don't want to see.
• Music: the profile music player now also plays and pauses Yandex Music.
• Faster loading and stability improvements.""",
    'ru': """Что нового в 1.1.1

• Reels: новая вкладка «Друзья» — свежие Reels людей и бизнесов, на которых вы подписаны.
• Истории: листайте между людьми, удерживайте для паузы (и видео тоже), новые истории отмечены кольцом, видно число просмотров вашей истории.
• Уведомления: нажатие на лайк или комментарий открывает именно тот пост или Reels.
• Посты: увеличение фото по нажатию, двойное касание видео — лайк, время публикации и загрузка новых комментариев.
• Комментарии: автор может удалять комментарии под своими постами; бизнес может удалять свои посты.
• Reels: «Не интересно» скрывает ненужный ролик.
• Музыка: плеер профиля теперь включает и ставит на паузу Яндекс Музыку.
• Быстрее загрузка и улучшения стабильности.""",
}

REVIEW_NOTES = """Sign-in is required. Please use the demo account above (it already has a personal profile, posts and a business page).

How to review:
1) Log in with the demo account.
2) Home shows the user's NFC ID card; Profile shows the digital business card; Feed and Reels show posts. At the top of Reels, the "Friends" tab shows reels only from accounts the user follows (it shows an explanation if the account follows nobody yet).
3) NFC is optional: NFC Center → "Write to NFC card" writes the profile link to any blank NFC tag (NTAG213/215/216). Every feature can be reviewed without a tag — profiles are also shared by link and QR code.
4) Account deletion: Settings → Account → Security → Delete account. Please test it on a newly registered account, not on the demo account.
5) Report / block: on any post, Reel, comment or profile tap "•••" → Report or Block.
6) The app has no in-app purchases and no paid features; posting, Reels, stories and comments are free for everyone. Physical NFC cards and stickers are sold offline.
7) Uploaded photos and videos are screened automatically for safety by an AI service (Google Gemini). Users are told this and give consent on the content rules screen before posting.
Registration needs an email address (a 6-digit code is sent by email) and a phone number for the contact card."""


def keywords():
    out = ''
    for k in KEYWORDS_LIST:
        nxt = (out + ',' + k) if out else k
        if len(nxt) > 100:
            break
        out = nxt
    return out


def app_id():
    c, j = call('GET', '/v1/apps', params={'filter[bundleId]': BUNDLE})
    apps = [a for a in j.get('data', []) if a['attributes']['bundleId'] == BUNDLE]
    if not apps:
        print('::error::ilova topilmadi'); sys.exit(1)
    return apps[0]['id']


def edit_version(aid):
    c, j = call('GET', f'/v1/apps/{aid}/appStoreVersions', params={'filter[platform]': 'IOS', 'limit': 10})
    existing = j.get('data', [])
    for v in existing:
        if v['attributes'].get('appStoreState') in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED',
                                                   'METADATA_REJECTED', 'INVALID_BINARY'):
            return v
    # Yangilanish (masalan 1.1.1): oldingi versiya chiqib bo'lgan, yangisi
    # hali yo'q — APP_VERSION berilgan bo'lsa yaratiladi. Ko'rib
    # chiqilayotgan versiya bo'lsa Apple o'zi rad etadi (409) va u
    # TEGILMAYDI: navbatdagi versiya bekor qilinmaydi.
    ver = os.environ.get('APP_VERSION', '').strip()
    if ver:
        c, j = call('POST', '/v1/appStoreVersions', {'data': {'type': 'appStoreVersions',
                    'attributes': {'platform': 'IOS', 'versionString': ver},
                    'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}}}})
        note(f'yangi versiya {ver} -> {c} {j.get("_error", "")}')
        if ok(c):
            return j['data']
        states = [f"{v['attributes'].get('versionString')}={v['attributes'].get('appStoreState')}" for v in existing]
        note(f'versiyalar: {states}')
    flush('ASC versiya')
    print('::error::tahrirlanadigan versiya yo‘q'); sys.exit(1)


def en_loc(vid):
    c, j = call('GET', f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations')
    for l in j.get('data', []):
        if l['attributes']['locale'] == 'en-US':
            return l
    return (j.get('data') or [None])[0]


# ── fill ───────────────────────────────────────────────────────────────
def fill():
    aid = app_id()
    v = edit_version(aid); vid = v['id']
    # versiya: copyright + qo'lda chiqarish (birinchi reliz egasi tanlagan paytda)
    c, j = call('PATCH', f'/v1/appStoreVersions/{vid}', {'data': {'type': 'appStoreVersions', 'id': vid,
                'attributes': {'copyright': '2026 NFCSTORE', 'releaseType': 'MANUAL'}}})
    note(f'versiya copyright/releaseType=MANUAL -> {c} {j.get("_error", "")}')
    loc = en_loc(vid)
    attrs = {'description': DESCRIPTION, 'keywords': keywords(), 'promotionalText': PROMO,
             'supportUrl': 'https://nfcstore.uz/aloqa', 'marketingUrl': 'https://nfcstore.uz'}
    if loc:
        c, j = call('PATCH', f"/v1/appStoreVersionLocalizations/{loc['id']}", {'data': {
            'type': 'appStoreVersionLocalizations', 'id': loc['id'], 'attributes': attrs}})
        note(f"en-US matnlar ({len(DESCRIPTION)} belgi, kalit so'z {len(attrs['keywords'])}) -> {c} {j.get('_error', '')}")
    # What's New — har bir til uchun (ru-* -> ruscha, qolgani inglizcha).
    # Birinchi versiyada Apple bu maydonni rad etadi — bu xato emas.
    c, j = call('GET', f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations')
    for l in j.get('data', []):
        loc_code = l['attributes']['locale']
        text = WHATS_NEW['ru' if loc_code.startswith('ru') else 'en']
        c2, j2 = call('PATCH', f"/v1/appStoreVersionLocalizations/{l['id']}", {'data': {
            'type': 'appStoreVersionLocalizations', 'id': l['id'], 'attributes': {'whatsNew': text}}})
        note(f"[{loc_code}] What's New ({len(text)} belgi) -> {c2} {j2.get('_error', '')}")
    # app info: subtitle, privacy URL, kategoriya, yosh reytingi
    c, j = call('GET', f'/v1/apps/{aid}/appInfos')
    infos = [i for i in j.get('data', []) if i['attributes'].get('appStoreState') not in ('READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO')] or j.get('data', [])
    info = infos[0]; iid = info['id']
    c, j = call('GET', f'/v1/appInfos/{iid}/appInfoLocalizations')
    for l in j.get('data', []):
        if l['attributes']['locale'] == 'en-US':
            c2, j2 = call('PATCH', f"/v1/appInfoLocalizations/{l['id']}", {'data': {'type': 'appInfoLocalizations', 'id': l['id'],
                          'attributes': {'name': APP_NAME, 'subtitle': SUBTITLE, 'privacyPolicyUrl': 'https://nfcstore.uz/privacy'}}})
            note(f'nom + subtitle + privacy URL -> {c2} {j2.get("_error", "")}')
    c, j = call('PATCH', f'/v1/appInfos/{iid}', {'data': {'type': 'appInfos', 'id': iid, 'relationships': {
        'primaryCategory': {'data': {'type': 'appCategories', 'id': 'SOCIAL_NETWORKING'}},
        'secondaryCategory': {'data': {'type': 'appCategories', 'id': 'BUSINESS'}}}}})
    note(f'kategoriya Social Networking + Business -> {c} {j.get("_error", "")}')
    age_rating(iid)
    c, j = call('PATCH', f'/v1/apps/{aid}', {'data': {'type': 'apps', 'id': aid,
                'attributes': {'contentRightsDeclaration': 'USES_THIRD_PARTY_CONTENT'}}})
    note(f'content rights (third-party content, huquq bor) -> {c} {j.get("_error", "")}')
    review_detail(vid)
    availability(aid)
    flush('ASC fill')


AGE_TRUE = {'userGeneratedContent', 'advertising'}
AGE_BOOL_FALSE = {'gambling', 'lootBox', 'messagingAndChat', 'parentalControls', 'ageAssurance',
                  'healthOrWellnessTopics', 'unrestrictedWebAccess', 'seventeenPlus'}


def age_rating(iid):
    # Apple hamma maydonni BITTA so'rovda talab qiladi (alohida — 409).
    c, j = call('GET', f'/v1/appInfos/{iid}/ageRatingDeclaration')
    d = j.get('data') if isinstance(j.get('data'), dict) else None
    if not d:
        note(f'yosh reytingi o‘qilmadi -> {c} {j.get("_error", "")}'); return
    did = d['id']; cur = d['attributes']
    note('yosh reytingi maydonlari: ' + ', '.join(f'{k}={v}' for k, v in sorted(cur.items())))
    bools_true = {'userGeneratedContent', 'advertising', 'socialMedia'}
    skip = {'kidsAgeBand', 'ageRatingOverride', 'ageRatingOverrideV2', 'koreaAgeRatingOverride',
            'developerAgeRatingInfoUrl', 'gracRatingClassificationNumber'}
    enum_keys = {'alcoholTobaccoOrDrugUseOrReferences', 'contests', 'gamblingSimulated', 'gunsOrOtherWeapons',
                 'horrorOrFearThemes', 'matureOrSuggestiveThemes', 'medicalOrTreatmentInformation',
                 'profanityOrCrudeHumor', 'sexualContentGraphicAndNudity', 'sexualContentOrNudity',
                 'violenceCartoonOrFantasy', 'violenceRealistic', 'violenceRealisticProlongedGraphicOrSadistic'}
    attrs = {}
    for k in cur:
        if k in skip:
            continue
        attrs[k] = 'NONE' if k in enum_keys else (k in bools_true)
    c, jj = call('PATCH', f'/v1/ageRatingDeclarations/{did}', {'data': {'type': 'ageRatingDeclarations', 'id': did, 'attributes': attrs}})
    note(f'yosh reytingi (UGC, reklama, ijtimoiy tarmoq = ha; qolgani yo‘q) -> {c} {jj.get("_error", "")}')
    for k, val in (('ageRatingOverrideV2', 'EIGHTEEN_PLUS'), ('ageRatingOverride', 'SEVENTEEN_PLUS')):
        if k not in cur:
            continue
        c, jj = call('PATCH', f'/v1/ageRatingDeclarations/{did}', {'data': {'type': 'ageRatingDeclarations', 'id': did,
                     'attributes': {**attrs, k: val}}})
        note(f'{k}={val} -> {c} {jj.get("_error", "")}')
        if ok(c):
            break


def review_detail(vid):
    # Demo akkaunt login/paroli bu yerdan YOZILMAYDI (maxfiy qiymat CI
    # kiritmalarida ko'rinib qolmasin) — egasi App Store Connect'da o'zi
    # kiritadi. Bu yerda faqat kontakt va izoh.
    attrs = {'contactFirstName': 'NFCSTORE', 'contactLastName': 'Support',
             'contactPhone': '+998500908277', 'contactEmail': 'davlatsudekspert@gmail.com',
             'demoAccountRequired': True, 'notes': REVIEW_NOTES}
    c, j = call('GET', f'/v1/appStoreVersions/{vid}/appStoreReviewDetail')
    rd = j.get('data') if isinstance(j.get('data'), dict) else None
    if rd:
        c, j = call('PATCH', f"/v1/appStoreReviewDetails/{rd['id']}", {'data': {'type': 'appStoreReviewDetails', 'id': rd['id'], 'attributes': attrs}})
    else:
        c, j = call('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': attrs,
                    'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})
    note(f"review ma'lumotlari (kontakt, demo akkaunt, izoh {len(REVIEW_NOTES)} belgi) -> {c} {j.get('_error', '')}")


def availability(aid):
    c, j = call('GET', f'/v1/apps/{aid}/appAvailabilityV2')
    if ok(c) and isinstance(j.get('data'), dict):
        note('mavjudlik allaqachon bor'); return
    c, j = call('GET', '/v1/territories', params={'limit': 200})
    terr = [t['id'] for t in j.get('data', [])]
    inc, rel = [], []
    for i, t in enumerate(terr):
        lid = f'${{t{i}}}'
        rel.append({'type': 'territoryAvailabilities', 'id': lid})
        inc.append({'type': 'territoryAvailabilities', 'id': lid, 'attributes': {'available': True},
                    'relationships': {'territory': {'data': {'type': 'territories', 'id': t}}}})
    c, j = call('POST', '/v2/appAvailabilities', {'data': {'type': 'appAvailabilities', 'attributes': {'availableInNewTerritories': True},
                'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}, 'territoryAvailabilities': {'data': rel}}}, 'included': inc})
    note(f'mavjudlik: {len(terr)} hudud -> {c} {j.get("_error", "")[:200]}')


def free_price(aid):
    # Ilova bepul: asosiy hudud USA, narx nuqtasi 0.00. Qo'lda narx bo'lsa tegmaydi.
    c, j = call('GET', f'/v1/appPriceSchedules/{aid}/manualPrices', params={'limit': 5})
    if ok(c) and j.get('data'):
        note(f"narx allaqachon bor ({len(j['data'])} yozuv)"); return
    pp, url = None, None
    params = {'filter[territory]': 'USA', 'limit': 200}
    while not pp:
        c, j = call('GET', f'/v1/apps/{aid}/appPricePoints', params=params, raw_url=url)
        if not ok(c):
            note(f'narx nuqtalari -> {c} {j.get("_error", "")}'); return
        pp = next((x['id'] for x in j.get('data', []) if float(x['attributes'].get('customerPrice') or 1) == 0.0), None)
        url = (j.get('links') or {}).get('next')
        if not url:
            break
    if not pp:
        note('0.00 narx nuqtasi topilmadi'); return
    c, j = call('POST', '/v1/appPriceSchedules', {'data': {'type': 'appPriceSchedules', 'relationships': {
        'app': {'data': {'type': 'apps', 'id': aid}},
        'baseTerritory': {'data': {'type': 'territories', 'id': 'USA'}},
        'manualPrices': {'data': [{'type': 'appPrices', 'id': '${p0}'}]}}},
        'included': [{'type': 'appPrices', 'id': '${p0}', 'attributes': {'startDate': None},
                      'relationships': {'appPricePoint': {'data': {'type': 'appPricePoints', 'id': pp}}}}]})
    note(f'narx: bepul (USA asos, 0.00) -> {c} {j.get("_error", "")}')


# ── shots ──────────────────────────────────────────────────────────────
def shots():
    aid = app_id(); v = edit_version(aid); loc = en_loc(v['id'])
    files = sorted(f for f in os.listdir('ci/asc/screenshots') if f.endswith('.png'))
    if not files:
        print('::error::skrinshot yo‘q'); sys.exit(1)
    dtype = os.environ.get('SHOT_TYPE', 'APP_IPHONE_67')
    c, j = call('GET', f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")
    sset = next((s for s in j.get('data', []) if s['attributes']['screenshotDisplayType'] == dtype), None)
    if sset:
        c, j = call('GET', f"/v1/appScreenshotSets/{sset['id']}/appScreenshots")
        for s in j.get('data', []):
            call('DELETE', f"/v1/appScreenshots/{s['id']}")
    else:
        c, j = call('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': dtype},
                    'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': loc['id']}}}}})
        if not ok(c):
            print(f"::error::screenshot set {c} {j.get('_error')}"); sys.exit(1)
        sset = j['data']
    for f in files:
        blob = open(os.path.join('ci/asc/screenshots', f), 'rb').read()
        c, j = call('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots', 'attributes': {'fileName': f, 'fileSize': len(blob)},
                    'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': sset['id']}}}}})
        if not ok(c):
            note(f'{f}: reserve {c} {j.get("_error")}'); continue
        sid = j['data']['id']
        for op in j['data']['attributes'].get('uploadOperations') or []:
            part = blob[op['offset']:op['offset'] + op['length']]
            hdr = {h['name']: h['value'] for h in op.get('requestHeaders', [])}
            c2, _ = call(op['method'], None, raw_url=op['url'], data=part, headers=hdr)
            if not ok(c2):
                note(f'{f}: upload part {c2}')
        c, j = call('PATCH', f'/v1/appScreenshots/{sid}', {'data': {'type': 'appScreenshots', 'id': sid,
                    'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(blob).hexdigest()}}})
        note(f'{f} ({len(blob) // 1024} KB) -> {c} {j.get("_error", "")}')
    flush('ASC shots')


# ── attach / submit ────────────────────────────────────────────────────
def attach():
    aid = app_id(); v = edit_version(aid); num = os.environ['BUILD']
    for _ in range(60):
        c, j = call('GET', '/v1/builds', params={'filter[app]': aid, 'filter[version]': num, 'limit': 5})
        b = (j.get('data') or [None])[0]
        if b and b['attributes'].get('processingState') == 'VALID':
            break
        note(f'build {num}: {b and b["attributes"].get("processingState")} — kutilmoqda'); time.sleep(30)
    else:
        print(f'::error::build {num} VALID bo‘lmadi'); sys.exit(1)
    c, j = call('PATCH', f"/v1/appStoreVersions/{v['id']}/relationships/build", {'data': {'type': 'builds', 'id': b['id']}})
    note(f'build {num} versiyaga biriktirildi -> {c} {j.get("_error", "")}')
    flush('ASC attach')


def submit():
    aid = app_id(); v = edit_version(aid)
    free_price(aid)
    c, j = call('POST', '/v1/reviewSubmissions', {'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
                'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}}}})
    if not ok(c):
        note(f'reviewSubmission yaratish -> {c} {j.get("_error")}')
        c2, j2 = call('GET', '/v1/reviewSubmissions', params={'filter[app]': aid, 'filter[state]': 'READY_FOR_REVIEW'})
        sub = (j2.get('data') or [None])[0]
        if not sub:
            flush('ASC submit'); sys.exit(1)
    else:
        sub = j['data']
    c, j = call('POST', '/v1/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems', 'relationships': {
        'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sub['id']}},
        'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}})
    note(f'versiya qo‘shildi -> {c} {j.get("_error", "")}')
    c, j = call('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {'type': 'reviewSubmissions', 'id': sub['id'],
                'attributes': {'submitted': True}}})
    note(f'App Review\'ga yuborildi -> {c} {j.get("_error", "")}')
    flush('ASC submit')
    if not ok(c):
        sys.exit(1)


def release():
    # Apple TASDIQLAGAN versiyani do'konga chiqarish (releaseType=MANUAL).
    # Faqat PENDING_DEVELOPER_RELEASE holatidagi versiya — boshqa holatda
    # hech narsa qilinmaydi (ko'rib chiqilayotgan versiyaga tegilmaydi).
    aid = app_id()
    c, j = call('GET', f'/v1/apps/{aid}/appStoreVersions', params={'filter[platform]': 'IOS', 'limit': 10})
    ready = [v for v in j.get('data', []) if v['attributes'].get('appStoreState') == 'PENDING_DEVELOPER_RELEASE']
    if not ready:
        note('chiqarishga tayyor (PENDING_DEVELOPER_RELEASE) versiya yo‘q: '
             + str([f"{v['attributes'].get('versionString')}={v['attributes'].get('appStoreState')}" for v in j.get('data', [])]))
        flush('ASC release'); sys.exit(1)
    v = ready[0]
    c, j = call('POST', '/v1/appStoreVersionReleaseRequests', {'data': {'type': 'appStoreVersionReleaseRequests',
                'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}})
    note(f"{v['attributes'].get('versionString')} do‘konga chiqarildi -> {c} {j.get('_error', '')}")
    flush('ASC release')
    if not ok(c):
        sys.exit(1)


if __name__ == '__main__':
    {'fill': fill, 'shots': shots, 'attach': attach, 'submit': submit, 'release': release}[sys.argv[1]]()
