#!/usr/bin/env python3
"""PLAY CONSOLE GRAFIKASINI YASAYDI.

Ikki fayl chiqadi:

    play-icon-512.png           App icon
    play-feature-1024x500.png   Feature graphic

Ranglar va shriftlar ILOVADAN olinadi (`noir` mavzusi), shuning
uchun do'kon sahifasi ilovaning o'zi bilan bir tilda ko'rinadi.

    python3 docs/play-assets/build.py
"""
from PIL import Image, ImageDraw, ImageFont

OUT = 'docs/play-assets'
FONTS = 'mobile_nova/assets/fonts'
MARK = 'src/assets/logo-512.png'

# `nfc_tokens.dart` -> `noir`
BG2 = (5, 11, 20)        # #050B14
BG1 = (7, 17, 31)        # #07111F
GOLD = (228, 201, 122)   # #E4C97A
INK = (244, 241, 232)    # #F4F1E8
DIM = (168, 178, 192)


def vgrad(size, top, bottom):
    w, h = size
    img = Image.new('RGB', size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / max(1, h - 1)
        d.line([(0, y), (w, y)],
               fill=tuple(round(top[i] + (bottom[i] - top[i]) * k)
                          for i in range(3)))
    return img


def glow(img, cx, cy, radius, color, strength=0.55):
    """Yumshoq radial yorug'lik — ilovadagi `ambient` bilan bir tilda."""
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 48
    for i in range(steps, 0, -1):
        r = radius * i / steps
        a = int(255 * strength * (1 - i / steps) ** 2.2)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return Image.alpha_composite(img.convert('RGBA'), layer)


def icon():
    """512x512 — KVADRAT TO'LA bo'yaladi.

    Mavjud `logo-512.png` doira va burchaklari shaffof. Play
    belgini kvadrat maskaga soladi, natijada doira atrofida bo'sh
    joy ko'rinadi.
    """
    img = vgrad((512, 512), (18, 30, 48), BG2)
    img = glow(img, 256, 200, 300, GOLD, 0.14)
    mark = Image.open(MARK).convert('RGBA').resize((392, 392), Image.LANCZOS)
    img.alpha_composite(mark, (60, 60))
    img.convert('RGB').save(f'{OUT}/play-icon-512.png')


def feature():
    """1024x500 — do'kon sahifasining tepasi.

    Google uni turli o'lchamda qirqadi, shuning uchun matn
    markazga yaqin va chetlarda hech narsa yo'q.
    """
    img = vgrad((1024, 500), (16, 28, 46), BG1)
    img = glow(img, 300, 250, 520, GOLD, 0.20)
    img = glow(img, 860, 140, 420, (120, 170, 230), 0.10)

    logo = Image.open(MARK).convert('RGBA').resize((300, 300), Image.LANCZOS)
    img.alpha_composite(logo, (96, 100))

    img = img.convert('RGB')
    d = ImageDraw.Draw(img)
    serif = ImageFont.truetype(f'{FONTS}/InstrumentSerif-400.ttf', 92)
    sans = ImageFont.truetype(f'{FONTS}/Manrope-500.ttf', 30)
    mono = ImageFont.truetype(f'{FONTS}/IBMPlexMono-500.ttf', 22)

    x = 440
    d.text((x, 150), 'NFCSTORE', font=serif, fill=INK)
    # Shior ikki qatorda: bitta qatorda 1024 px ga sig'masdi.
    d.text((x, 262), 'Raqamli vizitka', font=sans, fill=DIM)
    d.text((x, 300), 'Bitta tegishda ulashing', font=sans, fill=DIM)
    d.text((x, 358), 'nfcstore.uz', font=mono, fill=GOLD)
    img.save(f'{OUT}/play-feature-1024x500.png')


if __name__ == '__main__':
    icon()
    feature()
    print('tayyor:', OUT)
