# -*- coding: utf-8 -*-
"""Logotipdan barcha ikonkalarni chiqaradi (gen-icons.mjs chaqiradi).

Sifat uchun uchta qoida:
  1) Dumaloq niqob 8x o'lchamda chiziladi va keyin kichraytiriladi —
     shunda chekka mukammal silliq bo'ladi (oddiy chizilgan doirada
     "zinapoya" qolardi).
  2) Kichraytirish LANCZOS bilan, HAR DOIM MANBADAN — ketma-ket
     kichraytirish (512 -> 192 -> 96) har qadamda detal yo'qotadi.
  3) Niqob radiusi haqiqiy doiradan 2 piksel ICHKARIDA — manbadagi
     oq fon rimning atrofida ochiq halo bo'lib qolardi.

Favicon ALOHIDA: 16-48 px da nozik oltin rim va tashqi yoylar
"loyqa"ga aylanadi. Shuning uchun favicon uchun tasvir markazga
yaqinroq kesiladi (belgi kattaroq ko'rinadi) — 16 px da ham "N"
o'qiladi.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'assets', 'nfcstore-logo-source.png')

# Manbadagi doira (skript bilan o'lchangan: markaz 483,482 radius 479.5)
CENTER = (483.0, 482.0)
RADIUS = 479.5
SS = 8  # niqob uchun supersampling


def square_master():
    """Manbani doira markazi bo'yicha KVADRAT qilib kesadi."""
    im = Image.open(SRC).convert('RGBA')
    r = RADIUS
    box = (int(round(CENTER[0] - r)), int(round(CENTER[1] - r)),
           int(round(CENTER[0] + r)), int(round(CENTER[1] + r)))
    # Manbadan chiqib ketmasin
    box = (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3]))
    im = im.crop(box)
    side = min(im.size)
    return im.crop((0, 0, side, side))


MASTER = square_master()


def circle_mask(size, inset_ratio=0.0):
    """Silliq dumaloq niqob. `inset_ratio` — chetdan ichkariga surish."""
    big = size * SS
    m = Image.new('L', (big, big), 0)
    d = ImageDraw.Draw(m)
    pad = inset_ratio * big
    d.ellipse((pad, pad, big - 1 - pad, big - 1 - pad), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def render(size, zoom=1.0, inset=0.0):
    """`zoom` > 1 — belgini kattalashtirib kesadi (favicon uchun)."""
    src = MASTER
    if zoom > 1.0:
        side = int(src.width / zoom)
        off = (src.width - side) // 2
        src = src.crop((off, off, off + side, off + side))
    img = src.resize((size, size), Image.LANCZOS)
    # Manbadagi oq fon rim atrofida halo qoldirmasin: niqob doirasi
    # 2 piksel (nisbatda) ichkarida.
    img.putalpha(circle_mask(size, inset_ratio=inset))
    return img


def save(img, *parts):
    path = os.path.join(ROOT, *parts)
    img.save(path, 'PNG', optimize=True)
    print('  %-38s %dx%d  %d KB' % (os.path.join(*parts), img.width, img.height,
                                    os.path.getsize(path) // 1024))


INSET = 2.0 / (RADIUS * 2)  # ~2 piksel manba o'lchamida

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
    save(render(size, inset=INSET), *parts)

# MASKABLE — Android ikonkani kesib, dumaloq/kvadrat shaklga soladi.
# Shuning uchun logotip kanvasning ~80% ini egallashi kerak ("xavfsiz
# zona"), atrofi esa logotipning o'z foni rangida to'ldiriladi.
print('Maskable (Android — chetlari kesiladi):')
BG = (26, 24, 20, 255)
for size, parts in [(512, ('public', 'icon-maskable-512.png')), (192, ('public', 'icon-maskable-192.png'))]:
    canvas = Image.new('RGBA', (size, size), BG)
    inner = int(size * 0.80)
    canvas.paste(render(inner, inset=INSET), ((size - inner) // 2, (size - inner) // 2), render(inner, inset=INSET))
    save(canvas, *parts)

# FAVICON — kichik o'lchamda belgi KATTAROQ ko'rinsin.
#
# NIMA UCHUN BUNCHA KATTA (2.2x): to'liq logotipda "N" doira
# diametrining atigi 29% ini egallaydi — 16 px lik faviconda bu ~4.6
# piksel, ya'ni belgi umuman o'qilmaydi (o'lchab ko'rildi). 2.2x
# kesishda nozik oltin rim va tashqi yoylar chiqib ketadi, "N" esa
# ikonkaning ~64% ini egallaydi va kichik o'lchamda ham aniq ko'rinadi.
print('Favicon (belgi kattaroq — 16 px da ham o\'qiladi):')
FAV_ZOOM = 1.95
save(render(96, zoom=FAV_ZOOM, inset=INSET), 'public', 'favicon.png')
save(render(96, zoom=FAV_ZOOM, inset=INSET), 'src', 'assets', 'favicon.png')
save(render(32, zoom=FAV_ZOOM, inset=INSET), 'src', 'assets', 'favicon-32.png')

ico_sizes = [16, 32, 48, 64, 128, 256]
ico = [render(s, zoom=FAV_ZOOM, inset=INSET) for s in ico_sizes]
ico_path = os.path.join(ROOT, 'public', 'favicon.ico')
ico[-1].save(ico_path, format='ICO', sizes=[(s, s) for s in ico_sizes])
print('  %-38s %s  %d KB' % ('public/favicon.ico', 'x'.join(map(str, ico_sizes)),
                             os.path.getsize(ico_path) // 1024))
