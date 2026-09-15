# -*- coding: utf-8 -*-
"""Logotipdan barcha ikonkalarni chiqaradi (gen-icons.mjs chaqiradi).

    python3 scripts/gen-icons.py

Manbalar (IKKITA, ikkalasi ham `src/assets/` da):
  nfcstore-logo-source.png  — MEDALYON: oltin gardish, quyuq yuza,
                              markazda belgi. Burchaklari shaffof.
  nfcstore-mark-source.png  — BELGINING O'ZI: doirasiz, fonsiz,
                              butunlay shaffof (suv belgisi uchun).

NIMA UCHUN QAYTA YOZILDI. Eski skript logotipni O'ZI YIG'ARDI:
qorong'i radial fon chizardi va ustiga yorug'lik bo'yicha kesib
olingan "oltin belgi" ni qo'yardi. O'sha paytda manba oq fondagi
yassi belgi edi va bu to'g'ri ishlardi.

Endi manba — tayyor medalyon: gardish, yuza va belgi atrofidagi
nafas rasmning O'ZIDA. Eski mantiq bu rasmga tushsa ikki xato
qilardi:
  1) yorug'lik bo'yicha alfa yasagani uchun medalyonning quyuq
     yuzasi YARIM SHAFFOF bo'lib qolardi — tanga ichi "teshik";
  2) tanganing o'zini "belgi" deb kanvasning 69% iga kichraytirib,
     ustiga yana bir qorong'i doira chizardi — natijada doira
     ichida doira.
Ya'ni skriptni ishga tushirish ishlab turgan ikonkalarni BUZARDI.
Endi u manbaning o'z alfasini saqlaydi va faqat o'lchamini beradi.

CHEKKA QOIDASI (MARGIN). Egasi aniq aytdi: "ikki cheti dumaloqqa
yopishib qolmasin". Ilgari ikonkalarning ko'pida tanga chekkadan
chekkaga turardi (gardish 100% enida) — brauzer yoki Android
ikonkani biroz yumaloqlasa oltin gardish qirqilardi. Endi HAR BIR
ikonkada atrofida bo'sh joy bor va u BITTA joyda — shu yerda —
belgilanadi.
"""
import os
import shutil

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_MEDALLION = os.path.join(ROOT, 'src', 'assets', 'nfcstore-logo-source.png')
SRC_MARK = os.path.join(ROOT, 'src', 'assets', 'nfcstore-mark-source.png')

# Master kanvas — hamma ikonka SHUNDAN kichraytiriladi. Ketma-ket
# kichraytirish (512 -> 192 -> 96) har qadamda detal yo'qotadi.
MASTER_SIZE = 1024

# Tanga atrofidagi bo'sh joy, ikonka enining ulushi sifatida.
# 0.04 = har tomondan 4%, ya'ni tanga enining 92% ini egallaydi.
MARGIN = 0.04

# Maskable (Android): tizim ikonkaning chetlarini KESADI, shuning
# uchun tanga "xavfsiz zona" ichida — kanvasning 78% ida — turadi,
# atrofi esa brend foni bilan to'ldiriladi.
MASKABLE_SAFE = 0.78
MASKABLE_BG = (26, 24, 20, 255)


def load_square(path):
    """Manbani shaffof burchaklari bilan o'qib, kvadratga soladi.

    Manbaning O'Z alfasi saqlanadi — hech narsa qayta kesilmaydi.
    """
    im = Image.open(path).convert('RGBA')
    box = im.getbbox()
    if box is None:
        raise SystemExit('Manba butunlay shaffof: %s' % path)
    im = im.crop(box)

    # MANBA SHAFFOF BO'LISHI SHART. Agar burchaklar to'q bo'lsa,
    # rasm kvadrat fon bilan kelgan: uni dumaloq niqob ostiga qo'ysak
    # chekkalarda fon bo'lagi ko'rinib qoladi. Jim o'tkazmaymiz.
    w, h = im.size
    corners = [im.getpixel(p)[3] for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if min(corners) > 8:
        raise SystemExit(
            'Manbaning burchaklari SHAFFOF EMAS (alfa: %s).\n'
            'Bu skript burchagi shaffof, tayyor logotipni kutadi: %s' % (corners, path))

    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(im, ((side - w) // 2, (side - h) // 2))
    return sq


MEDALLION = load_square(SRC_MEDALLION).resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)
MARK = load_square(SRC_MARK).resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)
print('Manba: %s + %s' % (os.path.relpath(SRC_MEDALLION, ROOT), os.path.relpath(SRC_MARK, ROOT)))


def render(master, size, margin=MARGIN):
    """Kanvasi `size`, ichida `margin` bo'sh joy qoldirilgan ikonka."""
    inner = max(1, int(round(size * (1 - 2 * margin))))
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.alpha_composite(master.resize((inner, inner), Image.LANCZOS),
                        ((size - inner) // 2, (size - inner) // 2))
    return img


def save(img, *parts):
    path = os.path.join(ROOT, *parts)
    img.save(path, 'PNG', optimize=True)
    print('  %-42s %dx%d  %d KB' % (os.path.join(*parts), img.width, img.height,
                                    os.path.getsize(path) // 1024))


print('Asosiy ikonkalar (medalyon):')
for size, parts in [
    (512, ('public', 'logo-512.png')),
    (192, ('public', 'logo-192.png')),
    (180, ('public', 'apple-touch-icon.png')),
    (512, ('src', 'assets', 'logo-512.png')),
    (512, ('src', 'assets', 'logo.png')),
    (256, ('src', 'assets', 'logo-256.png')),
    (128, ('src', 'assets', 'logo-128.png')),
]:
    save(render(MEDALLION, size), *parts)

print('Maskable (Android — chetlari kesiladi):')
for size, parts in [(512, ('public', 'icon-maskable-512.png')),
                    (192, ('public', 'icon-maskable-192.png'))]:
    canvas = Image.new('RGBA', (size, size), MASKABLE_BG)
    inner = int(round(size * MASKABLE_SAFE))
    piece = MEDALLION.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(piece, ((size - inner) // 2, (size - inner) // 2))
    save(canvas, *parts)

# FAVICON — 16 px gacha kichrayadi. Chekka bo'sh joy bu yerda ikki
# barobar qimmat: 16 px da 4% = yarim piksel, ya'ni gardish loyqa
# bo'ladi. Shuning uchun favicon uchun chekka ikki barobar kichik.
FAVICON_MARGIN = MARGIN / 2
print('Favicon (chekka ikki barobar kichik — 16 px da gardish aniq):')
save(render(MEDALLION, 96, FAVICON_MARGIN), 'public', 'favicon.png')
save(render(MEDALLION, 96, FAVICON_MARGIN), 'src', 'assets', 'favicon.png')
save(render(MEDALLION, 32, FAVICON_MARGIN), 'src', 'assets', 'favicon-32.png')

ICO_SIZES = [16, 32, 48, 64, 128, 256]
ico = [render(MEDALLION, s, FAVICON_MARGIN) for s in ICO_SIZES]
ico_path = os.path.join(ROOT, 'public', 'favicon.ico')
ico[-1].save(ico_path, format='ICO', sizes=[(s, s) for s in ICO_SIZES])
print('  %-42s %s  %d KB' % ('public/favicon.ico', 'x'.join(map(str, ICO_SIZES)),
                             os.path.getsize(ico_path) // 1024))

# ILOVA (Flutter). Ilovada logotip AYNAN SHU fayllardan chiqadi —
# "logotip hamma joyda bitta" degani shu. `assets/img/` butun papka
# APK ichiga tushadi, shuning uchun bu yerda ortiqcha fayl bo'lmasin.
print('Ilova (mobile/assets/img):')
save(render(MEDALLION, 512), 'mobile', 'assets', 'img', 'logo_medallion.png')
save(render(MARK, 512, margin=0.0), 'mobile', 'assets', 'img', 'logo_mark.png')

stale = os.path.join(ROOT, 'mobile', 'assets', 'img', 'logo.png')
if os.path.exists(stale):
    os.remove(stale)
    print('  eskirgan mobile/assets/img/logo.png o\'chirildi')
