#!/usr/bin/env bash
#
# VAQTINCHA — EMULYATOR QULASHI SABABINI AJRATISH (E2E #47-#51).
#
# 360 dp layout to'plamida Home -> Tanlov o'tishida emulyator (qemu)
# jarayoni yo'qoladi. #51 bisect: b34bbbd PASS, 4d0365d CRASH — lekin
# ikkalasi BITTA emulyatorda ketma-ket yurdi (tartib ta'siri bor).
# Bu skript har variantni ALOHIDA, yangi emulyatorda yurgizadi va host
# xotirasini (qemu, Gradle/Kotlin JVM, dart) 3 soniyada bir yozadi —
# qulash xotira (OOM) danmi yoki koddanmi, dmesg bilan isbotlanadi.
#
#   PROBE_REF=4d0365d PROBE_MODE=full bash ../tool/crash_probe.sh
#
# PROBE_MODE:
#   full         release build + release ishga tushirish + layout 3 o'lcham
#                (tool/e2e_device.sh ketma-ketligi)
#   layout       faqat layout 3 o'lcham (release build YO'Q)
#   stopdaemons  full, lekin har build'dan keyin Gradle/Kotlin daemonlari
#                to'xtatiladi
set -u -o pipefail

REF="${PROBE_REF:-HEAD}"
MODE="${PROBE_MODE:-full}"
DEVICE=emulator-5554
PKG=uz.nfcstore.nova
say() { echo "PROBE|$REF|$MODE|$*"; }
touch .probe-start

mon() {
  while :; do
    q=$(pgrep -f 'qemu-system' | head -1)
    r=0
    [ -n "$q" ] && r=$(awk '/VmRSS/{print int($2/1024)}' "/proc/$q/status" 2>/dev/null)
    j=$(ps -C java -o rss= 2>/dev/null | awk '{s+=$1} END{print int(s/1024)}')
    d=$(ps -C dart,dartaotruntime -o rss= 2>/dev/null | awk '{s+=$1} END{print int(s/1024)}')
    echo "$(date +%T) $(free -m | awk '/Mem:/{printf "used=%s avail=%s", $3, $7} /Swap:/{printf " swap=%s", $3}') qemu=${q:-YOQ} qemuMB=${r:-0} javaMB=${j:-0} dartMB=${d:-0}"
    sleep 3
  done
}
mon > mon.log 2>&1 &
MON=$!

alive() { [ "$(timeout 10 adb -s "$DEVICE" get-state 2>/dev/null | tr -d '\r')" = "device" ]; }
stopd() {
  [ "$MODE" = stopdaemons ] || return 0
  (cd android && timeout 90 ./gradlew --stop >/dev/null 2>&1) || true
  pkill -f KotlinCompileDaemon 2>/dev/null || true
  say "daemons-stopped|$(free -m | awk '/Mem:/{print "avail=" $7}')"
}

if [ "$REF" != "HEAD" ]; then
  git checkout -q "$REF" -- lib || { say "ref-topilmadi"; exit 1; }
fi
say "lib=$(git rev-parse --short HEAD) ref=$REF"

if [ "$MODE" != "layout" ]; then
  if timeout 1500 flutter build apk --release --dart-define=NOVA_VERSION=probe > build.log 2>&1; then
    say "release-build|OK"
  else
    say "release-build|FAIL"; tail -20 build.log
  fi
  stopd
  timeout 1200 adb -s "$DEVICE" install -r build/app/outputs/flutter-apk/app-release.apk > /dev/null 2>&1
  timeout 60 adb -s "$DEVICE" shell wm size 1080x2400
  timeout 60 adb -s "$DEVICE" shell wm density 480
  timeout 60 adb -s "$DEVICE" shell am start -W -n "$PKG/.MainActivity" > /dev/null 2>&1
  sleep 12
  say "release-launch|pid=$(timeout 20 adb -s "$DEVICE" shell pidof "$PKG" | tr -d '\r')"
  timeout 60 adb -s "$DEVICE" shell input keyevent KEYCODE_HOME
  sleep 2
  timeout 60 adb -s "$DEVICE" shell am start -n "$PKG/.MainActivity" > /dev/null 2>&1
  sleep 4
  timeout 60 adb -s "$DEVICE" shell am force-stop "$PKG" || true
fi

for spec in "360 1080x2400" "390 1170x2532" "430 1290x2796"; do
  tag="${spec%% *}"
  size="${spec##* }"
  if ! alive; then say "$tag|DEAD-BEFORE|emulyator yo'q"; break; fi
  timeout 60 adb -s "$DEVICE" shell wm size "$size"
  timeout 60 adb -s "$DEVICE" shell wm density 480
  sleep 3
  timeout --foreground -s INT -k 30s 900 \
    flutter test integration_test/e2e_layout_test.dart -d "$DEVICE" \
    --dart-define=LAYOUT_TAG="p$tag" > "probe-$tag.log" 2>&1 || true
  grep -E "^LAYOUT\|" "probe-$tag.log" | sed 's/^/  /'
  if grep -q "<<<LAYOUT_DONE p$tag>>>" "probe-$tag.log"; then
    say "$tag|PASS|"
  else
    say "$tag|CRASH|$(grep -E '^STEP\|' "probe-$tag.log" | tail -n1)"
    tail -n 15 "probe-$tag.log" | cut -c1-200 | sed 's/^/  out: /'
    sleep 5
  fi
  stopd
done

kill "$MON" 2>/dev/null || true
echo "---- XOTIRA: eng kam avail ----"
grep -o 'avail=[0-9]*' mon.log | sort -t= -k2 -n | head -1
echo "---- XOTIRA: qemu eng katta ----"
grep -o 'qemuMB=[0-9]*' mon.log | sort -t= -k2 -n | tail -1
echo "---- XOTIRA: oxirgi 40 o'lchov ----"
tail -n 40 mon.log
echo "---- dmesg (OOM / segfault) ----"
sudo dmesg -T 2>/dev/null | grep -iE 'out of memory|killed process|oom-kill|oom_reaper|segfault|qemu|traps:' | tail -n 25
echo "---- emulyator crash fayllari ----"
find /tmp/android-runner -type f -newer .probe-start 2>/dev/null | head -20
git checkout -q HEAD -- lib
exit 0
