"""GOOGLE PLAY'GA .aab NI TO'G'RIDAN-TO'G'RI YUKLASH (Play Developer API).

Egasi (2026-09): "menda zagruzka sekin" — 48 MB li .aab ni avval
kompyuterga yuklab, keyin Play Console'ga qayta yuklash soatlab
ketardi. Bu skript GitHub serverida ishlaydi: fayl GitHub'dan
to'g'ridan-to'g'ri Google'ga ketadi, egasining interneti umuman
ishtirok etmaydi.

XAVFSIZLIK:
  * Kalit (service account JSON) faqat PLAY_SA_JSON muhit
    o'zgaruvchisidan o'qiladi va HECH QAYERGA chop etilmaydi.
  * Faqat `uz.nfcstore.nova` paketi. Production trekiga YUKLAMAYDI —
    faqat sinov treklari (skript o'zi tekshiradi).

Rejimlar:
  list   — treklar va ulardagi versiyalarni ko'rsatadi, hech narsa
           o'zgarmaydi.
  upload — .aab yuklanadi, tanlangan sinov trekiga yangi reliz
           qo'yiladi va tekshiruvga yuboriladi.
  listing-get — do'kon sahifasi matnlarini (har til) ko'rsatadi;
           edit o'chiriladi, hech narsa o'zgarmaydi.
  listing-set — `ci/play/listings.json` dagi matnlarni (title,
           shortDescription, fullDescription) qo'yadi va saqlaydi.
           Faqat matnlar — video, rasmlar, treklar tegilmaydi.
"""
import json
import re
import os
import sys

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

PKG = "uz.nfcstore.nova"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PKG}"
UPLOAD = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PKG}"
STANDARD = {"production", "beta", "alpha", "internal"}
LISTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ci", "play", "listings.json")
LIMITS = {"title": 30, "shortDescription": 80, "fullDescription": 4000}


def fail(msg):
    print(f"::error::{msg}")
    sys.exit(1)


def check(r, what):
    if r.status_code >= 300:
        try:
            err = r.json().get("error", {})
            msg = f"{err.get('code')} {err.get('status')}: {err.get('message')}"
        except Exception:  # noqa: BLE001
            msg = f"HTTP {r.status_code}"
        fail(f"{what}: {msg}")
    return r.json() if r.content else {}


def notice(msg):
    """GitHub annotation (loglarni API orqali o'qib bo'lmaydi)."""
    esc = msg.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::notice::{esc}")


def api_error(r):
    try:
        err = r.json().get("error", {})
        return f"{err.get('code')} {err.get('status')}: {err.get('message')}"
    except Exception:  # noqa: BLE001
        return f"HTTP {r.status_code}"


def listing_get(s, edit):
    listings = check(s.get(f"{API}/edits/{edit}/listings"), "listinglar").get("listings", [])
    notice(f"Listinglar soni: {len(listings)}; tillar: {', '.join(l.get('language', '?') for l in listings)}")
    for l in listings:
        full = l.get("fullDescription", "") or ""
        short = l.get("shortDescription", "") or ""
        contacts = sorted(set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+|https?://\S+|\b[\w-]+\.uz\b", full)))
        notice(
            f"[{l.get('language')}] title ({len(l.get('title', '') or '')}): {l.get('title')}\n"
            f"short ({len(short)}): {short}\n"
            f"full ({len(full)}): {full[:300]}\n"
            f"full kontaktlar: {', '.join(contacts) or '-'}\n"
            f"video: {'bor' if l.get('video') else 'yoq'}")
    r = s.get(f"{API}/edits/{edit}/details")
    if r.status_code < 300:
        d = r.json()
        notice(f"details: defaultLanguage={d.get('defaultLanguage')} contactEmail={d.get('contactEmail')} "
               f"contactWebsite={d.get('contactWebsite')}")
    return listings


def listing_set(s, edit):
    try:
        with open(LISTINGS_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as e:
        fail(f"ci/play/listings.json o'qilmadi: {e}")
    if not isinstance(data, dict) or not data:
        fail("ci/play/listings.json bo'sh yoki noto'g'ri")
    # API'ga murojaatdan OLDIN uzunliklarni tekshirish.
    bad = []
    for lang, fields in data.items():
        for k in LIMITS:
            v = fields.get(k)
            if not isinstance(v, str) or not v.strip():
                bad.append(f"{lang}.{k}: bo'sh")
            elif len(v) > LIMITS[k]:
                bad.append(f"{lang}.{k}: {len(v)} > {LIMITS[k]}")
    if bad:
        s.delete(f"{API}/edits/{edit}")
        fail("Uzunlik xatosi: " + "; ".join(bad))
    existing = {l.get("language") for l in
                check(s.get(f"{API}/edits/{edit}/listings"), "listinglar").get("listings", [])}
    for lang, fields in data.items():
        body = {k: fields[k] for k in LIMITS}
        if lang in existing:
            # PATCH — faqat berilgan maydonlar o'zgaradi (video tegilmaydi).
            out = check(s.patch(f"{API}/edits/{edit}/listings/{lang}", json=body), f"listing {lang}")
        else:
            # Yangi til: PUT (listings.update) yaratadi.
            body["language"] = lang
            out = check(s.put(f"{API}/edits/{edit}/listings/{lang}", json=body), f"listing {lang} (yangi)")
        notice(f"[{lang}] {'yangilandi' if lang in existing else 'YANGI til qo`shildi'}: "
               f"title={len(out.get('title', ''))} short={len(out.get('shortDescription', ''))} "
               f"full={len(out.get('fullDescription', ''))}")
    r = s.post(f"{API}/edits/{edit}:commit")
    if r.status_code < 300:
        notice("COMMIT OK — o'zgarishlar tekshiruvga yuborildi.")
        return
    msg = api_error(r)
    # Managed publishing: API o'zi changesNotSentForReview=true ni so'rasa.
    if "changesNotSentForReview" in msg:
        notice(f"Commit rad etildi ({msg}); changesNotSentForReview=true bilan qayta.")
        check(s.post(f"{API}/edits/{edit}:commit", params={"changesNotSentForReview": "true"}),
              "saqlash (changesNotSentForReview)")
        notice("COMMIT OK (changesNotSentForReview=true) — Play Console'da 'Publishing overview' "
               "orqali tekshiruvga qo'lda yuborish kerak.")
        return
    fail(f"saqlash (commit): {msg}")


def main():
    mode = (os.environ.get("MODE") or "list").strip()
    raw = os.environ.get("PLAY_SA_JSON", "").strip()
    if not raw:
        fail("PLAY_SERVICE_ACCOUNT_JSON secreti qo'yilmagan (GitHub -> Settings -> Secrets).")
    try:
        info = json.loads(raw)
    except ValueError:
        fail("PLAY_SERVICE_ACCOUNT_JSON — JSON emas. Kalit faylining TO'LIQ matnini qo'ying.")
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/androidpublisher"])
    try:
        creds.refresh(Request())
    except Exception as e:  # noqa: BLE001
        # Xabarda kalit yo'q — faqat Google'ning sababi.
        fail(f"Google kalitni qabul qilmadi: {getattr(e, 'args', [''])[0]}")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {creds.token}"

    edit = check(s.post(f"{API}/edits"), "edit ochish")["id"]
    if mode == "listing-get":
        listing_get(s, edit)
        s.delete(f"{API}/edits/{edit}")
        return
    if mode == "listing-set":
        listing_set(s, edit)
        return
    tracks = check(s.get(f"{API}/edits/{edit}/tracks"), "treklar").get("tracks", [])
    print("--- Treklar ---")
    for t in tracks:
        rel = ", ".join(
            f"{r.get('status')}:{'/'.join(r.get('versionCodes', []) or ['-'])}"
            for r in t.get("releases", [])) or "bo'sh"
        print(f"  {t['track']}: {rel}")

    if mode != "upload":
        s.delete(f"{API}/edits/{edit}")
        return

    want = (os.environ.get("TRACK") or "").strip()
    ids = [t["track"] for t in tracks]
    if not want:
        # Egasining yopiq sinov treki "NFCSTORE" nomli maxsus trek;
        # bo'lmasa standart yopiq trek — `alpha`.
        custom = [i for i in ids if i not in STANDARD]
        want = custom[0] if len(custom) == 1 else "alpha"
    if want == "production":
        fail("Production trekiga bu skript yuklamaydi — faqat sinov treklari.")
    if ids and want not in ids:
        fail(f"'{want}' treki topilmadi. Bor treklar: {', '.join(ids)}")
    print(f"Trek: {want}")

    path = os.environ["AAB"]
    size = os.path.getsize(path) // (1024 * 1024)
    print(f"Yuklanmoqda: {os.path.basename(path)} ({size} MB)")
    with open(path, "rb") as f:
        up = s.post(
            f"{UPLOAD}/edits/{edit}/bundles",
            params={"uploadType": "media"},
            headers={"Content-Type": "application/octet-stream"},
            data=f,
            timeout=900,
        )
    # ALLAQACHON YUKLANGAN BUNDLE. `nova-apk.yml` har qurilishni
    # o'zi `internal` trekiga yuklaydi; keyin xuddi shu faylni yopiq
    # trekka (NFCSTORE) qo'yishda Google "Version code N has already
    # been used" deydi. Bu xato emas: fayl Play'da bor, uni trekka
    # biriktirish kifoya — qayta yuklash shart emas.
    m = None
    if up.status_code == 403:
        try:
            m = re.search(r"Version code (\d+) has already been used",
                          up.json().get("error", {}).get("message", ""))
        except ValueError:
            m = None
    if m:
        vc = m.group(1)
        print(f"versionCode {vc} Play'da allaqachon bor — faqat trekka qo'yiladi.")
    else:
        vc = str(check(up, ".aab yuklash")["versionCode"])
        print(f"Yuklandi: versionCode {vc}")

    status = (os.environ.get("STATUS") or "completed").strip()
    body = {"track": want, "releases": [{"name": vc, "versionCodes": [vc], "status": status}]}
    check(s.put(f"{API}/edits/{edit}/tracks/{want}", json=body), "trekka qo'yish")
    check(s.post(f"{API}/edits/{edit}:commit"), "saqlash (commit)")
    print(f"TAYYOR: {vc} -> {want} ({status}). Play Console'da tekshiruv holatini ko'ring.")
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    if summ:
        with open(summ, "a", encoding="utf-8") as fh:
            fh.write(f"## Google Play\n\nversionCode **{vc}** -> trek **{want}** ({status})\n")


if __name__ == "__main__":
    main()
