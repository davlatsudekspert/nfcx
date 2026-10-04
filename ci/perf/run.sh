#!/usr/bin/env bash
# Tezlik diagnostikasi — emulyator ichida, `mobile_nova` dan.
# Login/parol chop etilmaydi (`set -x` ataylab yo'q).
set -u -o pipefail
VARIANT="${1:-?}"
DEVICE="${E2E_DEVICE:-emulator-5554}"
: > diag.log

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
