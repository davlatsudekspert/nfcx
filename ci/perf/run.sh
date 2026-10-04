#!/usr/bin/env bash
# Tezlik diagnostikasi — emulyator ichida, `mobile_nova` dan.
# Login/parol chop etilmaydi (`set -x` ataylab yo'q).
set -u -o pipefail
VARIANT="${1:-?}"
DEVICE="${E2E_DEVICE:-emulator-5554}"
: > diag.log

# 2) Startup/tab bosqichlari (integration, profile rejimi).
# Oldindan qurilgan APK (login/parol uning ichida — APK yuklanmaydi).
# `flutter drive` ba'zan ulanishda yiqiladi ("GetHealth ... Collected") —
# o'lchov boshlanmagan bo'lsa bir marta qayta.
for attempt in 1 2; do
  flutter drive --profile -d "$DEVICE" \
    --use-application-binary=../perf-apk/diag.apk \
    --driver=test_driver/perf_driver.dart \
    --target=integration_perf/diag/diag_test.dart \
    2>&1 | tee -a diag.log
  status=${PIPESTATUS[0]}
  echo "flutter drive ($attempt): $status"
  [ "$status" = 0 ] && break
  grep -q "tab_profile_to_home" diag.log && break
  sleep 20
done
exit "$status"
