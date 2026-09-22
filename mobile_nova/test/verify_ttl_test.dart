import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Tasdiqlash kodi muddati: ilova va server bitta raqamni aytishi shart.
///
/// Bu test HAQIQIY NOSOZLIKDAN keyin yozildi. Ilovada sanoq 120 soniya
/// edi, serverda esa kod 5 daqiqa yashardi. Odam kodni ko'rish uchun
/// pochtaga o'tib qaytsa, ilova "muddati tugadi" deb maydonni
/// o'chirardi — server esa o'sha kodni hali ham qabul qilardi.
/// Ro'yxatdan o'tish shu yerda to'xtab qolardi.
///
/// Shuning uchun qiymat "ko'chirib qo'yildi" degan so'zga
/// ishonilmaydi — ikkala fayldan o'qib SOLISHTIRILADI.
void main() {
  test('VerifyScreen._ttl serverdagi REGISTER_OTP_TTL_MS ga teng', () {
    final server = File('../hosting/api/auth.js').readAsStringSync();
    final dart =
        File('lib/features/auth/verify_screen.dart').readAsStringSync();

    final m = RegExp(r'REGISTER_OTP_TTL_MS\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)')
        .firstMatch(server);
    expect(m, isNotNull, reason: 'serverda REGISTER_OTP_TTL_MS topilmadi');

    final ms = int.parse(m!.group(1)!) *
        int.parse(m.group(2)!) *
        int.parse(m.group(3)!);
    final serverSeconds = ms ~/ 1000;

    final d = RegExp(r'static const _ttl = (\d+);').firstMatch(dart);
    expect(d, isNotNull, reason: 'ilovada _ttl topilmadi');
    final clientSeconds = int.parse(d!.group(1)!);

    expect(
      clientSeconds,
      serverSeconds,
      reason: 'ilovadagi sanoq ($clientSeconds s) server muddati '
          '($serverSeconds s) bilan mos emas — odam hali tirik kodni '
          'yozolmay qoladi',
    );
  });

  test('muddat tugaganda qayta yuborish tugmasi bor', () {
    // Sanoq tugaganda maydon o'chadi. Agar o'sha paytda chiqish yo'li
    // ham bo'lmasa, ekran haqiqatan boshi berk ko'chaga aylanadi.
    final dart =
        File('lib/features/auth/verify_screen.dart').readAsStringSync();
    expect(dart, contains('l.verifyResend'));
    expect(dart, contains('onPressed: _resend'));
  });
}
