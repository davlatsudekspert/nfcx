#!/usr/bin/env bash
# Ko'rgazma E2E — bitta qurilmada (mobile_nova ichidan chaqiriladi).
#
#   bash ../self/ci/showcase-e2e/run.sh android emulator-5554
#   bash ../self/ci/showcase-e2e/run.sh ios <udid>
#
# Sinov hisobi muhitdan (NOVA_TEST_LOGIN / NOVA_TEST_PASSWORD) — hech
# qayerga chop etilmaydi (`set -x` yo'q).
set -u -o pipefail

PLATFORM="$1"
DEVICE="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$PWD/showcase-e2e/screens"
LOG="$PWD/showcase-e2e/test.log"
mkdir -p "$OUT"
rm -f "$LOG"

if [ -z "${NOVA_TEST_LOGIN:-}" ] || [ -z "${NOVA_TEST_PASSWORD:-}" ]; then
  echo "::error::Sinov hisobi siri yo'q (NFC_LOGIN_EMAIL / NFC_LOGIN_PASSWORD)."
  exit 1
fi
DEFINES=(
  "--dart-define=NOVA_TEST_LOGIN=${NOVA_TEST_LOGIN}"
  "--dart-define=NOVA_TEST_PASSWORD=${NOVA_TEST_PASSWORD}"
)

if [ "$PLATFORM" = android ]; then
  adb devices
  echo "== Audio: $(adb -s "$DEVICE" shell getprop ro.hardware.audio.primary 2>/dev/null) / $(adb -s "$DEVICE" shell dumpsys audio 2>/dev/null | grep -m1 -i 'Stream volumes' )"
  # Musiqa ovozi eshitiladigan darajada (emulyatorda 0 bo'lmasin).
  adb -s "$DEVICE" shell cmd media_session volume --stream 3 --set 10 >/dev/null 2>&1 || true
  # Ilova logi (ExoPlayer / AudioTrack / WebView) — tashxis uchun.
  adb -s "$DEVICE" logcat -c || true
  adb -s "$DEVICE" logcat -v time > "$PWD/showcase-e2e/logcat-all.txt" 2>/dev/null &
  LC=$!
fi

python3 "$HERE/shooter.py" --platform "$PLATFORM" --device "$DEVICE" \
  --log "$LOG" --out "$OUT" --max 3300 > "$PWD/showcase-e2e/shooter.log" 2>&1 &
SH=$!

echo "== flutter test ($PLATFORM / $DEVICE)"
timeout --foreground -s INT -k 30s 2700 \
  flutter test integration_test/showcase_user_test.dart -d "$DEVICE" "${DEFINES[@]}" \
  > "$LOG" 2>&1
code=$?
echo "EXIT $code" >> "$LOG"

# Shooter oxirgi belgini ishlab bo'lsin.
for _ in $(seq 1 60); do kill -0 "$SH" 2>/dev/null || break; sleep 1; done
kill "$SH" 2>/dev/null || true

if [ "$PLATFORM" = android ]; then
  kill "$LC" 2>/dev/null || true
  grep -E "flutter|ExoPlayer|AudioTrack|AudioFlinger|MediaCodec|chromium|cr_|WebView|audio|Audio" \
    "$PWD/showcase-e2e/logcat-all.txt" | grep -v "E2E_STEP" | tail -n 4000 > "$PWD/showcase-e2e/logcat.txt" || true
  rm -f "$PWD/showcase-e2e/logcat-all.txt"
  adb -s "$DEVICE" shell dumpsys audio > "$PWD/showcase-e2e/dumpsys-audio.txt" 2>/dev/null || true
fi

cat "$PWD/showcase-e2e/shooter.log" || true
grep -E "\[SHOWCASE\]|E2E_SHOT|E2E_DONE|EXIT " "$LOG" | cut -c1-400 || true
tail -n 40 "$LOG" | cut -c1-400
exit 0
