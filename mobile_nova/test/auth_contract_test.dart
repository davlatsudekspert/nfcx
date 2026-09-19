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
}
