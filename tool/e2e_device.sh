#!/usr/bin/env bash
#
# HAQIQIY ANDROID QURILMA (emulyator) — RELEASE APK VA LAYOUT, 3 O'LCHAM.
#
# Egasining talabi: yakuniy tekshiruv test-muhit screenshoti emas,
# haqiqiy Android release APK'da, 360x800 / 390x844 / 430x932 da.
#
# Har o'lcham uchun:
#   1. `adb shell wm size` + `wm density 480` (3x) — ekran shu dp
#      o'lchamga keltiriladi;
#   2. RELEASE APK o'rnatiladi va ishga tushiriladi — 12 soniyadan keyin
#      jarayon tirikmi, crash buferida xato bormi, ekran surati;
#   3. `integration_test/e2e_layout_test.dart` — haqiqiy `NovaApp`
#      soxta boy ma'lumot bilan (tarmoqqa chiqmaydi): asosiy ekranlar,
#      overflow, klaviatura, qurilmada chizilgan PNG'lar.
#
# RELEASE APK IMZOSI: bu ishda keystore sirlari YO'Q, shuning uchun
# Gradle release'ni debug kaliti bilan imzolaydi (`build.gradle.kts`
# dagi zaxira). Kod va optimallashtirish Play'dagi bilan bir xil —
# faqat imzo boshqa.
#
#   bash ../tool/e2e_device.sh     # mobile_nova ichidan
set -u -o pipefail

DEVICE="${E2E_DEVICE:-emulator-5554}"
PKG=uz.nfcstore.nova
PKG_DEBUG=uz.nfcstore.nova.debug
OUT=device-shots
LOG=e2e-device.log
mkdir -p "$OUT"
: > "$LOG"
rc=0

say() { echo "$*" | tee -a "$LOG"; }

# HAR adb CHAQIRUVI VAQT CHEGARALI (E2E #47, 2026-09): emulyator 360 dp
# layout paytida `device offline` bo'ldi va keyingi `adb install`
# "- waiting for device -" da 60 daqiqa kutib, butun ishni (75 daq.)
# bekor qildirdi — real hisobli E2E umuman ishlamadi. Endi osilish yo'q:
# har buyruq chegaralangan, qurilma yo'qolsa bir marta qayta ulanadi,
# bo'lmasa aniq FAIL yoziladi va keyingi bosqichga o'tiladi.
A() { timeout 60 adb -s "$DEVICE" "$@"; }
alive() { [ "$(timeout 10 adb -s "$DEVICE" get-state 2>/dev/null | tr -d '\r')" = "device" ]; }
recover() {
  alive && return 0
  say "(adb: $DEVICE offline — qayta ulanish)"
  timeout 20 adb reconnect offline >/dev/null 2>&1 || true
  timeout 90 adb -s "$DEVICE" wait-for-device >/dev/null 2>&1 || true
  alive && return 0
  # #48: 90 s yetmadi, lekin keyingi E2E to'plami o'sha emulyatorda
  # ishladi — ya'ni emulyator tirik, adb server aloqasi uzilgan.
  say "(adb server qayta ishga tushirilmoqda)"
  timeout 20 adb kill-server >/dev/null 2>&1 || true
  timeout 20 adb start-server >/dev/null 2>&1 || true
  timeout 120 adb -s "$DEVICE" wait-for-device >/dev/null 2>&1 || true
  alive
}

# Nima bo'lganini LOGGA yozadi (artefakt yuklab bo'lmasa ham ko'rinsin).
diag() {
  echo "---- DIAG ($1) ----"
  timeout 10 adb devices -l 2>&1 | sed 's/^/  /'
  pgrep -fa 'qemu-system|emulator' 2>/dev/null | cut -c1-120 | head -3 | sed 's/^/  proc: /' || echo "  proc: emulyator jarayoni YO'Q"
  free -m 2>/dev/null | sed 's/^/  host: /'
  if alive; then
    A shell uptime 2>&1 | sed 's/^/  uptime: /'
    A shell cat /proc/meminfo 2>/dev/null | grep -E 'MemTotal|MemAvailable' | sed 's/^/  dev: /'
    A logcat -d -t 400 2>/dev/null \
      | grep -iE 'lowmemorykiller|lmkd|kill|FATAL|ANR in|adbd|Out of memory|signal 9' \
      | tail -25 | cut -c1-200 | sed 's/^/  logcat: /'
  fi
  echo "---- /DIAG ----"
}

say "== Qurilma: $(A shell getprop ro.product.model) / Android $(A shell getprop ro.build.version.release)"

# Apparat klaviatura bo'lsa ham ekran klaviaturasi chiqsin — klaviatura
# qatori shunga tayanadi.
A shell settings put secure show_ime_with_hard_keyboard 1 || true

say "== Release APK qurilmoqda"
if flutter build apk --release --dart-define=NOVA_VERSION=device-e2e >> "$LOG" 2>&1; then
  say "Release APK: qurildi"
else
  say "DEVICE|build|release-apk|FAIL|qurilmadi"
  echo 1 > e2e-device-exit-code
  exit 1
fi
APK=build/app/outputs/flutter-apk/app-release.apk

# ── VAQTINCHA: EMULYATOR QULASHINI BISECT (#47-#50) ──────────────
# 360 dp da Home -> Tanlov o'tishida emulyator (SwiftShader) quladi,
# #46 (b34bbbd) da o'tgan. Har commitning `lib/` i bilan layout
# ishga tushiriladi — birinchi qulagani chegara. Aniqlangach olib
# tashlanadi.
if [ "${E2E_BISECT:-1}" = "1" ]; then
  timeout 120 git fetch -q --depth=80 origin "${GITHUB_REF_NAME:-claude/vibrant-einstein-p5lo1i}" 2>/dev/null || true
  A shell wm size 1080x2400; A shell wm density 480; sleep 3
  for ref in b34bbbd 4d0365d d1d2142 22a3f32 6632813 HEAD; do
    if ! recover; then say "BISECT|$ref|skip|emulyator yo'q"; break; fi
    git checkout -q "$ref" -- lib 2>/dev/null || { say "BISECT|$ref|skip|ref topilmadi"; continue; }
    say "BISECT|$ref|start|$(date +%T)"
    timeout --foreground -s INT -k 30s 600 \
      flutter test integration_test/e2e_layout_test.dart -d "$DEVICE" \
      --dart-define=LAYOUT_TAG="b-$ref" > "bisect-$ref.log" 2>&1 || true
    grep -E "^STEP\|" "bisect-$ref.log" | tail -n 3 | sed "s/^/  /"
    if grep -q "<<<LAYOUT_DONE b-$ref>>>" "bisect-$ref.log"; then
      say "BISECT|$ref|PASS|"
    else
      say "BISECT|$ref|CRASH|oxirgi: $(grep -E '^STEP\|' "bisect-$ref.log" | tail -n1)"
    fi
  done
  git checkout -q HEAD -- lib
  timeout 60 adb start-server >/dev/null 2>&1 || true
fi

for spec in "360 1080x2400" "390 1170x2532" "430 1290x2796"; do
  tag="${spec%% *}"
  size="${spec##* }"
  say ""
  say "════ ${tag} dp  (${size} @ 480dpi) ════"
  if ! recover; then
    diag "recover ${tag}"
    say "DEVICE|${tag}|device|FAIL|emulyator aloqasi uzildi (adb offline) — ilova xatosi emas"
    rc=1
    break
  fi
  A shell wm size "$size"
  A shell wm density 480
  sleep 3

  # ── RELEASE APK ──────────────────────────────────────────────
  timeout 180 adb -s "$DEVICE" install -r "$APK" >> "$LOG" 2>&1
  A logcat -c || true
  A shell am force-stop "$PKG" || true
  A shell am start -W -n "$PKG/.MainActivity" >> "$LOG" 2>&1
  sleep 12
  timeout 60 adb -s "$DEVICE" exec-out screencap -p > "$OUT/release-${tag}-launch.png" || true
  pid=$(A shell pidof "$PKG" | tr -d '\r')
  crashes=$(A logcat -d -b crash 2>/dev/null | grep -c "$PKG" || true)
  anr=$(A shell dumpsys activity processes 2>/dev/null | grep -c "notResponding=true" || true)
  if [ -n "$pid" ] && [ "$crashes" = "0" ] && [ "$anr" = "0" ]; then
    say "DEVICE|${tag}|release-launch|PASS|pid=${pid}"
  else
    say "DEVICE|${tag}|release-launch|FAIL|pid='${pid}' crash=${crashes} anr=${anr}"
    A logcat -d -b crash >> "$LOG" 2>&1 || true
    rc=1
  fi
  # Orqaga (fon) va qaytish — hayot sikli qotmaydimi.
  A shell input keyevent KEYCODE_HOME
  sleep 2
  A shell am start -n "$PKG/.MainActivity" >> "$LOG" 2>&1
  sleep 4
  timeout 60 adb -s "$DEVICE" exec-out screencap -p > "$OUT/release-${tag}-resume.png" || true
  if [ -n "$(A shell pidof "$PKG" | tr -d '\r')" ]; then
    say "DEVICE|${tag}|release-resume|PASS|"
  else
    say "DEVICE|${tag}|release-resume|FAIL|jarayon yo'q"
    rc=1
  fi
  A shell am force-stop "$PKG" || true

  # ── LAYOUT TO'PLAMI ─────────────────────────────────────────
  # Qurilma logi fonda HOST faylga yoziladi — emulyator qulasa ham oxirgi
  # qatorlar (Flutter/Impeller/Vulkan/F-darajali xato) qo'lda qoladi.
  A logcat -c || true
  timeout 1200 adb -s "$DEVICE" logcat -v time > "logcat-${tag}.txt" 2>/dev/null &
  LC_PID=$!
  if timeout --foreground -s INT -k 30s 900 \
      flutter test integration_test/e2e_layout_test.dart -d "$DEVICE" \
      --dart-define=LAYOUT_TAG="$tag" 2>&1 | tee "layout-${tag}.log" | tee -a "$LOG" | grep -E "LAYOUT\||<<<LAYOUT_DONE"; then
    :
  fi
  kill "$LC_PID" 2>/dev/null || true
  if ! grep -q "<<<LAYOUT_DONE $tag>>>" "$LOG"; then
    say "DEVICE|${tag}|layout|FAIL|to'plam oxirigacha yetmadi"
    rc=1
    echo "---- layout-${tag}.log: STEP izi ----"
    grep -E "^STEP\|" "layout-${tag}.log" | tail -n 20
    echo "---- logcat-${tag}.txt (oxirgi 80, muhimlari) ----"
    grep -E " [EF]/|flutter|impeller|Impeller|vulkan|Vulkan|gralloc|EGL|OpenGL|lowmemory|lmkd|Out of memory|FATAL|DEBUG  :" "logcat-${tag}.txt" \
      | tail -n 80 | cut -c1-220
    echo "---- logcat-${tag}.txt (eng oxirgi 30 qator) ----"
    tail -n 30 "logcat-${tag}.txt" | cut -c1-220
    diag "layout ${tag}"
  fi
  if grep -q "LAYOUT|${tag}|[a-z-]*|FAIL" "$LOG"; then rc=1; fi
  # Qurilmada chizilgan kadrlar.
  # `Directory.systemTemp` Android'da `cache` yoki `code_cache` bo'ladi.
  timeout 60 adb -s "$DEVICE" exec-out run-as "$PKG_DEBUG" sh -c \
    'for d in cache code_cache; do if [ -d "$d/nova_shots" ]; then cd "$d/nova_shots" && tar -cf - .; exit; fi; done' \
    | tar -xf - -C "$OUT" 2>/dev/null || say "(kadrlar tortib olinmadi: $tag)"
done

A shell wm size reset || true
A shell wm density reset || true

say ""
say "== Natija =="
grep -E "^(DEVICE|LAYOUT)\|" "$LOG" | sort -u || true
ls -la "$OUT" | tee -a "$LOG"
echo "$rc" > e2e-device-exit-code
exit "$rc"
