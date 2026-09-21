import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// ILOVA CHAQIRADIGAN AUTH YO'LLARI SERVERDA BORMI.
///
/// ## NIMA UCHUN BU SINOV BOR
///
/// Ro'yxatdan o'tish ekrani `/api/auth/request-email-code` ga
/// borardi va kod ekrani `/api/auth/verify-email-code` ga. Serverda
/// bu ikkala yo'l ham YO'Q — `hosting/api/auth.js` da haqiqiy
/// shartnoma boshqacha:
///
///     POST /api/auth/request-register-code {email}|{phone}
///     POST /api/auth/register {email, code, password, phone, ...}
///
/// Ya'ni YANGI FOYDALANUVCHI RO'YXATDAN O'TA OLMASDI: birinchi
/// qadamdayoq 404 kelardi.
///
/// Eng achinarlisi — to'g'ri metodlar (`requestRegisterCode`,
/// `register`) repozitoriyada ALLAQACHON bor edi va server
/// shartnomasiga to'liq mos edi. Ularni shunchaki hech kim
/// chaqirmasdi. Bu `markStorySeen` va NFC dispatcher bilan bir xil
/// sinf: kod yozilgan, lekin ulanmagan.
///
/// Sinov ikki tomonni SOLISHTIRADI: ilova chaqiradigan har bir
/// `/api/auth/...` yo'li server manbasida uchrashi shart.
void main() {
  test('ilova chaqiradigan har bir auth yo\'li serverda bor', () {
    final app = File('lib/data/repositories/auth_repository.dart')
        .readAsStringSync();

    // Server tomoni: Worker va uning auth moduli.
    final server = [
      '../hosting/api/auth.js',
      '../hosting/worker.js',
    ].map((p) => File(p).readAsStringSync()).join('\n');

    final called = RegExp(r"'(/api/auth/[a-z0-9\-/]+)'")
        .allMatches(app)
        .map((m) => m.group(1)!)
        .toSet();

    expect(called, isNotEmpty, reason: 'auth yo\'llari topilmadi');

    final missing = <String>[];
    for (final path in called) {
      // Yo'l serverda literal satr sifatida uchrashi kerak.
      if (!server.contains(path)) missing.add(path);
    }

    expect(missing, isEmpty,
        reason: 'Ilova MAVJUD BO\'LMAGAN auth yo\'llariga boradi — '
            'foydalanuvchi 404 oladi:\n${missing.join('\n')}');
  });
  /// KOD KELMAYDIGAN EKRANDA QOLIB KETISH — BOSHI BERK KO'CHA.
  ///
  /// Serverda `RESEND_API_KEY`/`RESEND_FROM` qo'yilmagan bo'lsa,
  /// `POST /api/auth/request-register-code` javobi
  /// `{ok:true, channel:'none'}` bo'ladi — ya'ni kod HECH QAYERGA
  /// yuborilmagan. Ilova esa baribir olti katakli kod ekraniga olib
  /// borardi: odam hech qachon kelmaydigan kodni kutib o'tirardi va
  /// ro'yxatdan umuman o'ta olmasdi. Aynan shu jonli qurilmada
  /// yuz berdi.
  ///
  /// SERVER QOIDASI SHU YERDA YUMSHATILMAYDI. O'sha holatda
  /// `POST /api/auth/register` ning O'ZI kod so'ramaydi
  /// (`hosting/api/auth.js`: `if (emailOn) { ... email_code_required }`).
  /// Ya'ni kodsiz davom etish — serverning o'z qarorini bajarish.
  /// Sinov ikkala tomonni ham tekshiradi: server shartni `emailOn`
  /// ichida ushlab tursin, ekran esa `none` ni alohida hal qilsin.
  test('email xizmati o\'chiq bo\'lsa ro\'yxatdan o\'tish to\'xtamaydi', () {
    final server = File('../hosting/api/auth.js').readAsStringSync();

    // 1) Server: kod talabi FAQAT email yoqilganda.
    final emailOnBlock = RegExp(r'if \(emailOn\) \{(.*?)\n  \}', dotAll: true)
        .firstMatch(server)
        ?.group(1);
    expect(emailOnBlock, isNotNull,
        reason: 'serverda `if (emailOn)` bloki topilmadi');
    expect(emailOnBlock, contains('email_code_required'),
        reason: 'kod talabi `emailOn` shartidan chiqib ketgan — xizmat '
            'o\'chiq bo\'lganda ham kod so\'ralib, ro\'yxat to\'xtaydi');

    // 2) Server: kod so'ralmaganda `channel: none` qaytaradi.
    expect(server, contains("channel: 'none'"),
        reason: 'server kod yuborilmaganini aytmay qo\'ydi');

    // 3) Ekran: `none` alohida yo'l bilan hal qilinadi va kod
    //    ekraniga TO'G'RIDAN-TO'G'RI olib borilmaydi.
    final screen =
        File('lib/features/auth/register_screen.dart').readAsStringSync();
    final okBranch = RegExp(r'ok: \(channel\) \{(.*?)\n      \},', dotAll: true)
        .firstMatch(screen)
        ?.group(1);
    expect(okBranch, isNotNull,
        reason: 'register_screen: `ok: (channel)` tarmog\'i topilmadi');
    expect(okBranch, contains("channel == 'none'"),
        reason: 'ekran `channel: none` ni hal qilmaydi — odam hech qachon '
            'kelmaydigan kodni kutib qoladi');
    expect(okBranch!.contains('Routes.registerVerify'), isFalse,
        reason: 'ekran kanalga qaramasdan kod ekraniga olib boryapti');
    expect(screen, contains('_registerWithoutCode'),
        reason: 'kodsiz ro\'yxatdan o\'tish yo\'li yo\'q');

    // 4) Kodsiz yo'l xatoda ham boshi berk bo'lmasin: ikki so'rov
    //    orasida xizmat yoqilib qolsa, kod ekraniga qaytadi.
    expect(screen, contains('email_code_required'),
        reason: 'xizmat yoqilib qolgan holat hal qilinmagan');
  });
}
