import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// E2E HAQIQIY HISOBDA ISHLAYDI — SHUNING UCHUN QO'RIQLANADI.
///
/// Bu testlar `integration_test/` papkasining MATNINI tekshiradi.
/// Ular oddiy `flutter test` da, emulyatorsiz, bir soniyada
/// bajariladi — ya'ni xavfli o'zgarish CI ning eng arzon bosqichida
/// tutiladi, haqiqiy hisobga tegmasdan oldin.
///
/// Nima uchun matn bo'yicha: buzg'unchi metod chaqirilgan-chaqirilmaganini
/// ishga tushirmasdan bilishning yagona yo'li shu. Ishga tushirib
/// ko'rish esa aynan oldini olmoqchi bo'lgan narsamiz.
void main() {
  final dir = Directory('integration_test');
  final sources = dir.existsSync()
      ? dir
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart'))
          .toList()
      : <File>[];

  /// Izohlarni olib tashlaydi: hujjatda metod nomi eslatilishi
  /// mumkin va u chaqiruv emas.
  String codeOnly(String src) => src
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///') && !t.startsWith('*');
      })
      .join('\n');

  test('integration_test/ papkasi mavjud', () {
    expect(sources, isNotEmpty,
        reason: 'E2E to\'plami yo\'qolgan bo\'lsa, hisobot ham yo\'q');
  });

  group('buzg\'unchi amallar E2E ichida chaqirilmaydi', () {
    // `guards.dart` dagi ro'yxat bilan bir xil. Ataylab TAKRORLANGAN:
    // qo'riqchi qo'riqlanayotgan fayldan import qilsa, o'sha faylni
    // o'zgartirgan odam qo'riqchini ham birga o'chirib yuborardi.
    const forbidden = <String, String>{
      'deleteId(': 'haqiqiy NFC ID ni o\'chiradi',
      'setPrimary(': 'asosiy NFC ID ni almashtiradi',
      'unlinkDevice(': 'haqiqiy jismoniy kartani uzadi',
      'resolveChip(': 'haqiqiy chip tokenini sarflaydi',
      'acceptGift(': 'haqiqiy sovg\'ani qabul qiladi',
      'rejectGift(': 'haqiqiy sovg\'ani rad etadi',
      'cancelGift(': 'haqiqiy sovg\'ani bekor qiladi',
      'startPayment(': 'HAQIQIY TO\'LOV boshlaydi',
      'orderPhysicalCard(': 'haqiqiy buyurtma yaratadi',
      'changePassword(': 'haqiqiy parolni almashtiradi',
      'requestPasswordCode(': 'haqiqiy kod yuboradi',
      'requestPremium(': 'adminga haqiqiy so\'rov yuboradi',
      '.support(': 'qo\'llab-quvvatlashga haqiqiy xabar yuboradi',
      '.submit(': 'biznesni haqiqiy moderatsiyaga yuboradi',
    };

    for (final entry in forbidden.entries) {
      test('${entry.key} — ${entry.value}', () {
        for (final f in sources) {
          expect(
            codeOnly(f.readAsStringSync()),
            isNot(contains(entry.key)),
            reason: '${f.path} ichida `${entry.key}` bor. '
                'Bu ${entry.value} — haqiqiy hisobda qaytarib bo\'lmaydi.',
          );
        }
      });
    }

    // `gift(` alohida: `giftOffers(` ni o'qish MUMKIN, lekin
    // `nfc.gift(` — ID ni boshqa odamga BERADI.
    test('gift( — NFC ID ni sovg\'a qiladi', () {
      for (final f in sources) {
        final code = codeOnly(f.readAsStringSync());
        expect(code, isNot(contains('.gift(')),
            reason: '${f.path}: `gift(` ID egaligini ko\'chiradi');
      }
    });
  });

  group('maxfiy ma\'lumot qo\'riqchisi', () {
    test('login va parol manba kodida YO\'Q — faqat --dart-define', () {
      for (final f in sources) {
        final src = f.readAsStringSync();
        // Yagona ruxsat etilgan shakl — muhitdan o'qish.
        final assigns = RegExp(
          r'''(kTestLogin|kTestPassword)\s*=\s*['"]''',
        );
        expect(assigns.hasMatch(src), isFalse,
            reason: '${f.path}: maxfiy qiymat kodga yozilgan. '
                'U faqat String.fromEnvironment orqali kelishi kerak.');
      }
    });

    test('`redact` hisobotdagi barcha erkin matndan o\'tadi', () {
      final report = File('integration_test/support/report.dart');
      final src = report.readAsStringSync();
      // Foydalanuvchi matni tushadigan maydonlar ro'yxati.
      for (final field in ['cause', 'note', 'response', 'request']) {
        expect(src, contains("redact($field)"),
            reason: '`$field` maydoni redact dan o\'tmayapti — '
                'parol hisobotga tushishi mumkin');
      }
    });

    test('yaratilgan obyektlar belgilanadi va tozalanadi', () {
      final e2e =
          File('integration_test/e2e_backend_test.dart').readAsStringSync();
      // Izohlar hisobga olinmaydi: quyidagi tekshiruvlar KOD haqida,
      // izohda esa `track()` nima uchun tashlangani tushuntiriladi.
      final e2eCode = codeOnly(e2e);
      expect(e2e, contains('litter.trackResult('),
          reason: 'yaratilgan obyektlar tozalash ro\'yxatiga qo\'shilmayapti');
      expect(e2e, contains('litter.sweep()'),
          reason: 'tozalash bosqichi chaqirilmayapti');

      // `track()` XATONI YUTADI — `trackResult()` esa ko'rsatadi.
      //
      // Repozitoriya metodlari istisno otmaydi, `Result` qaytaradi.
      // Shuning uchun `track()` bilan yozilgan o'chirish `Err`
      // qaytarsa ham "tozalandi" deb hisoblanardi va obyekt
      // haqiqiy hisobda qolib ketardi.
      expect(e2eCode, isNot(contains('litter.track(')),
          reason: 'tozalash `track()` bilan yozilgan — `Err` jimgina '
              'yutiladi; `trackResult()` ishlatilsin');

      // TOZALASH CHIQISHDAN OLDIN bo'lishi shart: `logout()` dan
      // keyin har bir o'chirish 401 oladi (E2E #17 da istorya
      // haqiqiy hisobda qolib ketgan edi).
      final sweepAt = e2eCode.indexOf('litter.sweep()');
      final logoutAt = e2eCode.indexOf('auth.logout()');
      expect(sweepAt >= 0 && logoutAt >= 0 && sweepAt < logoutAt, isTrue,
          reason: 'tozalash `auth.logout()` dan KEYIN turibdi — '
              'o\'chirishlar 401 oladi va axlat qolib ketadi');
      expect(e2e, contains('testLabel('),
          reason: 'sinov obyektlari belgilanmayapti — qolib ketsa '
              'qaysi biri sinovniki ekani bilinmaydi');
    });
  });

  test('E2E `flutter test` ga aralashmaydi', () {
    // `integration_test/` `test/` dan tashqarida — `flutter test`
    // uni ko'rmaydi. Shuning uchun sinov hisobisiz ham oddiy testlar
    // o'tadi. Bu tekshiruv shu joylashuvni qotiradi.
    expect(Directory('test/integration_test').existsSync(), isFalse,
        reason: 'E2E `test/` ichiga ko\'chirilsa, u har `flutter test` da '
            'haqiqiy backendga bora boshlaydi');
  });
}
