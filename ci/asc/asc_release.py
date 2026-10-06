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
  iap     — Premium obuna guruhi, 2 ta obuna, 3 ta consumable (boost), narxlar, mavjudlik,
            server bildirishnoma URL (idempotent)

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
# Nom ("NFCSTORE: Social NFC") va subtitle'dagi so'zlar (nfc, social, writer,
# id, reels) Apple'da avtomatik hisoblanadi — bu yerda TAKRORLANMAYDI, joy
# qidiruv so'zlariga qoladi. Apple ularni nom bilan birlashtiradi: "nfc" +
# "reader" -> "NFC reader", "nfc" + "tools" -> "NFC tools" va h.k.
KEYWORDS_LIST = ['tools', 'reader', 'scanner', 'tag', 'read', 'write', 'sticker', 'scan', 'ntag',
                 'card', 'business', 'contact', 'qr', 'vizitka', 'yozish', 'karta', 'chip']
# Ruscha App Store (O'zbekistonda ko'p telefonlar rus tilida).
KEYWORDS_LIST_RU = ['nfc', 'метки', 'метка', 'сканер', 'запись', 'чтение', 'считыватель', 'визитка',
                    'наклейка', 'tools', 'reader', 'tag', 'карта', 'чип', 'qr', 'бизнес']
PROMO = "Tap. Share. Connect — your social NFC profile, feed and Reels on an NFC card or sticker."
SUBTITLE = "NFC Writer, Social ID, Reels"

# "What's New" — YANGILANISH matni (birinchi versiyada Apple uni qabul
# qilmaydi; yangilanishda MAJBURIY). Faqat ilovada HAQIQATAN bor narsa
# yoziladi: va'da qilingan, lekin yo'q imkoniyat — rad etish sababi (2.3).
WHATS_NEW = {
    'en': """What's new in 1.1.1

• Reels: a personal "For you" order — fresh and popular reels first, ones you have already watched move down, and new reels keep loading as you scroll.
• Reels: new Friends tab — the latest reels from people and businesses you follow, in one place.
• Stories: swipe between people, hold to pause (videos too), new stories are marked with a ring, and you can see how many people viewed your story.
• Notifications: tapping a like or a comment now opens that exact post or reel.
• Posts: tap a photo to zoom, double-tap a video to like, see when it was posted, and load more comments.
• Comments: authors can remove comments under their posts; businesses can delete their own posts.
• Reels: "Not interested" hides a reel you don't want to see — it stays hidden.
• Help: see our replies to your messages right in the app, with a notification when we answer.
• Music: the profile music player now also plays and pauses Yandex Music.
• Faster loading and stability improvements.""",
    'ru': """Что нового в 1.1.1

• Reels: персональный порядок «Для вас» — свежие и популярные ролики выше, просмотренные ниже, новые подгружаются при прокрутке.
• Reels: новая вкладка «Друзья» — свежие Reels людей и бизнесов, на которых вы подписаны.
• Истории: листайте между людьми, удерживайте для паузы (и видео тоже), новые истории отмечены кольцом, видно число просмотров вашей истории.
• Уведомления: нажатие на лайк или комментарий открывает именно тот пост или Reels.
• Посты: увеличение фото по нажатию, двойное касание видео — лайк, время публикации и загрузка новых комментариев.
• Комментарии: автор может удалять комментарии под своими постами; бизнес может удалять свои посты.
• Reels: «Не интересно» скрывает ненужный ролик насовсем.
• Помощь: ответы на ваши обращения видны прямо в приложении, с уведомлением.
• Музыка: плеер профиля теперь включает и ставит на паузу Яндекс Музыку.
• Быстрее загрузка и улучшения стабильности.""",
}

REVIEW_NOTES = """1) PURPOSE AND AUDIENCE
NFCSTORE is a social NFC business-card app made in Uzbekistan. People and small businesses create a digital profile ("NFC ID"), write its link to any NFC card or sticker with the iPhone (Core NFC) and share it by tap, link or QR code. Businesses get a page with contacts and a product/service catalog. A social layer (feed, Reels, stories, comments, follows) lets people and local businesses show their work. It replaces paper business cards and scattered links with one always up-to-date profile. Audience: individuals, freelancers and small businesses, mainly in Uzbekistan (Uzbek, Russian, English).

2) HOW TO REVIEW (demo account above already has a profile, posts and a business page)
- Log in with the demo account. Home shows the NFC ID card; Profile shows the digital business card; Feed and Reels show posts (Reels top tabs: "Reels" and "Friends" = accounts you follow).
- NFC is optional: NFC Center > "Write to NFC card" writes the profile link to any blank NFC tag (NTAG213/215/216). Everything can be reviewed without a tag (link and QR sharing).
- Registration: email (6-digit code sent by email) + phone number for the contact card.
- Account deletion: Settings > Account > Security > Delete account (please test on a newly registered account, not the demo account).
- Report / block: on any post, Reel, comment or profile tap "..." > Report or Block. Content rules must be accepted before posting.

3) PAID CONTENT
There are no in-app purchases and nothing can be bought in the iOS app: no prices, purchase buttons or links to buy. Posting, Reels, stories, comments and the business page are free for everyone; new accounts also get a free trial of extended limits. Physical NFC cards and stickers are sold offline / on our website as physical goods.

4) EXTERNAL SERVICES
- Cloudflare (hosting, API, database, file storage, CDN).
- Resend (sends the email verification codes).
- Google Gemini API (automatic safety screening of uploaded photos/videos; users are told and consent on the content rules screen).
- Telegram Bot API (optional phone verification via our bot and internal moderation alerts).
- YouTube and Yandex Music official embedded players (optional profile music link chosen by the user).
- Apple Core NFC (writing/reading NFC tags). No third-party ads or analytics SDKs.

5) REGIONS
The app works the same in all regions. Content is user-generated; the interface is in Uzbek, Russian and English. NFC writing needs an iPhone with NFC; all other features work on any supported iPhone.

6) REGULATED / THIRD-PARTY MATERIAL
Not a regulated industry. The in-app music library for Reels contains only original tracks from NFCSTORE's own music channel (NEOMSONGS), created with Suno under a paid Pro plan that grants commercial use rights, or tracks released under free licenses (CC0 / public domain); each track's source is recorded. Profile music from YouTube / Yandex Music is played only through their official embedded players."""


def keywords(words=None):
    out = ''
    for k in (words or KEYWORDS_LIST):
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
    # Qaytarilgan / tayyorlanayotgan versiya raqamini yangilash (egasi:
    # 1.1.0 rad etilgach birinchi chiqish 1.1.1 + 325 bo'lsin).
    want = os.environ.get('APP_VERSION', '').strip()
    if want and v['attributes'].get('versionString') != want:
        c, j = call('PATCH', f'/v1/appStoreVersions/{vid}', {'data': {'type': 'appStoreVersions', 'id': vid,
                    'attributes': {'versionString': want}}})
        note(f"versiya raqami {v['attributes'].get('versionString')} -> {want}: {c} {j.get('_error', '')}")
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
        la = {'whatsNew': text}
        # Ruscha do'konda ruscha qidiruv so'zlari ("nfc метки", "сканер" ...).
        if loc_code.startswith('ru'):
            la['keywords'] = keywords(KEYWORDS_LIST_RU)
        c2, j2 = call('PATCH', f"/v1/appStoreVersionLocalizations/{l['id']}", {'data': {
            'type': 'appStoreVersionLocalizations', 'id': l['id'], 'attributes': la}})
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
    # Versiyaga biriktirilgan build'ni tekshirish: BUILD berilgan bo'lsa,
    # boshqa build yuborilib ketmasin.
    c, j = call('GET', f"/v1/appStoreVersions/{v['id']}/build")
    attached = ((j.get('data') or {}).get('attributes') or {}).get('version')
    note(f"versiya {v['attributes'].get('versionString')} ({v['attributes'].get('appStoreState')}), build {attached}")
    want = os.environ.get('BUILD', '').strip()
    if want and attached != want:
        print(f'::error::versiyaga {attached} biriktirilgan, {want} kutilgan — yuborilmadi')
        flush('ASC submit'); sys.exit(1)
    free_price(aid)

    # RAD ETILGAN YUBORISH OCHIQ (UNRESOLVED_ISSUES): yangisini yaratib
    # bo'lmaydi (bitta ochiq yuborish). Elementni "hal qilindi" deb
    # belgilab, o'sha yuborishni qayta jo'natamiz — UI'dagi "Отправить
    # на проверку" bilan bir xil. Hech narsa bekor qilinmaydi.
    c, j = call('GET', '/v1/reviewSubmissions', params={'filter[app]': aid, 'filter[state]': 'UNRESOLVED_ISSUES'})
    open_sub = (j.get('data') or [None])[0]
    if open_sub:
        sid = open_sub['id']
        note(f'ochiq (rad etilgan) yuborish topildi: {sid}')
        c, j = call('GET', f'/v1/reviewSubmissions/{sid}/items', params={'include': 'appStoreVersion'})
        for it in j.get('data') or []:
            ver = ((it.get('relationships') or {}).get('appStoreVersion') or {}).get('data') or {}
            st = (it.get('attributes') or {}).get('state')
            note(f"element {it['id']}: {st}, versiya {ver.get('id')}")
            if ver.get('id') == v['id'] and st not in ('READY_FOR_REVIEW', 'ACCEPTED', 'APPROVED'):
                c2, j2 = call('PATCH', f"/v1/reviewSubmissionItems/{it['id']}", {'data': {
                    'type': 'reviewSubmissionItems', 'id': it['id'], 'attributes': {'resolved': True}}})
                note(f'element hal qilindi deb belgilandi -> {c2} {j2.get("_error", "")}')
        c, j = call('PATCH', f'/v1/reviewSubmissions/{sid}', {'data': {'type': 'reviewSubmissions', 'id': sid,
                    'attributes': {'submitted': True}}})
        note(f"App Review'ga qayta yuborildi -> {c} {j.get('_error', '')}")
        flush('ASC submit')
        if not ok(c):
            sys.exit(1)
        return

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


# ── iap: Premium avto-yangilanadigan obunalar ──────────────────────────
# Idempotent: har bir obyekt avval qidiriladi, bor bo'lsa qayta yaratilmaydi.
# appStoreVersions'ga TEGILMAYDI, hech narsa review'ga yuborilmaydi.
IAP_GROUP = 'NFCSTORE Premium'
IAP_GROUP_LOCS = {'en-US': 'NFCSTORE Premium', 'ru': 'NFCSTORE Premium'}
IAP_REVIEW_NOTE = ('Premium unlocks extra profile and business features (more catalog items, more profile music '
                   'tracks, premium profile themes). Demo account is in App Review Information. Purchases are '
                   'verified server-side via StoreKit 2 signed transactions.')
IAP_SUBS = [
    {'productId': 'uz.nfcstore.nova.premium.monthly', 'name': 'Premium Monthly', 'period': 'ONE_MONTH', 'usd': 1.99,
     'locs': {'en-US': ('Premium (1 month)', 'More catalog items, music and premium themes'),
              'ru': ('Premium (1 месяц)', 'Больше товаров, музыки и премиум-темы')}},
    {'productId': 'uz.nfcstore.nova.premium.yearly', 'name': 'Premium Yearly', 'period': 'ONE_YEAR', 'usd': 19.99,
     'locs': {'en-US': ('Premium (1 year)', 'More catalog items, music and premium themes'),
              'ru': ('Premium (1 год)', 'Больше товаров, музыки и премиум-темы')}},
]
IAP_NOTIFY_URL = 'https://nfcstore.uz/api/iap/apple/notifications'
IAP_FAILS = []


def get_all(path, params=None):
    """GET + links.next sahifalash. (data, included, code, err) qaytaradi."""
    data, inc, url = [], [], None
    while True:
        c, j = call('GET', path, params=params, raw_url=url)
        if not ok(c):
            return data, inc, c, j.get('_error', '')
        data += j.get('data') or []
        inc += j.get('included') or []
        url = (j.get('links') or {}).get('next')
        if not url:
            return data, inc, c, ''


def rel_id(obj, name):
    return (((obj.get('relationships') or {}).get(name) or {}).get('data') or {}).get('id')


def iap_fail(what, c, err):
    IAP_FAILS.append(f'{what} -> {c} {err}')
    note(f'XATO {what} -> {c} {err}')


def iap_stop():
    note('TO‘XTATILDI. Xatolar: ' + str(len(IAP_FAILS)))
    flush('ASC iap')
    sys.exit(1)


def iap_notify_url(aid):
    want = {'subscriptionStatusUrl': IAP_NOTIFY_URL, 'subscriptionStatusUrlVersion': 'V2',
            'subscriptionStatusUrlForSandbox': IAP_NOTIFY_URL, 'subscriptionStatusUrlVersionForSandbox': 'V2'}
    c, j = call('GET', f'/v1/apps/{aid}')
    cur = ((j.get('data') or {}).get('attributes') or {}) if ok(c) else {}
    if all(cur.get(k) == v for k, v in want.items()):
        note('notification URL (V2, prod+sandbox) allaqachon o‘rnatilgan'); return 'already set'
    c, j = call('PATCH', f'/v1/apps/{aid}', {'data': {'type': 'apps', 'id': aid, 'attributes': want}})
    if ok(c):
        note(f'notification URL o‘rnatildi (V2, prod+sandbox) -> {c}'); return f'set ({c})'
    iap_fail('PATCH /v1/apps/{id} subscriptionStatusUrl*', c, j.get('_error'))
    return f'FAILED {c}: {j.get("_error")}'


def iap_group(aid):
    data, _, c, err = get_all(f'/v1/apps/{aid}/subscriptionGroups', {'limit': 200})
    if not ok(c):
        iap_fail('GET /v1/apps/{id}/subscriptionGroups', c, err); iap_stop()
    g = next((x for x in data if x['attributes'].get('referenceName') == IAP_GROUP), None)
    if g:
        note(f'guruh bor: {g["id"]}')
    else:
        c, j = call('POST', '/v1/subscriptionGroups', {'data': {'type': 'subscriptionGroups',
                    'attributes': {'referenceName': IAP_GROUP},
                    'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}}}})
        if not ok(c):
            iap_fail('POST /v1/subscriptionGroups', c, j.get('_error')); iap_stop()
        g = j['data']; IAP_NEW[0] += 1; note(f'guruh yaratildi: {g["id"]}')
    gid = g['id']
    locs, _, c, err = get_all(f'/v1/subscriptionGroups/{gid}/subscriptionGroupLocalizations', {'limit': 50})
    if not ok(c):
        iap_fail('GET subscriptionGroupLocalizations', c, err)
    have = {x['attributes'].get('locale') for x in locs}
    for loc, name in IAP_GROUP_LOCS.items():
        if loc in have:
            continue
        c, j = call('POST', '/v1/subscriptionGroupLocalizations', {'data': {'type': 'subscriptionGroupLocalizations',
                    'attributes': {'locale': loc, 'name': name},
                    'relationships': {'subscriptionGroup': {'data': {'type': 'subscriptionGroups', 'id': gid}}}}})
        if ok(c):
            IAP_NEW[0] += 1; note(f'guruh lokalizatsiyasi {loc} -> {c}')
        else:
            iap_fail(f'POST /v1/subscriptionGroupLocalizations {loc}', c, j.get('_error'))
    return gid


def iap_subscription(gid, spec):
    data, _, c, err = get_all(f'/v1/subscriptionGroups/{gid}/subscriptions', {'limit': 200})
    if not ok(c):
        iap_fail('GET /v1/subscriptionGroups/{id}/subscriptions', c, err); iap_stop()
    s = next((x for x in data if x['attributes'].get('productId') == spec['productId']), None)
    if s:
        note(f"{spec['productId']}: bor {s['id']} ({s['attributes'].get('state')})")
        return s
    c, j = call('POST', '/v1/subscriptions', {'data': {'type': 'subscriptions', 'attributes': {
        'name': spec['name'], 'productId': spec['productId'], 'subscriptionPeriod': spec['period'],
        'familySharable': False, 'groupLevel': 1, 'reviewNote': IAP_REVIEW_NOTE},
        'relationships': {'group': {'data': {'type': 'subscriptionGroups', 'id': gid}}}}})
    if not ok(c):
        iap_fail(f"POST /v1/subscriptions {spec['productId']}", c, j.get('_error')); iap_stop()
    s = j['data']; IAP_NEW[0] += 1
    note(f"{spec['productId']}: yaratildi {s['id']} ({s['attributes'].get('state')}, "
         f"level {s['attributes'].get('groupLevel')})")
    return s


def iap_sub_locs(sid, spec):
    locs, _, c, err = get_all(f'/v1/subscriptions/{sid}/subscriptionLocalizations', {'limit': 50})
    if not ok(c):
        iap_fail('GET subscriptionLocalizations', c, err)
    have = {x['attributes'].get('locale') for x in locs}
    for loc, (name, desc) in spec['locs'].items():
        if loc in have:
            continue
        c, j = call('POST', '/v1/subscriptionLocalizations', {'data': {'type': 'subscriptionLocalizations',
                    'attributes': {'locale': loc, 'name': name, 'description': desc},
                    'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}}}}})
        if ok(c):
            IAP_NEW[0] += 1; note(f'  lokalizatsiya {loc} -> {c}')
        else:
            iap_fail(f"POST /v1/subscriptionLocalizations {spec['productId']} {loc}", c, j.get('_error'))


def iap_prices(sid, spec):
    """USA narx nuqtasi + Apple ekvivalentlari barcha hududlarga. Bor narx o'tkaziladi."""
    tag = spec['productId'].rsplit('.', 1)[-1]
    prices, inc, c, err = get_all(f'/v1/subscriptions/{sid}/prices', {'include': 'territory', 'limit': 200})
    if not ok(c):
        iap_fail(f'GET /v1/subscriptions/{{id}}/prices ({tag})', c, err); return 0
    priced = {rel_id(p, 'territory') for p in prices} - {None}
    pts, _, c, err = get_all(f'/v1/subscriptions/{sid}/pricePoints', {'filter[territory]': 'USA', 'limit': 200})
    if not ok(c):
        iap_fail(f'GET /v1/subscriptions/{{id}}/pricePoints USA ({tag})', c, err); return len(priced)
    usa = next((p for p in pts if abs(float(p['attributes'].get('customerPrice') or -1) - spec['usd']) < 0.001), None)
    if not usa:
        iap_fail(f'USA {spec["usd"]} narx nuqtasi ({tag})', 404, f'{len(pts)} nuqta ichida topilmadi'); return len(priced)
    eq, einc, c, err = get_all(f"/v1/subscriptionPricePoints/{usa['id']}/equalizations",
                               {'include': 'territory', 'limit': 200})
    if not ok(c):
        iap_fail(f'GET equalizations ({tag})', c, err)
    todo = [('USA', usa['id'])] + [(rel_id(p, 'territory'), p['id']) for p in eq if rel_id(p, 'territory')]
    created, failed, consecutive = 0, 0, 0
    for terr, pp in todo:
        if terr in priced:
            continue
        c, j = call('POST', '/v1/subscriptionPrices', {'data': {'type': 'subscriptionPrices',
                    'attributes': {'startDate': None, 'preserveCurrentPrice': False},
                    'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}},
                                      'subscriptionPricePoint': {'data': {'type': 'subscriptionPricePoints', 'id': pp}},
                                      'territory': {'data': {'type': 'territories', 'id': terr}}}}})
        if ok(c):
            created += 1; IAP_NEW[0] += 1; consecutive = 0; priced.add(terr)
        else:
            failed += 1; consecutive += 1
            if failed <= 3:
                iap_fail(f'POST /v1/subscriptionPrices {tag} {terr}', c, j.get('_error'))
            if consecutive >= 3 and created == 0:
                note(f'  {tag}: narxlar to‘xtatildi (ketma-ket xato)'); break
    note(f"  {tag}: USA {usa['attributes'].get('customerPrice')} USD; ekvivalent {len(eq)} hudud; "
         f"yangi narx {created}, xato {failed}; jami narxli hudud {len(priced)}")
    return len(priced)


def iap_availability(sid, spec, terr):
    tag = spec['productId'].rsplit('.', 1)[-1]
    c, j = call('GET', f'/v1/subscriptions/{sid}/subscriptionAvailability')
    if ok(c) and isinstance(j.get('data'), dict):
        note(f'  {tag}: mavjudlik allaqachon bor'); return
    c, j = call('POST', '/v1/subscriptionAvailabilities', {'data': {'type': 'subscriptionAvailabilities',
                'attributes': {'availableInNewTerritories': True},
                'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}},
                                  'availableTerritories': {'data': [{'type': 'territories', 'id': t} for t in terr]}}}})
    if ok(c):
        IAP_NEW[0] += 1; note(f'  {tag}: mavjudlik {len(terr)} hudud -> {c}')
    else:
        iap_fail(f'POST /v1/subscriptionAvailabilities {tag}', c, j.get('_error'))


# ── iap: CONSUMABLE xaridlar (post boost) ──────────────────────────────
IAP_NEW = [0]  # shu ishga tushirishda yaratilgan obyektlar soni (idempotentlik tekshiruvi)
CONS_REVIEW_NOTE = ("Promotes the user's own post in the feed as 'Recommended' for the given number of days. "
                    "Verified server-side via StoreKit 2 signed transactions.")
CONS_DESC = {'en-US': 'Show your post as Recommended in the feed', 'ru': 'Ваш пост в ленте как «Рекомендуемое»'}
IAP_CONSUMABLES = [
    {'productId': 'uz.nfcstore.nova.boost.1d', 'name': 'Boost 1 day', 'usd': 2.99,
     'locs': {'en-US': 'Post boost — 1 day', 'ru': 'Продвижение поста — 1 день'}},
    {'productId': 'uz.nfcstore.nova.boost.3d', 'name': 'Boost 3 days', 'usd': 5.99,
     'locs': {'en-US': 'Post boost — 3 days', 'ru': 'Продвижение поста — 3 дня'}},
    {'productId': 'uz.nfcstore.nova.boost.6d', 'name': 'Boost 6 days', 'usd': 9.99,
     'locs': {'en-US': 'Post boost — 6 days', 'ru': 'Продвижение поста — 6 дней'}},
]


def cons_product(aid, spec):
    data, _, c, err = get_all(f'/v1/apps/{aid}/inAppPurchasesV2', {'filter[productId]': spec['productId'], 'limit': 200})
    if not ok(c):
        iap_fail(f"GET /v1/apps/{{id}}/inAppPurchasesV2 {spec['productId']}", c, err); return None
    p = next((x for x in data if x['attributes'].get('productId') == spec['productId']), None)
    if p:
        note(f"{spec['productId']}: bor {p['id']} ({p['attributes'].get('state')})"); return p
    c, j = call('POST', '/v2/inAppPurchases', {'data': {'type': 'inAppPurchases', 'attributes': {
        'name': spec['name'], 'productId': spec['productId'], 'inAppPurchaseType': 'CONSUMABLE',
        'familySharable': False, 'reviewNote': CONS_REVIEW_NOTE},
        'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}}}})
    if not ok(c):
        iap_fail(f"POST /v2/inAppPurchases {spec['productId']}", c, j.get('_error')); return None
    IAP_NEW[0] += 1
    p = j['data']; note(f"{spec['productId']}: yaratildi {p['id']} ({p['attributes'].get('state')})")
    return p


def cons_locs(iid, spec):
    locs, _, c, err = get_all(f'/v2/inAppPurchases/{iid}/inAppPurchaseLocalizations', {'limit': 50})
    if not ok(c):
        iap_fail('GET inAppPurchaseLocalizations', c, err); return
    have = {x['attributes'].get('locale') for x in locs}
    for loc, name in spec['locs'].items():
        if loc in have:
            continue
        c, j = call('POST', '/v1/inAppPurchaseLocalizations', {'data': {'type': 'inAppPurchaseLocalizations',
                    'attributes': {'locale': loc, 'name': name, 'description': CONS_DESC[loc]},
                    'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': iid}}}}})
        if ok(c):
            IAP_NEW[0] += 1; note(f'  lokalizatsiya {loc} -> {c}')
        else:
            iap_fail(f"POST /v1/inAppPurchaseLocalizations {spec['productId']} {loc}", c, j.get('_error'))


def cons_availability(iid, spec, terr):
    tag = spec['productId'].rsplit('.', 1)[-1]
    c, j = call('GET', f'/v2/inAppPurchases/{iid}/inAppPurchaseAvailability')
    if ok(c) and isinstance(j.get('data'), dict):
        note(f'  {tag}: mavjudlik allaqachon bor'); return
    c, j = call('POST', '/v1/inAppPurchaseAvailabilities', {'data': {'type': 'inAppPurchaseAvailabilities',
                'attributes': {'availableInNewTerritories': True},
                'relationships': {'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': iid}},
                                  'availableTerritories': {'data': [{'type': 'territories', 'id': t} for t in terr]}}}})
    if ok(c):
        IAP_NEW[0] += 1; note(f'  {tag}: mavjudlik {len(terr)} hudud -> {c}')
    else:
        iap_fail(f'POST /v1/inAppPurchaseAvailabilities {tag}', c, j.get('_error'))


def cons_price(iid, spec):
    """USA asosiy narx; boshqa hududlarni Apple avtomatik tenglashtiradi. Narx bo'lsa tegilmaydi."""
    tag = spec['productId'].rsplit('.', 1)[-1]
    c, j = call('GET', f'/v1/inAppPurchasePriceSchedules/{iid}/manualPrices',
                params={'include': 'inAppPurchasePricePoint,territory', 'limit': 50})
    if ok(c) and j.get('data'):
        pts = {x['id']: x['attributes'].get('customerPrice') for x in j.get('included') or []
               if x['type'] == 'inAppPurchasePricePoints'}
        cur = [f"{rel_id(m, 'territory')}={pts.get(rel_id(m, 'inAppPurchasePricePoint'))}" for m in j['data']]
        note(f'  {tag}: narx allaqachon bor: {cur}'); return 'existing ' + ','.join(cur)
    pts, _, c, err = get_all(f'/v2/inAppPurchases/{iid}/pricePoints', {'filter[territory]': 'USA', 'limit': 200})
    if not ok(c):
        iap_fail(f'GET /v2/inAppPurchases/{{id}}/pricePoints USA ({tag})', c, err); return 'FAILED'
    usa = next((p for p in pts if abs(float(p['attributes'].get('customerPrice') or -1) - spec['usd']) < 0.001), None)
    if not usa:
        iap_fail(f'USA {spec["usd"]} narx nuqtasi ({tag})', 404, f'{len(pts)} nuqta ichida topilmadi'); return 'FAILED'
    c, j = call('POST', '/v1/inAppPurchasePriceSchedules', {'data': {'type': 'inAppPurchasePriceSchedules',
        'relationships': {'inAppPurchase': {'data': {'type': 'inAppPurchases', 'id': iid}},
                          'baseTerritory': {'data': {'type': 'territories', 'id': 'USA'}},
                          'manualPrices': {'data': [{'type': 'inAppPurchasePrices', 'id': '${p0}'}]}}},
        'included': [{'type': 'inAppPurchasePrices', 'id': '${p0}', 'attributes': {'startDate': None},
                      'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': iid}},
                                        'inAppPurchasePricePoint': {'data': {'type': 'inAppPurchasePricePoints',
                                                                             'id': usa['id']}}}}]})
    if not ok(c):
        iap_fail(f'POST /v1/inAppPurchasePriceSchedules {tag}', c, j.get('_error')); return 'FAILED'
    IAP_NEW[0] += 1
    note(f"  {tag}: narx USA {usa['attributes'].get('customerPrice')} USD (proceeds "
         f"{usa['attributes'].get('proceeds')}), boshqa hududlar avtomatik -> {c}")
    return f"USA {usa['attributes'].get('customerPrice')}"


def consumables(aid, terr):
    out = []
    for spec in IAP_CONSUMABLES:
        p = cons_product(aid, spec)
        if not p:
            out.append(f"{spec['productId']}=FAILED"); continue
        cons_locs(p['id'], spec)
        if terr:
            cons_availability(p['id'], spec, terr)  # mavjudlik narxdan OLDIN
        price = cons_price(p['id'], spec)
        c, j = call('GET', f"/v2/inAppPurchases/{p['id']}")
        st = ((j.get('data') or {}).get('attributes') or {}).get('state') if ok(c) else p['attributes'].get('state')
        out.append(f"{spec['productId']}={p['id']} state={st} price={price}")
    return out


def iap():
    aid = app_id()
    note(f'app {aid}')
    notify = iap_notify_url(aid)
    gid = iap_group(aid)
    tdata, _, c, err = get_all('/v1/territories', {'limit': 200})
    terr = [t['id'] for t in tdata]
    if not ok(c):
        iap_fail('GET /v1/territories', c, err)
    summary = []
    for spec in IAP_SUBS:
        s = iap_subscription(gid, spec)
        iap_sub_locs(s['id'], spec)
        # Mavjudlik narxdan OLDIN: hududsiz obunaga narx qo'yib bo'lmaydi
        # (409 UNSUPPORTED_TERRITORY).
        if terr:
            iap_availability(s['id'], spec, terr)
        n = iap_prices(s['id'], spec)
        c, j = call('GET', f"/v1/subscriptions/{s['id']}")
        st = ((j.get('data') or {}).get('attributes') or {}).get('state') if ok(c) else s['attributes'].get('state')
        summary.append(f"{spec['productId']}={s['id']} state={st} priced_territories={n}")
    summary += consumables(aid, terr)
    note(f'YAKUN: group={gid}; ' + '; '.join(summary) + f'; notificationURL: {notify}; '
         f'yangi obyektlar: {IAP_NEW[0]}; xatolar: {len(IAP_FAILS)}')
    flush('ASC iap')
    if IAP_FAILS:
        sys.exit(1)


if __name__ == '__main__':
    {'fill': fill, 'shots': shots, 'attach': attach, 'submit': submit, 'release': release, 'iap': iap}[sys.argv[1]]()
