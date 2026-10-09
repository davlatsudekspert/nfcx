#!/usr/bin/env python3
"""Artefakt matnlaridan sinov hisobi qiymatlarini olib tashlaydi.

  redact.py <fayl>...   (NOVA_TEST_LOGIN / NOVA_TEST_PASSWORD muhitdan)

GitHub faqat ish logini maskalaydi — artefaktdagi fayllarni emas.
"""
import os
import sys

secrets = []
for k in ("NOVA_TEST_LOGIN", "NOVA_TEST_PASSWORD"):
    v = os.environ.get(k, "")
    if len(v) >= 4:
        secrets.append(v)
        if "@" in v and v.index("@") >= 4:
            secrets.append(v[: v.index("@")])

for path in sys.argv[1:]:
    try:
        data = open(path, "rb").read()
    except OSError:
        continue
    out = data
    for s in secrets:
        out = out.replace(s.encode(), b"***")
    if out != data:
        open(path, "wb").write(out)
        print(f"redact: {path}")
