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

say "== Qurilma: $(adb -s "$DEVICE" shell getprop ro.product.model) / Android $(adb -s "$DEVICE" shell getprop ro.build.version.release)"

# Apparat klaviatura bo'lsa ham ekran klaviaturasi chiqsin — klaviatura
# qatori shunga tayanadi.
adb -s "$DEVICE" shell settings put secure show_ime_with_hard_keyboard 1 || true

say "== Release APK qurilmoqda"
if flutter build apk --release --dart-define=NOVA_VERSION=device-e2e >> "$LOG" 2>&1; then
  say "Release APK: qurildi"
else
  say "DEVICE|build|release-apk|FAIL|qurilmadi"
  echo 1 > e2e-device-exit-code
  exit 1
fi
APK=build/app/outputs/flutter-apk/app-release.apk

for spec in "360 1080x2400" "390 1170x2532" "430 1290x2796"; do
  tag="${spec%% *}"
  size="${spec##* }"
  say ""
  say "════ ${tag} dp  (${size} @ 480dpi) ════"
  adb -s "$DEVICE" shell wm size "$size"
  adb -s "$DEVICE" shell wm density 480
  sleep 3

  # ── RELEASE APK ──────────────────────────────────────────────
  adb -s "$DEVICE" install -r "$APK" >> "$LOG" 2>&1
  adb -s "$DEVICE" logcat -c || true
  adb -s "$DEVICE" shell am force-stop "$PKG" || true
  adb -s "$DEVICE" shell am start -W -n "$PKG/.MainActivity" >> "$LOG" 2>&1
  sleep 12
  adb -s "$DEVICE" exec-out screencap -p > "$OUT/release-${tag}-launch.png" || true
  pid=$(adb -s "$DEVICE" shell pidof "$PKG" | tr -d '\r')
  crashes=$(adb -s "$DEVICE" logcat -d -b crash 2>/dev/null | grep -c "$PKG" || true)
  anr=$(adb -s "$DEVICE" shell dumpsys activity processes 2>/dev/null | grep -c "notResponding=true" || true)
  if [ -n "$pid" ] && [ "$crashes" = "0" ] && [ "$anr" = "0" ]; then
    say "DEVICE|${tag}|release-launch|PASS|pid=${pid}"
  else
    say "DEVICE|${tag}|release-launch|FAIL|pid='${pid}' crash=${crashes} anr=${anr}"
    adb -s "$DEVICE" logcat -d -b crash >> "$LOG" 2>&1 || true
    rc=1
  fi
  # Orqaga (fon) va qaytish — hayot sikli qotmaydimi.
  adb -s "$DEVICE" shell input keyevent KEYCODE_HOME
  sleep 2
  adb -s "$DEVICE" shell am start -n "$PKG/.MainActivity" >> "$LOG" 2>&1
  sleep 4
  adb -s "$DEVICE" exec-out screencap -p > "$OUT/release-${tag}-resume.png" || true
  if [ -n "$(adb -s "$DEVICE" shell pidof "$PKG" | tr -d '\r')" ]; then
    say "DEVICE|${tag}|release-resume|PASS|"
  else
    say "DEVICE|${tag}|release-resume|FAIL|jarayon yo'q"
    rc=1
  fi
  adb -s "$DEVICE" shell am force-stop "$PKG" || true

  # ── LAYOUT TO'PLAMI ─────────────────────────────────────────
  if flutter test integration_test/e2e_layout_test.dart -d "$DEVICE" \
      --dart-define=LAYOUT_TAG="$tag" 2>&1 | tee -a "$LOG" | grep -E "LAYOUT\||<<<LAYOUT_DONE"; then
    :
  fi
  if ! grep -q "<<<LAYOUT_DONE $tag>>>" "$LOG"; then
    say "DEVICE|${tag}|layout|FAIL|to'plam oxirigacha yetmadi"
    rc=1
  fi
  if grep -q "LAYOUT|${tag}|[a-z-]*|FAIL" "$LOG"; then rc=1; fi
  # Qurilmada chizilgan kadrlar.
  # `Directory.systemTemp` Android'da `cache` yoki `code_cache` bo'ladi.
  adb -s "$DEVICE" exec-out run-as "$PKG_DEBUG" sh -c \
    'for d in cache code_cache; do if [ -d "$d/nova_shots" ]; then cd "$d/nova_shots" && tar -cf - .; exit; fi; done' \
    | tar -xf - -C "$OUT" 2>/dev/null || say "(kadrlar tortib olinmadi: $tag)"
done

adb -s "$DEVICE" shell wm size reset || true
adb -s "$DEVICE" shell wm density reset || true

say ""
say "== Natija =="
grep -E "^(DEVICE|LAYOUT)\|" "$LOG" | sort -u || true
ls -la "$OUT" | tee -a "$LOG"
echo "$rc" > e2e-device-exit-code
exit "$rc"
