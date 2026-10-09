#!/usr/bin/env python3
"""Qurilma ekranini test belgisi bo'yicha suratga oladi.

Test `E2E_TMP:<papka>` va `E2E_SHOT:<nom>` qatorlarini chiqaradi
(`flutter test` logiga tushadi). Bu skript logni kuzatadi va har
belgida:
  * Android: `adb exec-out screencap -p` (WebView ham ko'rinadi);
  * iOS:     `xcrun simctl io <udid> screenshot`;
so'ng ilova papkasiga `e2e_ack_<nom>` faylini yozadi — test shuni
kutib, keyingi qadamga o'tadi.

Log oxirida `EXIT <kod>` qatori paydo bo'lsa yoki [--max] soniya
o'tsa — tugaydi.
"""
import argparse
import os
import re
import subprocess
import sys
import time

SHOT = re.compile(r"E2E_SHOT:([A-Za-z0-9_]+)")
TMP = re.compile(r"E2E_TMP:(\S+)")


def run(cmd, **kw):
    try:
        return subprocess.run(cmd, timeout=60, **kw)
    except Exception as e:  # noqa: BLE001
        print(f"[shooter] {cmd[0]} xato: {e}", flush=True)
        return None


def capture(a, name):
    path = os.path.join(a.out, f"{name}.png")
    if a.platform == "android":
        with open(path, "wb") as f:
            run(["adb", "-s", a.device, "exec-out", "screencap", "-p"], stdout=f)
    else:
        run(["xcrun", "simctl", "io", a.device, "screenshot", path],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = os.path.exists(path) and os.path.getsize(path) > 1000
    print(f"[shooter] {name}.png {'OK' if ok else 'XATO'} "
          f"({os.path.getsize(path) if os.path.exists(path) else 0} B)", flush=True)


def ack(a, tmp, name):
    if not tmp:
        print("[shooter] E2E_TMP hali kelmagan — ack yozilmadi", flush=True)
        return
    target = f"{tmp}/e2e_ack_{name}"
    if a.platform == "android":
        run(["adb", "-s", a.device, "shell", "run-as", a.pkg, "touch", target])
    else:
        try:
            open(target, "w").close()
        except OSError as e:
            print(f"[shooter] ack xato: {e}", flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--platform", choices=["android", "ios"], required=True)
    p.add_argument("--device", required=True)
    p.add_argument("--pkg", default="uz.nfcstore.nova.debug")
    p.add_argument("--log", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--max", type=int, default=3600)
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    start = time.time()
    while not os.path.exists(a.log):
        if time.time() - start > a.max:
            return 0
        time.sleep(0.5)

    tmp = None
    done = set()
    buf = ""
    with open(a.log, "r", errors="replace") as f:
        while time.time() - start < a.max:
            chunk = f.read()
            if not chunk:
                time.sleep(0.3)
                continue
            buf += chunk
            lines = buf.split("\n")
            buf = lines.pop()
            for line in lines:
                m = TMP.search(line)
                if m:
                    tmp = m.group(1).strip()
                    print(f"[shooter] tmp = {tmp}", flush=True)
                m = SHOT.search(line)
                if m and m.group(1) not in done:
                    name = m.group(1)
                    done.add(name)
                    capture(a, name)
                    ack(a, tmp, name)
                if line.startswith("EXIT "):
                    print(f"[shooter] test tugadi: {line}", flush=True)
                    return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
