#!/usr/bin/env python3
"""Tarjima jadvallarini Dart fayllariga yig'adi.

    python3 tool/l10n_build.py

Manba — `tool/l10n.json`: {o'zbekcha: [ruscha, inglizcha]}.
Kalit sifatida o'zbekcha matnning O'ZI ishlatiladi, shuning uchun
tarjima topilmasa `tr()` o'zbekchani qaytaradi va ilova buzilmaydi.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'tool', 'l10n.json'), encoding='utf-8'))

HEADER = """// AVTOMATIK YIG'ILGAN FAYL — QO'LDA TAHRIRLAMANG.
//
// Kalit — O'ZBEKCHA MATNNING O'ZI. Tarjima topilmasa `tr()`
// o'zbekcha matnni qaytaradi, ya'ni unutilgan satr ekranda kalit
// (`save_button`) bo'lib chiqmaydi — eng yomon holatda o'zbekcha
// qoladi va ilova ishlayveradi.
//
// Yangilash:  python3 tool/l10n_build.py
"""


def dart_map(name, idx, comment):
    out = [HEADER, '', '/// %s' % comment, 'const %s = <String, String>{' % name]
    for k in sorted(T):
        v = T[k][idx]
        out.append("  '%s': '%s'," % (k.replace("'", "\\'"), v.replace("'", "\\'")))
    out.append('};')
    return '\n'.join(out) + '\n'


for path, idx, comment in [
    ('lib/l10n/ru.dart', 0, 'Ruscha tarjimalar.'),
    ('lib/l10n/en.dart', 1, 'Inglizcha tarjimalar.'),
]:
    open(os.path.join(ROOT, path), 'w', encoding='utf-8').write(
        dart_map('ruStrings' if idx == 0 else 'enStrings', idx, comment))

print('yozildi: %d satr x 2 til' % len(T))
