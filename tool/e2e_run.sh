#!/usr/bin/env bash
#
# Haqiqiy hisob E2E sini emulyatorda yuritadi.
#
# ## NIMA UCHUN ALOHIDA FAYL
#
# `reactivecircus/android-emulator-runner` ning `script:` bloki
# `/usr/bin/sh` (dash) bilan bajariladi, `bash` bilan emas. Birinchi
# urinishda skript aynan shu sababdan birinchi qatoridayoq yiqilgan
# edi:
#
#     /usr/bin/sh -c set -o pipefail
#     /usr/bin/sh: 1: set: Illegal option -o pipefail
#     The process '/usr/bin/sh' failed with exit code 2
#
# Emulyator ko'tarilgan edi ("Boot completed in 5385 ms"), lekin
# birorta `flutter test` ishga tushmagan va loglar ham yaratilmagan.
#
# Skriptni faylga chiqarish buni butunlay hal qiladi: shebang `bash`
# ni talab qiladi, workflow esa uni `bash tool/e2e_run.sh` deb
# chaqiradi. Yon foydasi — skriptni mahalliy sinash mumkin.
#
# ## ISHLATISH
#
#   bash tool/e2e_run.sh            # mobile_nova ichidan
#
# Muhit o'zgaruvchilari: NOVA_TEST_LOGIN, NOVA_TEST_PASSWORD va
# ixtiyoriy NOVA_TEST_LOGIN_2 / NOVA_TEST_PASSWORD_2.
#
# ## MAXFIYLIK
#
# Bu skript parol yoki loginni HECH QAYERGA chop etmaydi. `set -x`
# ataylab YO'Q: u `--dart-define` qiymatlarini butun log bo'ylab
# yoyib yuborardi.

set -u -o pipefail

DEVICE="${E2E_DEVICE:-emulator-5554}"

echo "== Qurilma =="
adb devices

# `flutter test` qurilmani ko'rishi uchun u `device` ro'yxatida
# bo'lishi shart. Ko'rinmasa, sabab keyingi xato matnidan ko'ra
# aniqroq bo'lsin.
if ! adb devices | grep -q "^${DEVICE}"; then
  echo "::error::Emulyator ($DEVICE) adb ro'yxatida yo'q."
  exit 1
fi

# ── Maxfiy qiymatlar: BOR-YO'QLIGI tekshiriladi, o'zi emas ──────
#
# Uzunlik ham chop etilmaydi — bu parol haqidagi ma'lumot.
if [ -z "${NOVA_TEST_LOGIN:-}" ] || [ -z "${NOVA_TEST_PASSWORD:-}" ]; then
  echo "::error::NOVA_TEST_LOGIN / NOVA_TEST_PASSWORD bo'sh."
  exit 1
fi
echo "Sinov hisobi: berildi."
if [ -n "${NOVA_TEST_LOGIN_2:-}" ]; then
  echo "Ikkinchi hisob: berildi (follow/block qatorlari sinaladi)."
else
  echo "Ikkinchi hisob: berilmagan (follow/block CONFIG REQUIRED bo'ladi)."
fi

# Massiv sifatida: qiymatda bo'shliq yoki maxsus belgi bo'lsa ham
# to'g'ri uzatiladi. Bitta satr bo'lganda so'z bo'linishi buzardi.
DEFINES=(
  "--dart-define=NOVA_TEST_LOGIN=${NOVA_TEST_LOGIN}"
  "--dart-define=NOVA_TEST_PASSWORD=${NOVA_TEST_PASSWORD}"
  "--dart-define=NOVA_TEST_LOGIN_2=${NOVA_TEST_LOGIN_2:-}"
  "--dart-define=NOVA_TEST_PASSWORD_2=${NOVA_TEST_PASSWORD_2:-}"
)

rc=0

run_suite() {
  local file="$1" log="$2" title="$3"
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  $title"
  echo "════════════════════════════════════════════════════"
  # `tee` ga `pipefail` kerak, aks holda `flutter test` yiqilsa ham
  # quvurning chiqish kodi `tee` niki bo'lib, 0 bo'lib qolardi —
  # ya'ni qizil sinov yashil ko'rinardi.
  if flutter test "$file" -d "$DEVICE" "${DEFINES[@]}" 2>&1 | tee "$log"; then
    echo "[$title] tugadi: o'tdi"
  else
    echo "[$title] tugadi: YIQILDI"
    rc=1
  fi
}

run_suite integration_test/e2e_backend_test.dart e2e-backend.log \
  "BACKEND — kontrakt va saqlanish"

run_suite integration_test/e2e_ui_test.dart e2e-ui.log \
  "UI — haqiqiy ekranlar"

echo "$rc" > e2e-exit-code

echo ""
echo "== Yaratilgan loglar =="
ls -la e2e-backend.log e2e-ui.log 2>&1 || true

# Chiqish kodi HAQIQIY. Oldingi versiyada bu yerda `exit 0` turardi
# va shu sababli hech narsa ishlamagan bosqich ham yashil ko'rinardi.
exit "$rc"
