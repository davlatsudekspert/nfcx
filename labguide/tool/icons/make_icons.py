"""LabGuide ilova ikonkalarini yaratadi (iOS AppIcon + Android adaptive/legacy).

Ishlatish (labguide/ ichida, Pillow kerak):
    python3 tool/icons/make_icons.py <MaterialIcons-Regular.otf yo'li>

Dizayn: forest yashil fon (dizayn tokeni brand #194C40, yengil gradient),
lime (#C5E8A1) kolba belgisi — ilova ichidagi brend belgisi bilan bir xil
(Material Icons `science_outlined`). Fon shaffof emas (App Store talabi).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FOREST_TOP = (0x22, 0x5E, 0x50)
FOREST_BOTTOM = (0x14, 0x3D, 0x33)
LIME = (0xC5, 0xE8, 0xA1)
GLYPH = chr(0xF33D)  # Icons.science_outlined (material_ui icons.dart)


def background(size: int) -> Image.Image:
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(FOREST_TOP, FOREST_BOTTOM))
    return img


def draw_glyph(img: Image.Image, font_path: str, scale: float) -> Image.Image:
    size = img.width
    font = ImageFont.truetype(font_path, int(size * scale))
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = d.textbbox((0, 0), GLYPH, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), GLYPH, font=font, fill=LIME + (255,))
    out = img.convert('RGBA')
    out.alpha_composite(layer)
    return out


def master(font_path: str, size: int = 1024, scale: float = 0.62) -> Image.Image:
    return draw_glyph(background(size), font_path, scale).convert('RGB')


def main() -> None:
    font_path = sys.argv[1]
    root = Path(__file__).resolve().parents[2]
    big = master(font_path)

    # iOS
    ios = root / 'ios/Runner/Assets.xcassets/AppIcon.appiconset'
    for item in json.loads((ios / 'Contents.json').read_text())['images']:
        pts = float(item['size'].split('x')[0])
        px = round(pts * int(item['scale'].rstrip('x')))
        big.resize((px, px), Image.LANCZOS).save(ios / item['filename'], optimize=True)

    # Android legacy (48 dp) — yumaloq burchakli kvadrat
    res = root / 'android/app/src/main/res'
    for density, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        icon = big.resize((px, px), Image.LANCZOS).convert('RGBA')
        mask = Image.new('L', (px, px), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, px - 1, px - 1), radius=px * 0.22, fill=255)
        icon.putalpha(mask)
        icon.save(res / f'mipmap-{density}/ic_launcher.png', optimize=True)

    # Android adaptive (108 dp, belgi 72 dp xavfsiz zonada)
    for density, px in {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}.items():
        layer = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        font = ImageFont.truetype(font_path, int(px * 0.40))
        d = ImageDraw.Draw(layer)
        box = d.textbbox((0, 0), GLYPH, font=font)
        w, h = box[2] - box[0], box[3] - box[1]
        d.text(((px - w) / 2 - box[0], (px - h) / 2 - box[1]), GLYPH, font=font, fill=LIME + (255,))
        layer.save(res / f'mipmap-{density}/ic_launcher_foreground.png', optimize=True)
    (res / 'mipmap-anydpi-v26').mkdir(exist_ok=True)
    (res / 'mipmap-anydpi-v26/ic_launcher.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n')
    (res / 'values/ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#194C40</color>\n</resources>\n')
    big.save(root / 'tool/icons/icon_1024.png', optimize=True)
    print('ok')


if __name__ == '__main__':
    main()
