import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/nfc/ndef_payload.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/nfc/nfc_write_screen.dart';

import 'helpers.dart';

/// BEGONA KARTAGA YOZISH EKRANI.
///
/// Apparat bu yerda YO'Q: `NfcService` o'rniga soxtasi qo'yiladi.
/// Tekshirilayotgan narsa — ekranning QARORLARI:
///
///   * tasdiqsiz yozilmasligi;
///   * qulflangan kartada tugma umuman ochilmasligi;
///   * "yozildi" yozuvi FAQAT xizmat tasdiqlaganda chiqishi;
///   * tegga AYNAN ochiq profil manzili (chip token EMAS) borishi.
///
/// Bular UI darajasidagi qarorlar — mantiq testlari ularni ushlamaydi.
class _FakeNfcService extends NfcService {
  _FakeNfcService({required this.inspection, this.writeResult});

  final TagInspection inspection;
  final NfcWriteResult? writeResult;

  /// Yozishga kelgan chaqiruvlar — nima yozilgani shu yerda qoladi.
  final writes = <Map<String, String>>[];

  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;

  @override
  Future<TagInspection> inspect({Duration timeout = const Duration(seconds: 30)}) async =>
      inspection;

  @override
  Future<NfcWriteResult> writeProfileUrl({
    required String url,
    String expectIdentity = '',
    Duration timeout = const Duration(seconds: 30),
  }) async {
    writes.add({'url': url, 'identity': expectIdentity});
    return writeResult ?? NfcWriteResult(ok: true, written: url);
  }

  @override
  Future<void> stop() async {}
}

TagInspection _emptyTag() => const TagInspection(
      found: true,
      isNdef: true,
      writable: true,
      maxSize: 144,
      identity: '04a20bff',
    );

TagInspection _tagWith(String text) => TagInspection(
      found: true,
      isNdef: true,
      writable: true,
      maxSize: 144,
      identity: '04a20bff',
      records: [NdefRecordData(kind: NdefKind.uri, value: text)],
    );


/// Ro'yxatdagi tugmani ko'rinadigan joyga chiqarib bosadi.
///
/// `NovaScroll` ichidagi vidjet ekrandan pastda qolsa Flutter uni
/// UMUMAN qurmaydi — `find` bo'sh qaytadi va test "tugma yo'q" deb
/// yiqiladi, holbuki tugma bor.
Future<void> tapText(WidgetTester tester, String text) async {
  final f = find.text(text);
  await tester.scrollUntilVisible(f, 120, scrollable: find.byType(Scrollable).first);
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await settle(tester, frames: 20);
}

void main() {
  Future<_FakeNfcService> pump(
    WidgetTester tester, {
    required TagInspection inspection,
    NfcWriteResult? writeResult,
    List<NfcId>? ids,
  }) async {
    final fake = _FakeNfcService(inspection: inspection, writeResult: writeResult);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(
          FakeAuthRepository(
            ids: ids ??
                [const NfcId(code: 'VIP001', name: 'Asosiy', primary: true)],
          ),
        ),
        nfcServiceProvider.overrideWithValue(fake),
      ],
      child: wrapScreen(const NfcWriteScreen()),
    ));
    await settle(tester, frames: 20);
    return fake;
  }

  group('Bo‘sh kartaga yozish', () {
    testWidgets('yozishdan OLDIN yozish tugmasi umuman yo‘q', (tester) async {
      await pump(tester, inspection: _emptyTag());
      expect(find.text('NFC kartaga yozish'), findsWidgets);
      // Ikkinchi qadam faqat tekshiruvdan keyin ochiladi.
      expect(find.text('2-QADAM — YOZISH'), findsNothing);
    });

    testWidgets('tekshiruvdan keyin karta BO‘SH deb ko‘rsatiladi',
        (tester) async {
      await pump(tester, inspection: _emptyTag());
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);

      expect(find.textContaining('Karta bo‘sh'), findsOneWidget);
      expect(find.text('2-QADAM — YOZISH'), findsOneWidget);
      // Sig'im ko'rsatiladi — odam kartasini tanishi uchun.
      expect(find.textContaining('144'), findsOneWidget);
    });

    testWidgets('bo‘sh kartada TASDIQ SO‘RALMAYDI — darhol yoziladi',
        (tester) async {
      final fake = await pump(tester, inspection: _emptyTag());
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);

      expect(find.byType(AlertDialog), findsNothing,
          reason: 'bo‘sh kartada ortiqcha savol berilyapti');
      expect(fake.writes, hasLength(1));
      expect(find.text('Yozildi va tekshirildi'), findsOneWidget);
    });

    testWidgets('tegga OCHIQ profil manzili boradi — chip token EMAS',
        (tester) async {
      final fake = await pump(tester, inspection: _emptyTag());
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);

      final url = fake.writes.single['url']!;
      expect(url, endsWith('/VIP001'));
      expect(url, isNot(contains('/tap/')),
          reason: 'tashqi kartaga maxfiy chip tokeni yozilyapti');
      expect(isSafeWriteUrl(url), isTrue);
      // Ikkinchi tegizish AYNAN o‘sha karta ekanini tekshiradi.
      expect(fake.writes.single['identity'], '04a20bff');
    });
  });

  group('Ma’lumotli kartaga yozish', () {
    testWidgets('OGOHLANTIRISH chiqadi va ichidagi ko‘rsatiladi',
        (tester) async {
      await pump(tester, inspection: _tagWith('https://boshqa-sayt.uz/ali'));
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);

      expect(find.textContaining('allaqachon ma’lumot bor'), findsOneWidget);
      expect(find.textContaining('boshqa-sayt.uz/ali'), findsWidgets,
          reason: 'kartada nima turgani ko‘rsatilmayapti');
    });

    testWidgets('TASDIQ BERILMASA hech narsa yozilmaydi', (tester) async {
      final fake = await pump(tester, inspection: _tagWith('https://x.uz/a'));
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);

      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('Bekor qilish'));
      await settle(tester, frames: 20);

      expect(fake.writes, isEmpty,
          reason: 'odam rad etdi, kartasi baribir o‘chirildi');
      expect(find.text('Yozildi va tekshirildi'), findsNothing);
    });

    testWidgets('TASDIQ berilsa yoziladi', (tester) async {
      final fake = await pump(tester, inspection: _tagWith('https://x.uz/a'));
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);
      await tester.tap(find.text('Ha, ustiga yozilsin'));
      await settle(tester, frames: 20);

      expect(fake.writes, hasLength(1));
      expect(find.text('Yozildi va tekshirildi'), findsOneWidget);
    });
  });

  group('Yozib bo‘lmaydigan kartalar — SABAB aytiladi', () {
    testWidgets('qulflangan kartada tugma bosilmaydi', (tester) async {
      final fake = await pump(
        tester,
        inspection: const TagInspection(
          found: true,
          isNdef: true,
          writable: false,
          maxSize: 144,
          identity: 'aa',
        ),
      );
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);

      expect(find.textContaining('qulflangan'), findsOneWidget);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);
      expect(fake.writes, isEmpty,
          reason: 'qulflangan kartaga yozishga urinildi');
    });

    testWidgets('NDEF qo‘llamaydigan kartada sabab yoziladi', (tester) async {
      final fake = await pump(
        tester,
        inspection: const TagInspection(
          found: true,
          isNdef: false,
          formattable: false,
          identity: 'bb',
          error: TagError.notNdef,
        ),
      );
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);

      // `inspect` xato qaytardi — sabab yuqorida chiqadi.
      expect(find.textContaining('NDEF'), findsWidgets);
      expect(fake.writes, isEmpty);
    });

    testWidgets('karta topilmasa aniq maslahat beriladi', (tester) async {
      await pump(
        tester,
        inspection: const TagInspection(found: false, error: TagError.timeout),
      );
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);

      expect(find.textContaining('Karta topilmadi'), findsOneWidget);
      expect(find.text('2-QADAM — YOZISH'), findsNothing);
    });
  });

  group('Yozish muvaffaqiyatsiz bo‘lganda YOLG‘ON aytilmaydi', () {
    testWidgets('qayta o‘qish mos kelmasa — "yozildi" DEYILMAYDI',
        (tester) async {
      await pump(
        tester,
        inspection: _emptyTag(),
        writeResult: const NfcWriteResult(ok: false, error: TagError.verifyFailed),
      );
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);

      expect(find.text('Yozildi va tekshirildi'), findsNothing,
          reason: 'tasdiqlanmagan yozuv muvaffaqiyat deb ko‘rsatildi');
      expect(find.textContaining('qayta o‘qiganda'), findsOneWidget);
    });

    testWidgets('BOSHQA karta tegizilsa — aniq aytiladi', (tester) async {
      await pump(
        tester,
        inspection: _emptyTag(),
        writeResult: const NfcWriteResult(ok: false, error: TagError.differentTag),
      );
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);

      expect(find.textContaining('boshqa karta'), findsOneWidget);
      expect(find.text('Yozildi va tekshirildi'), findsNothing);
    });
  });

  group('Bir nechta profil', () {
    testWidgets('profil almashsa tekshiruv QAYTADAN so‘raladi',
        (tester) async {
      await pump(
        tester,
        inspection: _emptyTag(),
        ids: const [
          NfcId(code: 'VIP001', name: 'Shaxsiy', primary: true),
          NfcId(code: 'BIZ777', name: 'Biznes'),
        ],
      );
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      expect(find.text('2-QADAM — YOZISH'), findsOneWidget);

      await tapText(tester, 'Biznes');
      await settle(tester, frames: 20);

      expect(find.text('2-QADAM — YOZISH'), findsNothing,
          reason: 'boshqa profil tanlandi, lekin eski tekshiruv qoldi — '
              'odam VIP001 deb o‘ylab BIZ777 ni yozib yuborardi');
    });

    testWidgets('tanlangan profilning manzili yoziladi', (tester) async {
      final fake = await pump(
        tester,
        inspection: _emptyTag(),
        ids: const [
          NfcId(code: 'VIP001', name: 'Shaxsiy', primary: true),
          NfcId(code: 'BIZ777', name: 'Biznes'),
        ],
      );
      await tapText(tester, 'Biznes');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartani tekshirish');
      await settle(tester, frames: 20);
      await tapText(tester, 'Kartaga yozish');
      await settle(tester, frames: 20);

      expect(fake.writes.single['url'], endsWith('/BIZ777'));
    });
  });
}
