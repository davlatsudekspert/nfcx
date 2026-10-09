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
"""
import json
import os
import sys

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

PKG = "uz.nfcstore.nova"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PKG}"
UPLOAD = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PKG}"
STANDARD = {"production", "beta", "alpha", "internal"}


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
