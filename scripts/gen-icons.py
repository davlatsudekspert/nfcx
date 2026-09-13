# -*- coding: utf-8 -*-
"""Logotipdan barcha ikonkalarni chiqaradi (gen-icons.mjs chaqiradi).

    python3 scripts/gen-icons.py [manba.png]

Manba berilmasa `src/assets/nfcstore-logo-source.png` olinadi.

MANBA QANDAY BO'LSA HAM ISHLAYDI. Ilgari bu skriptda eski logotipning
doira markazi va radiusi QATTIQ yozilgan edi (markaz 483,482 radius
479.5) — ya'ni logotip o'zgarsa skript ham buzilardi. Endi oltin
belgining chegarasi tasvirning O'ZIDAN o'lchanadi, shuning uchun:
  - gardishli dumaloq tanga ham,
  - gardishsiz keng belgi ham
bir xil ishlaydi.

Sifat uchun uchta qoida:
  1) Dumaloq niqob 8x o'lchamda chiziladi va keyin kichraytiriladi —
     shunda chekka mukammal silliq bo'ladi (oddiy chizilgan doirada
     "zinapoya" qolardi).
  2) Kichraytirish LANCZOS bilan, HAR DOIM MASTERDAN — ketma-ket
     kichraytirish (512 -> 192 -> 96) har qadamda detal yo'qotadi.
  3) Belgi doira ICHIGA to'liq sig'adi: markazdan eng uzoq oltin
     piksel o'lchanadi va shunga qarab masshtab tanlanadi. Keng
     logotipning yon yoylari shu sabab qirqilib qolmaydi.

Favicon ALOHIDA: 16-48 px da nozik detallar "loyqa"ga aylanadi.
Shuning uchun favicon uchun tasvir markazga yaqinroq kesiladi (belgi
kattaroq ko'rinadi) — 16 px da ham "N" o'qiladi.
"""
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'src', 'assets', 'nfcstore-logo-source.png')

# Master kanvas — hamma ikonka SHUNDAN kichraytiriladi.
MASTER_SIZE = 1024

# Belgi radiusi doira radiusiga nisbatan. Eski logotipda ichki belgi
# doiraning 69% ini egallagan — yangi logotip ham shu og'irlikda
# ko'rinsin, aks holda u boshqa joylardagi dizayn bilan urishadi.
SYMBOL_RATIO = 0.69

# Oltinni fondan ajratish chegaralari. Fon deyarli qora, belgi yorqin;
# oradagi ramp chekkani silliq qoldiradi (keskin kesishda "arra"
# qolardi).
ALPHA_LO, ALPHA_HI = 22.0, 70.0

# Oltin pikselni topish chegarasi: yorqin VA sariqroq (ko'k kamroq).
# Faqat yorqinlik bo'yicha izlasak, fondagi shovqin ham tushardi.
GOLD_MIN, GOLD_WARMTH = 110, 30

SS = 8  # niqob uchun supersampling


def load_symbol(path):
    """Manbadan oltin belgini KESIB, alfasi bilan qaytaradi.

    Qaytaradi: (belgi RGBA, markazi (cx, cy), markazdan eng uzoq
    oltin piksel masofasi).
    """
    im = Image.open(path).convert('RGB')
    r, g, b = im.split()
    lum = ImageChops.lighter(ImageChops.lighter(r, g), b)

    # 1-qadam: oltin pikselning chegarasi.
    lp, bp, rp = lum.load(), b.load(), r.load()
    w, h = im.size
    minx, maxx, miny, maxy = w, -1, h, -1
    for y in range(h):
        for x in range(w):
            if lp[x, y] > GOLD_MIN and rp[x, y] - bp[x, y] > GOLD_WARMTH:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        raise SystemExit('Manbada oltin belgi topilmadi: %s' % path)

    cx, cy = (minx + maxx) / 2.0, (miny + maxy) / 2.0

    # 2-qadam: markazdan eng uzoq oltin piksel. Belgi burchaklari bo'sh
    # bo'lgani uchun bu chegara to'rtburchagining diagonalidan KICHIK
    # bo'lishi mumkin — shuning uchun alohida o'lchanadi.
    maxr = 0.0
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            if lp[x, y] > GOLD_MIN and rp[x, y] - bp[x, y] > GOLD_WARMTH:
                d = math.hypot(x - cx, y - cy)
                if d > maxr:
                    maxr = d

    # MANBA FONI QORONG'I BO'LISHI SHART. Alfa yorug'lik bo'yicha
    # yasaladi: yorqin piksel = belgi. Fon och bo'lsa (eski logotipda
    # oltin tanga OQ fonda edi) o'sha fon ham "belgi" bo'lib qoladi va
    # ikonkada oq burchaklar chiqadi. Buni jimgina o'tkazib yubormay,
    # aniq xato bilan to'xtaymiz — aks holda buzuq logotip saytga
    # chiqib ketardi.
    corners = [lp[2, 2], lp[w - 3, 2], lp[2, h - 3], lp[w - 3, h - 3]]
    if max(corners) > ALPHA_HI:
        raise SystemExit(
            'Manba foni OCH (burchaklar: %s). Bu skript oltin belgi QORONG\'I\n'
            'fonda bo\'lgan manbani kutadi. Foni oq bo\'lgan logotipni avval\n'
            'qora fonga o\'tkazing yoki fonini shaffof qiling: %s' % (corners, path))

    alpha = lum.point(lambda v: 0 if v <= ALPHA_LO else
                      (255 if v >= ALPHA_HI else int(255 * (v - ALPHA_LO) / (ALPHA_HI - ALPHA_LO))))
    sym = im.copy()
    sym.putalpha(alpha)

    # Chegaraga biroz zaxira: belgining yumshoq nuri ham qolsin.
    pad = int(maxr * 0.08)
    box = (max(0, minx - pad), max(0, miny - pad),
           min(w, maxx + 1 + pad), min(h, maxy + 1 + pad))
    return sym.crop(box), (cx - box[0], cy - box[1]), maxr


def background(size):
    """Nozik qorong'i radial gradient — tekis qora yassi ko'rinadi."""
    im = Image.new('RGB', (size, size), (13, 11, 9))
    d = ImageDraw.Draw(im)
    steps = 160
    for i in range(steps, 0, -1):
        t = i / steps
        rad = t * size * 0.72
        k = 1.0 - t
        col = (int(13 + 22 * k * k), int(11 + 20 * k * k), int(9 + 17 * k * k))
        d.ellipse((size / 2 - rad, size / 2 - rad, size / 2 + rad, size / 2 + rad), fill=col)
    return im


def build_master(size):
    """Kvadrat master: qorong'i fon + markazda oltin belgi."""
    sym, (scx, scy), maxr = load_symbol(SRC)
    k = (SYMBOL_RATIO * size / 2.0) / maxr
    nw, nh = max(1, int(round(sym.width * k))), max(1, int(round(sym.height * k)))
    scaled = sym.resize((nw, nh), Image.LANCZOS)
    canvas = background(size).convert('RGBA')
    canvas.alpha_composite(scaled, (int(round(size / 2.0 - scx * k)),
                                    int(round(size / 2.0 - scy * k))))
    return canvas


print('Manba: %s' % os.path.relpath(SRC, ROOT))
MASTER = build_master(MASTER_SIZE)


def circle_mask(size):
    """Silliq dumaloq niqob."""
    big = size * SS
    m = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m).ellipse((0, 0, big - 1, big - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def render(size, zoom=1.0):
    """`zoom` > 1 — belgini kattalashtirib kesadi (favicon uchun)."""
    src = MASTER
    if zoom > 1.0:
        side = int(src.width / zoom)
        off = (src.width - side) // 2
        src = src.crop((off, off, off + side, off + side))
    img = src.resize((size, size), Image.LANCZOS)
    img.putalpha(circle_mask(size))
    return img


def save(img, *parts):
    path = os.path.join(ROOT, *parts)
    img.save(path, 'PNG', optimize=True)
    print('  %-38s %dx%d  %d KB' % (os.path.join(*parts), img.width, img.height,
                                    os.path.getsize(path) // 1024))


print('Asosiy ikonkalar (to\'liq logotip):')
for size, parts in [
    (512, ('public', 'logo-512.png')),
    (192, ('public', 'logo-192.png')),
    (180, ('public', 'apple-touch-icon.png')),
    (512, ('src', 'assets', 'logo-512.png')),
    (512, ('src', 'assets', 'logo.png')),
    (256, ('src', 'assets', 'logo-256.png')),
    (128, ('src', 'assets', 'logo-128.png')),
]:
    save(render(size), *parts)

# MASKABLE — Android ikonkani kesib, dumaloq/kvadrat shaklga soladi.
# Shuning uchun logotip kanvasning ~80% ini egallashi kerak ("xavfsiz
# zona"), atrofi esa logotipning o'z foni rangida to'ldiriladi.
print('Maskable (Android — chetlari kesiladi):')
BG = (26, 24, 20, 255)
for size, parts in [(512, ('public', 'icon-maskable-512.png')), (192, ('public', 'icon-maskable-192.png'))]:
    canvas = Image.new('RGBA', (size, size), BG)
    inner = int(size * 0.80)
    piece = render(inner)
    canvas.paste(piece, ((size - inner) // 2, (size - inner) // 2), piece)
    save(canvas, *parts)

# FAVICON — kichik o'lchamda belgi KATTAROQ ko'rinsin.
#
# NIMA UCHUN KATTALASHTIRILADI: to'liq logotipda belgi doira
# diametrining atigi ~69% ini egallaydi, atrofi esa bo'sh fon. 16 px
# lik faviconda bu belgini o'qib bo'lmaydigan qilib qo'yadi. Kesish
# bilan belgi ikonkaning deyarli butun eniga chiqadi.
print('Favicon (belgi kattaroq — 16 px da ham o\'qiladi):')
FAV_ZOOM = 1.35
save(render(96, zoom=FAV_ZOOM), 'public', 'favicon.png')
save(render(96, zoom=FAV_ZOOM), 'src', 'assets', 'favicon.png')
save(render(32, zoom=FAV_ZOOM), 'src', 'assets', 'favicon-32.png')

ico_sizes = [16, 32, 48, 64, 128, 256]
ico = [render(s, zoom=FAV_ZOOM) for s in ico_sizes]
ico_path = os.path.join(ROOT, 'public', 'favicon.ico')
ico[-1].save(ico_path, format='ICO', sizes=[(s, s) for s in ico_sizes])
print('  %-38s %s  %d KB' % ('public/favicon.ico', 'x'.join(map(str, ico_sizes)),
                             os.path.getsize(ico_path) // 1024))
