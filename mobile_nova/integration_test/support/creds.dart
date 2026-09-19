/// HAQIQIY HISOB MA'LUMOTLARI — FAQAT ISHLASH VAQTIDA.
///
/// ## QOIDA
///
/// Bu qiymatlar repozitoriyda YO'Q va hech qachon bo'lmaydi. Ular
/// GitHub Actions `secrets` dan kelib, `--dart-define` orqali
/// uzatiladi:
///
///     --dart-define=NOVA_TEST_LOGIN=$NOVA_TEST_LOGIN
///     --dart-define=NOVA_TEST_PASSWORD=$NOVA_TEST_PASSWORD
///
/// GitHub secret qiymatini logda avtomatik `***` bilan almashtiradi,
/// lekin bunga TAYANMAYMIZ: bu yerdagi [redact] har bir yozib
/// olinadigan matndan parol va loginni O'ZI olib tashlaydi. Ikki
/// qatlam, chunki bitta qatlam yetarli emas.
///
/// ## NIMA UCHUN ARTEFAKT YUKLANMAYDI
///
/// `--dart-define` qiymatlari qurilgan APK ICHIGA tushadi. Shuning
/// uchun E2E workflow hech qanday APK/AAB yuklamaydi — faqat matn
/// hisoboti chiqadi. Reliz APK'si alohida workflow'da, sinov
/// hisobisiz quriladi.
library;

/// Sinov hisobining logini (email).
const String kTestLogin = String.fromEnvironment('NOVA_TEST_LOGIN');

/// Sinov hisobining vaqtinchalik paroli.
const String kTestPassword = String.fromEnvironment('NOVA_TEST_PASSWORD');

/// Ixtiyoriy ikkinchi hisob — kuzatish/izoh oqimlari uchun.
///
/// Bo'lmasa, o'sha qatorlar `SKIPPED` deb belgilanadi, `PASS` deb
/// EMAS.
const String kTestLogin2 = String.fromEnvironment('NOVA_TEST_LOGIN_2');
const String kTestPassword2 = String.fromEnvironment('NOVA_TEST_PASSWORD_2');

/// Ma'lumotlar berilganmi.
bool get hasCreds => kTestLogin.isNotEmpty && kTestPassword.isNotEmpty;
bool get hasSecondAccount =>
    kTestLogin2.isNotEmpty && kTestPassword2.isNotEmpty;

/// Matndan maxfiy qiymatlarni olib tashlaydi.
///
/// Parol qisqa bo'lishi mumkin (masalan `1234`) va shunday qisqa
/// satr tasodifan boshqa joyda uchrashi mumkin. Shuning uchun
/// 4 belgidan qisqa qiymatlar almashtirilmaydi — aks holda butun
/// hisobot `***` ga to'lardi va o'qib bo'lmasdi. Bunday parol
/// ishlatilsa, [credWarning] ogohlantiradi.
String redact(String? input) {
  if (input == null || input.isEmpty) return '';
  var out = input;
  for (final secret in [
    kTestPassword,
    kTestPassword2,
    kTestLogin,
    kTestLogin2,
  ]) {
    if (secret.length < 4) continue;
    out = out.replaceAll(secret, '***');
    // Email `@` dan oldingi qismi ham o'zi uchun identifikator.
    final at = secret.indexOf('@');
    if (at >= 4) out = out.replaceAll(secret.substring(0, at), '***');
  }
  return out;
}

/// Qisqa parol haqida ogohlantirish — hisobot boshida chiqadi.
String? get credWarning =>
    kTestPassword.length < 4 && kTestPassword.isNotEmpty
        ? 'DIQQAT: parol 4 belgidan qisqa — logdan avtomatik '
            'olib tashlanmaydi. Uzunroq vaqtinchalik parol qo\'ying.'
        : null;
