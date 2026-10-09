#!/usr/bin/env python3
"""`E2E_STEP:{json}` qatorlaridan natija fayli va jadval.

  summarize.py <platform> <test.log> <out.json>

Jadval stdout'ga (va GITHUB_STEP_SUMMARY ga) chiqadi. Chiqish kodi:
0 — hamma qadam PASS va test oxirigacha yetdi; 1 — aks holda.
"""
import json
import os
import re
import sys

STEP = re.compile(r"E2E_STEP:(\{.*\})\s*$")


def brief(v):
    """Pleer holati — qisqa: pozitsiya o'sishi, ovoz, holat."""
    if isinstance(v, dict) and "deltaMs" in v:
        parts = [f"Δ{v.get('deltaMs')}ms/{v.get('windowMs')}ms"]
        if "volume" in v:
            parts.append(f"vol={v.get('volume')}")
        if v.get("disposed"):
            parts.append("disposed")
        parts.append("PLAYING" if v.get("moving") else ("still" if v.get("still") else "?"))
        return " ".join(parts)
    if isinstance(v, dict) and v.get("player", 1) is None:
        return "pleer yo'q"
    if isinstance(v, (dict, list)):
        s = json.dumps(v, ensure_ascii=False)
        return s if len(s) < 90 else s[:87] + "..."
    return str(v)


def main():
    platform, log, out = sys.argv[1:4]
    steps, errors, done = [], [], None
    try:
        text = open(log, errors="replace").read()
    except OSError:
        text = ""
    for line in text.splitlines():
        m = STEP.search(line)
        if m:
            try:
                steps.append(json.loads(m.group(1)))
            except json.JSONDecodeError:
                steps.append({"id": "?", "name": "parse error", "status": "FAIL",
                              "problems": [line[:200]]})
        if "E2E_ERRORS:" in line:
            try:
                errors = json.loads(line.split("E2E_ERRORS:", 1)[1])
            except json.JSONDecodeError:
                pass
        if "E2E_DONE:" in line:
            done = line.split("E2E_DONE:", 1)[1].strip()
    exit_line = next((l for l in text.splitlines() if l.startswith("EXIT ")), "EXIT ?")
    res = {"platform": platform, "done": done, "exit": exit_line,
           "steps": steps, "flutterErrors": errors}
    with open(out, "w") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    md = [f"## Ko'rgazma E2E — {platform}", "",
          f"test: `{done or 'OXIRIGACHA YETMADI'}` · `{exit_line}`", "",
          "| # | Qadam | Natija | Qiymatlar | Muammo |", "|---|---|---|---|---|"]
    for s in steps:
        vals = s.get("values", {})
        keep = []
        for k, v in vals.items():
            if k in ("feed", "screenTexts"):
                continue
            keep.append(f"{k}: {brief(v)}")
        md.append("| {} | {} | {} | {} | {} |".format(
            s.get("id"), s.get("name"),
            "✅ PASS" if s.get("status") == "PASS" else "❌ " + s.get("status", "?"),
            "<br>".join(keep).replace("|", "/"),
            "<br>".join(s.get("problems", [])).replace("|", "/")))
    if errors:
        md += ["", f"FlutterError ({len(errors)}): " + "; ".join(errors[:5])]
    out_md = "\n".join(md) + "\n"
    print(out_md)
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    if summ:
        with open(summ, "a") as f:
            f.write(out_md)
    ok = done is not None and steps and all(s.get("status") == "PASS" for s in steps)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
