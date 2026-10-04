#!/usr/bin/env bash
# Tezlik diagnostikasi — emulyator ichida, `mobile_nova` dan.
# Login/parol chop etilmaydi (`set -x` ataylab yo'q).
set -u -o pipefail
VARIANT="${1:-?}"
DEVICE="${E2E_DEVICE:-emulator-5554}"
: > diag.log

# 1) Jarayon -> birinchi kadr (haqiqiy ilova, profile APK, 5 marta).
adb -s "$DEVICE" install -r ../perf-apk/app.apk >/dev/null
adb -s "$DEVICE" shell am start -S -W -n uz.nfcstore.nova/.MainActivity >/dev/null 2>&1
sleep 4
for i in 1 2 3 4 5; do
  out=$(adb -s "$DEVICE" shell am start -S -W -n uz.nfcstore.nova/.MainActivity 2>&1 | tr -d '\r')
  echo "[NATIVE][$VARIANT] process_start_to_first_frame run=$i $(echo "$out" | grep -E 'Status|LaunchState|TotalTime|WaitTime' | tr '\n' ' ')" | tee -a diag.log
  sleep 3
done
adb -s "$DEVICE" shell am force-stop uz.nfcstore.nova

# 2) Startup/tab bosqichlari (integration, profile rejimi).
# Oldindan qurilgan APK (login/parol uning ichida — APK yuklanmaydi).
flutter drive --profile -d "$DEVICE" \
  --use-application-binary=../perf-apk/diag.apk \
  --driver=test_driver/perf_driver.dart \
  --target=integration_perf/diag/diag_test.dart \
  2>&1 | tee -a diag.log
status=${PIPESTATUS[0]}
echo "flutter drive: $status"
exit "$status"
