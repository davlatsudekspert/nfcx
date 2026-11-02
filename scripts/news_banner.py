# -*- coding: utf-8 -*-
"""Yangilik banneri — ilovaning HAQIQIY ekranlaridan, sayt uslubida.

    python3 scripts/news_banner.py --shots <png papka> --fonts <mobile_nova>

Mavjud bannerlar (`public/business-assets/news/*.jpg`) qo'lda chizilgan
edi va keyingisini xuddi shunday chiqarishning yo'li yo'q edi: fon,
ramka, sarlavha o'lchami, telefon mokaplari — hammasi "ko'zga qarab".
Bu skript o'sha uslubni QOIDAGA aylantiradi, shuning uchun keyingi
yangilik banneri avvalgilariga o'xshaydi.

O'lcham 1600x900 — mavjud to'rtala banner shunday (sayt kartasi ham,
Telegram/OG oldindan ko'rinishi ham shu nisbatga mo'ljallangan).

TELEFON EKRANLARI — HAQIQIY. `mobile_nova/test/shots` chizgan PNG'lar
olinadi, chizilgan maket emas: rasmda ko'ringan tugma ilovada ham
aynan shunday turadi.

Pillow kerak:  pip install Pillow
"""

import argparse
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:  # pragma: no cover
    sys.exit('Pillow kerak:  pip install Pillow')

W, H = 1600, 900

BG = (11, 11, 15)
INK = (246, 239, 224)
GOLD = (201, 169, 97)
GOLD_SOFT = (232, 200, 122)

PAD = 96          # chap ustun chekkasi
FRAME = 28        # ramka chekkadan qancha ichkarida

FONTS = {
    'serif': 'assets/fonts/PlayfairDisplay-500.ttf',
    'sans': 'assets/fonts/Manrope-400.ttf',
    'sans_mid': 'assets/fonts/Manrope-500.ttf',
    'sans_bold': 'assets/fonts/Manrope-700.ttf',
}


# ── BANNERLAR ───────────────────────────────────────────────────────
# `accent` — sarlavhaning oltin rangda chiqadigan QATORI (indeks).
# `shots` — uchta ekran: [chapdagi, OLDINDAGI, o'ngdagi].
BANNERS = {
    'play-market': dict(
        title=['Ilova endi', 'Google Play’da'],
        accent=1,
        sub=['Android uchun NFCSTORE ilovasini Play Market’dan',
             'bepul yuklab oling.'],
        badges=[('HOZIR', 'Google Play', True), ('TEZ KUNDA', 'App Store', False)],
        shots=['04-nfc-center', '01-home', '05-profile'],
    ),
    'bepul-katalog': dict(
        title=['Tovarlaringizni', 'bepul joylang'],
        accent=1,
        sub=['Biznes hisob ochish bepul — mahsulot va xizmatlaringiz',
             'ilovadagi umumiy katalogda ko‘rinadi.'],
        badges=[('BEPUL', 'Biznes hisob', True), ('90 KUN', 'Limitsiz sinov', False)],
        shots=['09-business-catalog', '08-business', '11-business-stats'],
    ),
}


def font(font_dir, key, size):
    return ImageFont.truetype(os.path.join(font_dir, FONTS[key]), size)


def spaced(text, gap=' '):
    """Harflar orasi ochilgan yozuv — Pillow'da letter-spacing yo'q."""
    return gap.join(text)


def backdrop():
    """Fon: quyuq tun + o'ng yuqorida iliq oltin nur."""
    img = Image.new('RGB', (W, H), BG)
    glow = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(glow)
    # Kattaroq ellipsdan kichikroq yorug'likka — bir necha qatlam
    # gradient o'rnini bosadi (Pillow'da radial gradient yo'q).
    for i, (r, v) in enumerate(((760, 26), (520, 30), (300, 34))):
        d.ellipse((1180 - r, 180 - r, 1180 + r, 180 + r), fill=v)
        if i == 0:
            glow = glow.filter(ImageFilter.GaussianBlur(120))
            d = ImageDraw.Draw(glow)
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img.paste(Image.new('RGB', (W, H), GOLD), (0, 0), glow)
    return img


def frame(img):
    """Ichki oltin hoshiya — mavjud bannerlardagidek nozik."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (FRAME, FRAME, W - FRAME, H - FRAME), radius=26,
        outline=GOLD + (56,), width=1)
    img.paste(Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB'), (0, 0))


def phone(path, w, h, radius=34):
    """Ekran surati — yumaloq burchak, nozik hoshiya, soya bilan."""
    src = Image.open(path).convert('RGB')
    # Kenglik bo'yicha moslanadi, keyin TEPADAN kesiladi: ilova
    # ekranining eng muhim qismi yuqorida.
    scale = w / src.width
    src = src.resize((w, max(h, int(src.height * scale))), Image.LANCZOS).crop((0, 0, w, h))

    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    card = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    card.paste(src, (0, 0), mask)
    ImageDraw.Draw(card).rounded_rectangle(
        (0, 0, w - 1, h - 1), radius=radius, outline=(255, 255, 255, 46), width=2)

    pad = 60
    out = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (pad, pad + 14, pad + w, pad + h + 14), radius=radius, fill=(0, 0, 0, 190))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))
    out.alpha_composite(card, (pad, pad))
    return out


def draw_badge(img, d, xy, label, value, filled, font_dir):
    """Ikki qatorli tugmacha: ustida kichik yorliq, ostida matn."""
    f_lab = font(font_dir, 'sans_mid', 15)
    f_val = font(font_dir, 'sans_bold', 25)
    x, y = xy
    w = max(d.textlength(spaced(label), f_lab), d.textlength(value, f_val)) + 64
    h = 78
    layer = Image.new('RGBA', (int(w) + 2, h + 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    if filled:
        ld.rounded_rectangle((0, 0, w, h), radius=h // 2, fill=GOLD_SOFT + (255,))
    else:
        ld.rounded_rectangle((0, 0, w, h), radius=h // 2, outline=INK + (70,), width=2)
    img.alpha_composite(layer, (x, y))
    lab_col = (40, 32, 16) if filled else GOLD
    val_col = (20, 16, 8) if filled else INK
    d.text((x + w / 2, y + 22), spaced(label), font=f_lab, fill=lab_col, anchor='mm')
    d.text((x + w / 2, y + 52), value, font=f_val, fill=val_col, anchor='mm')
    return int(w)


def build(spec, shots_dir, font_dir, out_path):
    img = backdrop().convert('RGBA')

    # ── O'NG TOMON: uchta ekran, o'rtadagisi oldinda ──
    left, front, right = spec['shots']
    # Yon ekranlar OLDINDAGISINING ortidan ko'rinib tursin: uchalasi
    # juda yaqin bo'lsa yonidagilardan faqat qirrasi qoladi.
    for name, (x, y, w, h) in (
        (left, (852, 170, 300, 580)),
        (right, (1252, 170, 290, 580)),
        (front, (1046, 92, 340, 690)),
    ):
        png = os.path.join(shots_dir, name + '.png')
        if not os.path.isfile(png):
            sys.exit(f'ekran topilmadi: {png}')
        card = phone(png, w, h)
        img.alpha_composite(card, (x - 60, y - 60))

    frame_img = img
    d = ImageDraw.Draw(frame_img)

    # ── CHAP USTUN ──
    d.text((PAD, 228), spaced('NFCSTORE.UZ') + '   ·   ' + spaced('YANGILIK'),
           font=font(font_dir, 'sans_mid', 15), fill=GOLD, anchor='ls')

    f_title = font(font_dir, 'serif', 76)
    y = 300
    for i, line in enumerate(spec['title']):
        d.text((PAD, y), line, font=f_title, fill=GOLD_SOFT if i == spec['accent'] else INK, anchor='ls')
        y += 86

    d.rectangle((PAD, y - 24, PAD + 72, y - 22), fill=GOLD)

    f_sub = font(font_dir, 'sans', 25)
    y += 32
    for line in spec['sub']:
        d.text((PAD, y), line, font=f_sub, fill=INK + (205,), anchor='ls')
        y += 40

    x = PAD
    for label, value, filled in spec['badges']:
        x += draw_badge(frame_img, d, (x, y + 24), label, value, filled, font_dir) + 18

    d.text((PAD, 828), spaced('NFCSTORE.UZ'),
           font=font(font_dir, 'sans_mid', 14), fill=GOLD + (150,), anchor='ls')

    out = frame_img.convert('RGB')
    frame(out)
    out.save(out_path, 'JPEG', quality=88, optimize=True, progressive=True)
    print(f'{out_path}  {out.width}x{out.height}  {os.path.getsize(out_path) // 1024} KB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default='mobile_nova/test/shots/png',
                    help='ilova ekranlari (PNG) papkasi')
    ap.add_argument('--fonts', default='mobile_nova',
                    help='shriftlar papkasi (ichida assets/fonts)')
    ap.add_argument('--out', default='public/business-assets/news',
                    help='bannerlar chiqadigan papka')
    ap.add_argument('--only', help='faqat bitta banner (nomi)')
    a = ap.parse_args()

    for key, rel in FONTS.items():
        if not os.path.isfile(os.path.join(a.fonts, rel)):
            sys.exit(f'shrift topilmadi: {os.path.join(a.fonts, rel)}')
    os.makedirs(a.out, exist_ok=True)
    for name, spec in BANNERS.items():
        if a.only and a.only != name:
            continue
        build(spec, a.shots, a.fonts, os.path.join(a.out, name + '.jpg'))


if __name__ == '__main__':
    main()
