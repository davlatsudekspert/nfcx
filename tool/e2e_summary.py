#!/usr/bin/env python3
"""E2E loglaridan PASS/FAIL matritsasini yasaydi.

Sinov ishlagan sari `report.dart` har bir qatorni chop etadi va
oxirida butun matritsani `<<<E2E_MATRIX_JSON>>>` bloki ichida beradi.
Bu skript o'sha bloklarni topib, GitHub uchun Markdown jadvalga
aylantiradi.

Nima uchun alohida skript: workflow ichidagi uzun `python3 -c "..."`
ni na o'qib, na tuzatib bo'ladi, na unga test yozib bo'ladi.

Ishlatish:
    e2e_summary.py e2e-backend.log e2e-ui.log
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

START = "<<<E2E_MATRIX_JSON>>>"
END = "<<<END_E2E_MATRIX_JSON>>>"

# Jadvalda shu tartibda chiqadi — og'irlaridan boshlab.
ORDER = [
    "FAIL",
    "PARTIAL",
    "BACKEND REQUIRED",
    "CONFIG REQUIRED",
    "DEVICE REQUIRED",
    "MANUAL PAYMENT TEST REQUIRED",
    "SKIPPED",
    "PASS",
]

ICON = {
    "PASS": "✅",
    "FAIL": "❌",
    "PARTIAL": "⚠️",
    "BACKEND REQUIRED": "🛠",
    "CONFIG REQUIRED": "🔑",
    "DEVICE REQUIRED": "📱",
    "MANUAL PAYMENT TEST REQUIRED": "💳",
    "SKIPPED": "⏭",
}


def blocks(text: str) -> list[dict]:
    """Logdagi har bir JSON blokni ajratib oladi."""
    out = []
    for raw in re.findall(
        re.escape(START) + r"(.*?)" + re.escape(END), text, re.S
    ):
        try:
            out.append(json.loads(raw))
        except json.JSONDecodeError as e:
            print(f"<!-- blok o'qilmadi: {e} -->")
    return out


def cell(v: object) -> str:
    """Jadval katagi — quvur belgisi jadvalni buzmasin."""
    s = "" if v is None else str(v)
    return s.replace("|", "\\|").replace("\n", " ").strip()


def main(paths: list[str]) -> int:
    rows: list[dict] = []
    cleanup: list[str] = []
    found_any = False

    for p in paths:
        f = pathlib.Path(p)
        if not f.exists():
            print(f"> `{p}` topilmadi — bu to'plam umuman ishlamagan.\n")
            continue
        for b in blocks(f.read_text(encoding="utf-8", errors="replace")):
            found_any = True
            rows.extend(b.get("rows", []))
            cleanup.extend(b.get("cleanupProblems", []))

    if not found_any:
        print("## E2E natijasi\n")
        print("**Matritsa chiqmadi.** Sinov hisobot yozishdan oldin "
              "to'xtagan — loglarga qarang (artefakt: `nova-e2e-logs`).\n")
        return 1

    # Bir nom ikki marta yozilgan bo'lsa, og'irrog'i qoladi: PASS
    # keyingi FAIL ni yashirib qo'ymasin.
    weight = {v: i for i, v in enumerate(ORDER)}
    best: dict[str, dict] = {}
    for r in rows:
        k = r.get("name", "?")
        if k not in best or weight.get(
            r.get("verdict", "SKIPPED"), 99
        ) < weight.get(best[k].get("verdict", "SKIPPED"), 99):
            best[k] = r
    merged = list(best.values())

    tally: dict[str, int] = {}
    for r in merged:
        v = r.get("verdict", "SKIPPED")
        tally[v] = tally.get(v, 0) + 1

    print("## NFCSTORE Nova — haqiqiy hisob E2E\n")
    print("| Natija | Soni |")
    print("|---|---|")
    for v in ORDER:
        if tally.get(v):
            print(f"| {ICON[v]} {v} | {tally[v]} |")
    print()

    print("### Matritsa\n")
    print("| Qator | Natija | Ekran | Amal | Izoh |")
    print("|---|---|---|---|---|")
    merged.sort(key=lambda r: (weight.get(r.get("verdict", ""), 99),
                               r.get("name", "")))
    for r in merged:
        v = r.get("verdict", "?")
        note = r.get("note") or r.get("cause") or ""
        print(
            f"| {cell(r.get('name'))} | {ICON.get(v, '')} {v} "
            f"| {cell(r.get('screen'))} | {cell(r.get('action'))} "
            f"| {cell(note)} |"
        )
    print()

    # ── FAIL va PARTIAL uchun to'liq tafsilot ──────────────────
    detailed = [r for r in merged
                if r.get("verdict") in ("FAIL", "PARTIAL")]
    if detailed:
        print("### FAIL / PARTIAL — sabab va endpoint\n")
        for r in detailed:
            print(f"#### {ICON.get(r.get('verdict'), '')} "
                  f"{r.get('name')} — {r.get('verdict')}\n")
            print(f"* **Ekran:** {r.get('screen') or '—'}")
            print(f"* **Amal:** {r.get('action') or '—'}")
            t = r.get("trace") or {}
            if t:
                print(f"* **Endpoint:** `{t.get('method', '?')} "
                      f"{t.get('path', '?')}`")
                print(f"* **HTTP status:** {t.get('status', '—')}")
                if t.get("request"):
                    print(f"* **So'rov:** `{cell(t['request'])}`")
                if t.get("response"):
                    print(f"* **Javob:** `{cell(t['response'])}`")
            print(f"* **Sabab:** {r.get('cause') or '—'}")
            print(f"* **Qatlam:** {r.get('layer') or '—'}")
            if r.get("fix"):
                print(f"* **Tuzatish:** {r['fix']}")
            if r.get("retest"):
                print(f"* **Qayta sinov:** {r['retest']}")
            print()

    # ── Tozalash ──────────────────────────────────────────────
    print("### Sinov obyektlarini tozalash\n")
    if cleanup:
        print("**DIQQAT — quyidagilar o'chmay qoldi, qo'lda o'chiring:**\n")
        for c in cleanup:
            print(f"* {c}")
    else:
        print("Yaratilgan barcha sinov obyektlari o'chirildi "
              "(post, istorya, izoh, katalog elementi).")
    print()

    fails = tally.get("FAIL", 0)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
