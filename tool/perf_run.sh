#!/usr/bin/env bash
#
# Ilova tezligini emulyatorda PROFILE rejimida o'lchaydi.
# `bash ../tool/perf_run.sh` — mobile_nova ichidan.
#
# Parol va login HECH QAYERGA chop etilmaydi (`set -x` ataylab yo'q).

set -u -o pipefail

DEVICE="${E2E_DEVICE:-emulator-5554}"
adb devices
if [ -z "${NOVA_TEST_LOGIN:-}" ] || [ -z "${NOVA_TEST_PASSWORD:-}" ]; then
  echo "::error::NOVA_TEST_LOGIN / NOVA_TEST_PASSWORD bo'sh."
  exit 1
fi

flutter drive --profile \
  -d "$DEVICE" \
  --driver=test_driver/perf_driver.dart \
  --target=integration_perf/app_perf_test.dart \
  "--dart-define=NOVA_TEST_LOGIN=${NOVA_TEST_LOGIN}" \
  "--dart-define=NOVA_TEST_PASSWORD=${NOVA_TEST_PASSWORD}" \
  2>&1 | tee perf.log
status=${PIPESTATUS[0]}
echo "flutter drive: $status"
exit "$status"
