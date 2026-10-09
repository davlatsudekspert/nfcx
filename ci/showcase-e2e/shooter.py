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
TMP = re.compile(r"E2E_TMP:(/\S+)")


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


def ios_tmp(a):
    """iOS: ilova konteyneri host diskida — `<data>/tmp`."""
    r = run(["xcrun", "simctl", "get_app_container", a.device, a.bundle, "data"],
            capture_output=True, text=True)
    if r and r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip() + "/tmp"
    return None


def ack(a, tmp, name):
    if not tmp and a.platform == "ios":
        tmp = ios_tmp(a)
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
    p.add_argument("--bundle", default="uz.nfcstore.nova")
    p.add_argument("--log", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--max", type=int, default=3600)
    p.add_argument("--markers", default="", help="vergul bilan: qo'shimcha log fayllar")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # Belgilar bir nechta manbadan: `flutter test` logi (oxirida to'planib
    # chiqishi mumkin) va qurilma logi (Android logcat / iOS os_log) —
    # ikkinchisi REAL VAQTDA keladi. Bir xil nom bir marta ishlanadi.
    sources = [a.log] + [m for m in (a.markers or "").split(",") if m]
    handles = {}
    bufs = {}
    tmp = None
    done = set()
    ios_dir = [None, 0.0]
    last_poll = [0.0]
    start = time.time()
    while time.time() - start < a.max:
        got = False
        for src in sources:
            if src not in handles:
                if not os.path.exists(src):
                    continue
                handles[src] = open(src, "r", errors="replace")
                bufs[src] = ""
            chunk = handles[src].read()
            if not chunk:
                continue
            got = True
            bufs[src] += chunk
            lines = bufs[src].split("\n")
            bufs[src] = lines.pop()
            for line in lines:
                m = TMP.search(line)
                if m and not tmp:
                    tmp = m.group(1).strip()
                    print(f"[shooter] tmp = {tmp} ({os.path.basename(src)})", flush=True)
                m = SHOT.search(line)
                if m and m.group(1) not in done:
                    name = m.group(1)
                    done.add(name)
                    t0 = time.time()
                    capture(a, name)
                    ack(a, tmp, name)
                    print(f"[shooter]   {name}: {os.path.basename(src)}, "
                          f"t+{t0 - start:.0f}s, {time.time() - t0:.1f}s", flush=True)
                if src == a.log and line.startswith("EXIT "):
                    print(f"[shooter] test tugadi: {line}", flush=True)
                    return 0
        # So'rov fayllari: test `<tmp>/e2e_req_<nom>` yozadi (Dart `print`
        # test zonasida ushlanadi va logga faqat OXIRIDA chiqadi — shuning
        # uchun asosiy kanal shu).
        if a.platform == "android" and time.time() - last_poll[0] > 0.5:
            last_poll[0] = time.time()
            d = tmp or f"/data/user/0/{a.pkg}/code_cache"
            r = run(["adb", "-s", a.device, "shell", "run-as", a.pkg, "ls", d],
                    capture_output=True, text=True)
            names = []
            if r and r.returncode == 0:
                names = [x.strip() for x in r.stdout.split() if x.strip().startswith("e2e_req_")]
            for fn in names:
                name = fn[len("e2e_req_"):]
                run(["adb", "-s", a.device, "shell", "run-as", a.pkg, "rm", "-f", f"{d}/{fn}"])
                if name in done:
                    continue
                done.add(name)
                t0 = time.time()
                capture(a, name)
                ack(a, d, name)
                got = True
                print(f"[shooter]   {name}: req-file, t+{t0 - start:.0f}s", flush=True)
        # iOS: konteyner papkasi host diskida.
        if a.platform == "ios":
            if not ios_dir[0] or time.time() - ios_dir[1] > 20:
                d = ios_tmp(a)
                ios_dir[1] = time.time()
                if d and d != ios_dir[0]:
                    ios_dir[0] = d
                    print(f"[shooter] ios tmp = {d}", flush=True)
            d = ios_dir[0]
            if d and os.path.isdir(d):
                for fn in sorted(os.listdir(d)):
                    if not fn.startswith("e2e_req_"):
                        continue
                    name = fn[len("e2e_req_"):]
                    try:
                        os.remove(os.path.join(d, fn))
                    except OSError:
                        pass
                    if name in done:
                        continue
                    done.add(name)
                    t0 = time.time()
                    capture(a, name)
                    ack(a, d, name)
                    got = True
                    print(f"[shooter]   {name}: req-file, t+{t0 - start:.0f}s", flush=True)
        if not got:
            time.sleep(0.25)
    return 0


if __name__ == "__main__":
    sys.exit(main())
