#!/usr/bin/env python3
"""NFCSTORE promo roligi — ilovaning HAQIQIY ekranlaridan.

    python3 scripts/promo_reel.py --shots <png papka> --fonts <mobile_nova> \
      --out promo.mp4

## Nima uchun skript, qo'lda montaj emas

Rolik ilova o'zgargan sayin eskiradi. Ekranlar `mobile_nova/test/shots`
bilan qayta chiziladi, bu skript esa o'sha yangi ekranlardan rolikni
bir buyruqda qayta yig'adi. Ya'ni "ilovadagi tugma o'zgardi, roliklar
esa eskisini ko'rsatyapti" degan holat bo'lmaydi.

## Format — ILOVA TALABIGA KO'RA, tanlov emas

`public/promo/*-v4.mp4` ning o'zidan olingan:

  720x1280 · 30 fps · H.264 High · yuv420p · bt709 · AAC 44.1 kHz

`bt709` (space, transfer, primaries — UCHALASI) va AAC AUDIO YO'LAGI
majburiy. Repodagi "Promo reklama videolari v4" commiti aynan shu
ikkisini tuzatgan: ularsiz video HAQIQIY iPhONE'DA OCHILMASDI.
Audio jim bo'lsa ham yo'lakning O'ZI bo'lishi shart.

## Matn fayl orqali beriladi, `text=` orqali emas

O'zbekcha matnda apostrof ko'p: `o'z`, `Play'da`, `g'oya`. ffmpeg
filtergraph'ida bir qo'shtirnoq ichidagi apostrofni teskari chiziq
bilan QUTQARIB BO'LMAYDI — qo'shtirnoq shu yerda tugaydi va undan
keyingi butun zanjir buzilib ketadi. Shuning uchun har bir yozuv
vaqtinchalik faylga yozilib, `textfile=` bilan uzatiladi: apostrof,
ikki nuqta, vergul — hammasi xavfsiz.

## Musiqa

Bu skript JIM yo'lak qo'yadi: huquqi yo'q trek qo'yish Instagram'da
ham, App Store'da ham muammo. O'z trekingizni ustiga qo'yish:

    ffmpeg -i promo.mp4 -i trek.m4a -map 0:v -map 1:a -c:v copy \\
      -c:a aac -b:a 128k -shortest promo-musiqa.mp4
"""

import argparse
import json
import os
import shlex
import subprocess
import sys

W, H, FPS = 720, 1280, 30

# ── SAHNALAR ────────────────────────────────────────────────────────
# `shot` — `test/shots/png/` dagi fayl nomi (kengaytmasiz) yoki None
# (matnli karta). `title`/`sub` — ekran ostidagi yozuv.
#
# Har sahna ~3 soniya: Instagram'da odam 2 soniyada qaror qiladi,
# shuning uchun birinchi kadrda BRENDNING o'zi turadi, tushuntirish
# keyin keladi.
SCENES = [
    dict(shot=None, title="NFCSTORE", sub="Raqamli vizitka", dur=2.4, serif=True),
    dict(shot="01-home", title="Butun shaxsingiz", sub="bitta ilovada", dur=3.0),
    dict(shot="04-nfc-center", title="Bir tegish", sub="va profil ochiladi", dur=2.8),
    dict(shot="p4-nfc-write", title="Kartaga yozing", sub="havola, matn yoki kontakt", dur=2.8),
    dict(shot="p1-feed-card", title="Lenta va postlar", sub="ilovaning ichida", dur=2.8),
    dict(shot="p2-reels", title="Reels va story", sub="hammasi shu yerda", dur=2.8),
    dict(shot="08-business", title="Biznesingiz uchun", sub="alohida profil", dur=2.8),
    dict(shot="11-business-stats", title="Ko'rsatkichlar", sub="ko'rish, obuna, buyurtma", dur=2.8),
    dict(shot=None, title="nfcstore.uz", sub="Google Play'da", dur=2.8, serif=True),
]

XFADE = 0.45  # sahnalar orasidagi erish

# Ilovaning O'Z shriftlari — rolik ilova bilan bir uslubda bo'lsin.
FONTS = {
    "sans": "assets/fonts/Manrope-700.ttf",
    "serif": "assets/fonts/PlayfairDisplay-500.ttf",
}

INK = "0xF6EFE0"   # iliq oq — ilovaning matn rangi
GOLD = "0xE8C87A"  # urg'u
BG = "0x0B0B0F"    # fon

TITLE_PT, SUB_PT = 54, 32

MARK = "assets/brand/nfcstore_mark.png"  # ilovaning NFC belgisi
MARK_W, MARK_Y = 300, 430                # matnli kartadagi o'lcham/joy

BAND = 290      # yuqoridagi to'q yo'lak — yozuv shu yerda
SHOT_H = H - BAND  # ekranga qolgan balandlik
PAN = 170       # sahna davomida ekran shuncha piksel suriladi


def write_text(txt_dir: str, name: str, text: str) -> str:
    """Yozuvni faylga chiqarish (fayl boshidagi "Matn fayl orqali")."""
    path = os.path.join(txt_dir, name + ".txt")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path


def scene_filter(idx: int, sc: dict, font_dir: str, txt_dir: str) -> str:
    """Bitta sahna: ekran + ustida yozuv uchun to'q yo'lak."""
    dur = sc["dur"]
    sans = os.path.join(font_dir, FONTS["sans"])
    serif = os.path.join(font_dir, FONTS["serif"])
    title_font = serif if sc.get("serif") else sans

    if sc["shot"]:
        # Ekran kadr KENGLIGIGA moslanadi va ASTA pastga suriladi —
        # tik ilova ekrani (1170x2532) bitta kadrga sig'maydi.
        # `scale=W:-2` — H.264 juft o'lchamni talab qiladi.
        #
        # Yozuv ekran USTIGA tushmaydi: ilova ekrani OCHIQ (krem) fonda,
        # unga yarim shaffof qoraytma qo'yilsa kir ko'rinadi. Shuning
        # uchun yozuvga ALOHIDA to'q yo'lak ajratiladi va u YUQORIDA:
        # Instagram o'zining tugmalarini kadr PASTIGA chizadi.
        base = (
            f"[{idx}:v]scale={W}:-2,"
            f"crop={W}:{SHOT_H}:0:"
            f"'min(ih-{SHOT_H}\\,min(ih-{SHOT_H}\\,{PAN})*t/{dur})',"
            f"fps={FPS},format=yuv420p,"
            f"pad={W}:{H}:0:{BAND}:color={BG}"
        )
        # Yo'lak ostidagi ingichka oltin chiziq — ilovaning uslubi.
        base += f",drawbox=x=0:y={BAND-3}:w={W}:h=3:color={GOLD}@0.6:t=fill"
    else:
        # Matnli kartada ilovaning NFC belgisi — bo'sh qora kadr
        # brendni ko'rsatmaydi. Belgi ALOHIDA zanjirda kattalashtirilib,
        # kartaga qo'shiladi: ffmpeg'da zanjir O'RTASIDA yangi kirish
        # ulab bo'lmaydi, shuning uchun zanjir uchga bo'linadi.
        base = (
            f"[{sc['mark_idx']}:v]scale={MARK_W}:-1[mk{idx}];"
            f"[{idx}:v]fps={FPS},format=yuv420p[c{idx}];"
            f"[c{idx}][mk{idx}]overlay=x=(W-w)/2:y={MARK_Y}:shortest=1"
        )

    y_title = 96 if sc["shot"] else MARK_Y + MARK_W // 2 + 80
    y_sub = y_title + 84

    t_file = write_text(txt_dir, f"t{idx}", sc["title"])
    s_file = write_text(txt_dir, f"s{idx}", sc["sub"])

    base += (
        f",drawtext=fontfile={title_font}:textfile={t_file}"
        f":fontcolor={INK}:fontsize={TITLE_PT}:x=(w-text_w)/2:y={y_title}"
        f",drawtext=fontfile={sans}:textfile={s_file}"
        f":fontcolor={GOLD}:fontsize={SUB_PT}:x=(w-text_w)/2:y={y_sub}"
    )
    # Birinchi va oxirgi kartada qorayishdan chiqish/kirish.
    if not sc["shot"]:
        base += f",fade=t=in:st=0:d=0.4,fade=t=out:st={dur-0.4}:d=0.4"
    return base + f"[v{idx}]"


def build(shots_dir: str, font_dir: str, out: str, txt_dir: str) -> list:
    for key, rel in FONTS.items():
        if not os.path.isfile(os.path.join(font_dir, rel)):
            sys.exit(f"shrift topilmadi: {os.path.join(font_dir, rel)}")

    mark = os.path.join(font_dir, MARK)
    if not os.path.isfile(mark):
        sys.exit(f"brend belgisi topilmadi: {mark}")

    inputs = []
    for sc in SCENES:
        if sc["shot"]:
            png = os.path.join(shots_dir, sc["shot"] + ".png")
            if not os.path.isfile(png):
                sys.exit(f"ekran topilmadi: {png}")
            inputs += ["-loop", "1", "-t", str(sc["dur"]), "-i", png]
        else:
            inputs += ["-f", "lavfi", "-t", str(sc["dur"]),
                       "-i", f"color=c={BG}:s={W}x{H}:r={FPS}"]

    # Belgi har bir matnli kartaga ALOHIDA kirish bo'lib ulanadi:
    # bitta kirishni ikki joyda ishlatish uchun `split` kerak bo'lardi,
    # bu esa indekslarni chalkashtiradi.
    nxt = len(SCENES)
    for sc in SCENES:
        if not sc["shot"]:
            sc["mark_idx"] = nxt
            inputs += ["-loop", "1", "-t", str(sc["dur"]), "-i", mark]
            nxt += 1

    filters = [scene_filter(i, sc, font_dir, txt_dir)
               for i, sc in enumerate(SCENES)]

    # Sahnalarni ketma-ket erishtirish. `offset` — oldingilarning
    # yig'indisidan erish uzunligi ayirilgan holda.
    chain, prev, offset = [], "[v0]", 0.0
    for i in range(1, len(SCENES)):
        offset += SCENES[i - 1]["dur"] - XFADE
        tag = f"[x{i}]"
        chain.append(
            f"{prev}[v{i}]xfade=transition=fade:duration={XFADE}"
            f":offset={offset:.3f}{tag}"
        )
        prev = tag

    total = sum(s["dur"] for s in SCENES) - XFADE * (len(SCENES) - 1)
    # JIM AUDIO YO'LAGI — iPhone talabi (fayl boshidagi izoh).
    audio_idx = nxt
    inputs += ["-f", "lavfi", "-t", f"{total:.3f}", "-i",
               "anullsrc=channel_layout=stereo:sample_rate=44100"]

    fc = ";".join(filters + chain)
    return [
        "ffmpeg", "-y", "-v", "error", *inputs,
        "-filter_complex", fc,
        "-map", prev, "-map", f"{audio_idx}:a",
        "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-preset", "slow", "-crf", "23", "-r", str(FPS),
        "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-t", f"{total:.3f}", out,
    ]


def probe(path: str) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration:stream=codec_name,codec_type,width,height,"
         "pix_fmt,color_space,sample_rate,channels",
         "-of", "json", path],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", required=True,
                    help="test/shots/png papkasi")
    ap.add_argument("--fonts", required=True,
                    help="mobile_nova papkasi (assets/fonts ichida)")
    ap.add_argument("--out", default="promo.mp4")
    a = ap.parse_args()

    txt_dir = os.path.join(os.path.dirname(os.path.abspath(a.out)) or ".",
                           "promo-matn")
    os.makedirs(txt_dir, exist_ok=True)

    cmd = build(a.shots, a.fonts, a.out, txt_dir)
    print(" ".join(shlex.quote(c) for c in cmd)[:300] + " ...")
    subprocess.run(cmd, check=True)

    info = probe(a.out)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    au = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    print(f"\n{a.out}")
    print(f"  {v['width']}x{v['height']} · {v['codec_name']} · "
          f"{v['pix_fmt']} · {v.get('color_space')}")
    print(f"  audio: {au['codec_name'] if au else 'YO‘Q'} "
          f"{au['sample_rate'] if au else ''} Hz, "
          f"{au['channels'] if au else ''} kanal")
    print(f"  {float(info['format']['duration']):.1f} s · "
          f"{os.path.getsize(a.out) / 1024:.0f} KB")

    # iPhone sharti — fayl boshidagi izoh. Buzilsa DARHOL aytiladi.
    bad = []
    if not au:
        bad.append("audio yo'lagi yo'q — iPhone ochmaydi")
    if v.get("color_space") != "bt709":
        bad.append(f"color_space {v.get('color_space')}, bt709 emas")
    if v["pix_fmt"] != "yuv420p":
        bad.append(f"pix_fmt {v['pix_fmt']}, yuv420p emas")
    if bad:
        sys.exit("XATO: " + "; ".join(bad))
    print("  ✓ iPhone sharti bajarildi (AAC + bt709 + yuv420p)")


if __name__ == "__main__":
    main()
