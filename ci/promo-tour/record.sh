#!/usr/bin/env bash
# Reklama sayohati — iPhone simulyatorida ilovani ishlatib, ekranni yozadi.
#   bash ../self/ci/promo-tour/record.sh <udid>   (mobile_nova ichidan)
# Sinov hisobi muhitdan; hech qayerga chop etilmaydi. Video KIRISHDAN
# KEYIN boshlanadi — login ekrani yozuvga tushmaydi.
set -u -o pipefail
UDID="$1"; BUNDLE=uz.nfcstore.nova
OUT="$PWD/promo-tour"; LOG="$OUT/test.log"; mkdir -p "$OUT"; : > "$LOG"
if [ -z "${NOVA_TEST_LOGIN:-}" ] || [ -z "${NOVA_TEST_PASSWORD:-}" ]; then
  echo "::error::Sinov hisobi siri yo'q"; exit 1; fi
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 >/dev/null 2>&1 || true

(
  REC=""
  for _ in $(seq 1 1800); do
    D=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2>/dev/null || true)
    if [ -n "$D" ] && [ -z "$REC" ] && [ -f "$D/tmp/promo_rec_req" ]; then
      xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$OUT/tour.mov" > "$OUT/rec.log" 2>&1 &
      REC=$!
      sleep 1.2
      touch "$D/tmp/promo_rec_ack"
      echo "[rec] boshlandi $(date +%s.%N)"
    fi
    if [ -n "$REC" ] && [ -n "$D" ] && [ -f "$D/tmp/promo_rec_stop" ]; then
      sleep 0.5; kill -INT "$REC"; wait "$REC" 2>/dev/null; echo "[rec] tugadi"; break
    fi
    sleep 0.2
  done
  [ -n "$REC" ] && kill -INT "$REC" 2>/dev/null || true
) > "$OUT/recorder.log" 2>&1 &
RP=$!

flutter test integration_test/promo_tour_test.dart -d "$UDID" \
  "--dart-define=NOVA_TEST_LOGIN=${NOVA_TEST_LOGIN}" \
  "--dart-define=NOVA_TEST_PASSWORD=${NOVA_TEST_PASSWORD}" >> "$LOG" 2>&1
echo "EXIT $?" >> "$LOG"
for _ in $(seq 1 30); do kill -0 "$RP" 2>/dev/null || break; sleep 1; done
kill "$RP" 2>/dev/null || true
grep -E "PROMO_" "$LOG" > "$OUT/marks.txt" || true
cat "$OUT/recorder.log" "$OUT/marks.txt"; ls -la "$OUT"
tail -n 30 "$LOG" | cut -c1-300
