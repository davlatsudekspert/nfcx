import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/featured_repository.dart';
import 'package:nfcstore_nova/features/social/featured_screen.dart';

import 'helpers.dart';

/// POSTNI LENTADA KO'TARISH — SOTIB OLISH OQIMI.
///
/// ENG MUHIM QOIDA: ILOVA SLOTNI YOQA OLMAYDI. Ekran faqat
/// kutilayotgan buyurtma ochadi va to'lov sahifasini ochadi;
/// slot Payme/Click tasdig'idan keyin SERVERDA yonadi.
///
/// Ikkinchisi: NARXNI ILOVA YUBORMAYDI. So'rovda faqat kun soni
/// bo'lishi kerak — aks holda so'rovni qo'lda yuborgan odam
/// 6 kunlik slotni 1 so'mga olardi.
class _FakeFeatured extends FeaturedRepository {
  _FakeFeatured({this.enabled = true, this.failCode}) : super(ApiClient());

  final bool enabled;
  final String? failCode;
  /// Serverdagi standart paketlar bilan AYNAN bir xil —
  /// `hosting/api/featured.js` dagi `DEFAULT_PACKAGES`.
  static const offered = [
    FeaturedPackage(days: 1, price: 29000),
    FeaturedPackage(days: 3, price: 69000),
    FeaturedPackage(days: 6, price: 119000),
  ];

  /// `buy()` ga AYNAN nima yuborilgani.
  final calls = <Map<String, dynamic>>[];

  @override
  Future<Result<FeaturedOffer>> packages() async =>
      Ok(FeaturedOffer(packages: offered, enabled: enabled));

  @override
  Future<Result<List<FeaturedSlot>>> mine() async => const Ok([]);

  @override
  Future<Result<FeaturedPurchase>> buy({
    required String targetKind,
    required int targetId,
    required int days,
  }) async {
    calls.add({'kind': targetKind, 'id': targetId, 'days': days});
    if (failCode != null) {
      return Err(AppError(AppErrorKind.server, code: failCode));
    }
    return Ok(FeaturedPurchase(
      slot: FeaturedSlot(id: 7, days: days, status: 'pending'),
      orderId: 42,
      payme: 'https://checkout.paycom.uz/base64',
    ));
  }
}

void main() {
  late List<String> opened;

  setUp(() {
    opened = [];
    openLinkOverride = (uri) async {
      opened.add(uri.toString());
      return true;
    };
  });
  tearDown(() => openLinkOverride = null);

  Future<_FakeFeatured> pump(
    WidgetTester tester, {
    bool enabled = true,
    String? failCode,
  }) async {
    final repo = _FakeFeatured(enabled: enabled, failCode: failCode);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        featuredRepositoryProvider.overrideWithValue(repo),
      ],
      child: wrapScreen(
        const FeaturedScreen(targetKind: 'post', targetId: 10),
      ),
    ));
    await settle(tester, frames: 20);
    return repo;
  }

  group('Paketlar SERVERDAN', () {
    testWidgets('uchta muddat ko‘rinadi', (tester) async {
      await pump(tester);
      expect(find.text('1 kun'), findsOneWidget);
      expect(find.text('3 kun'), findsOneWidget);
      expect(find.text('6 kun'), findsOneWidget);
    });

    testWidgets('to‘lovlar o‘chiq bo‘lsa sotuv YOPIQ', (tester) async {
      final repo = await pump(tester, enabled: false);
      expect(find.text('3 kun'), findsNothing);
      expect(find.textContaining('vaqtincha o‘chirilgan'), findsOneWidget);
      expect(repo.calls, isEmpty);
    });
  });

  group('Sotib olish', () {
    testWidgets('muddat tanlanmaguncha tugma O‘CHIQ', (tester) async {
      final repo = await pump(tester);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 12);
      expect(repo.calls, isEmpty,
          reason: 'qaysi paket sotib olinayotgani noaniq holda '
              'so‘rov ketdi');
    });

    testWidgets('so‘rovda FAQAT kun soni ketadi — narx EMAS',
        (tester) async {
      final repo = await pump(tester);
      await tester.tap(find.text('3 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);

      expect(repo.calls, hasLength(1));
      final call = repo.calls.single;
      expect(call['days'], 3);
      expect(call['kind'], 'post');
      expect(call['id'], 10);
      expect(call.containsKey('price'), isFalse,
          reason: 'ilova narx yuboryapti — serverda hisoblanishi shart');
    });

    testWidgets('to‘lov sahifasi OCHILADI', (tester) async {
      await pump(tester);
      await tester.tap(find.text('3 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);

      expect(opened, hasLength(1));
      expect(opened.single, contains('paycom.uz'));
    });

    testWidgets('to‘lovdan KEYIN ham "kutilmoqda" — "yonди" EMAS',
        (tester) async {
      // Ilova slotni yoqa olmaydi. Ekran buni ochiq aytishi kerak,
      // aks holda odam "bo‘ldi" deb o‘ylab ketardi.
      await pump(tester);
      await tester.tap(find.text('3 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);

      expect(find.text('To‘lov kutilmoqda'), findsOneWidget);
      expect(find.textContaining('tasdiqlangach'), findsOneWidget);
      // Paketlar ro'yxati yopiladi: ikkinchi sotib olish 409 beradi.
      expect(find.text('3 kun'), findsNothing);
    });
  });

  group('Xatolar ODAM TUSHUNADIGAN tilda', () {
    testWidgets('allaqachon ko‘tarilgan', (tester) async {
      await pump(tester, failCode: 'already_featured');
      await tester.tap(find.text('1 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);
      expect(find.textContaining('allaqachon ko‘tarilgan'), findsOneWidget);
    });

    testWidgets('chegaradan oshdi', (tester) async {
      await pump(tester, failCode: 'too_many_active');
      await tester.tap(find.text('1 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);
      expect(find.textContaining('3 ta post'), findsOneWidget);
    });

    testWidgets('begona post', (tester) async {
      await pump(tester, failCode: 'forbidden');
      await tester.tap(find.text('1 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);
      expect(find.textContaining('o‘z postingizni'), findsOneWidget);
    });

    testWidgets('xatodan keyin "kutilmoqda" ko‘rsatilmaydi', (tester) async {
      await pump(tester, failCode: 'already_featured');
      await tester.tap(find.text('1 kun'));
      await settle(tester, frames: 8);
      await tester.tap(find.text('To‘lovga o‘tish'));
      await settle(tester, frames: 20);
      expect(find.text('To‘lov kutilmoqda'), findsNothing);
      expect(opened, isEmpty);
    });
  });

  group('Slot modeli', () {
    test('qolgan kun manfiy bo‘lmaydi', () {
      final past = FeaturedSlot(
        id: 1,
        status: 'active',
        endsAt: DateTime.now().subtract(const Duration(days: 3)),
      );
      expect(past.daysLeft, 0);
    });

    test('qolgan kun yuqoriga yaxlitlanadi', () {
      final s = FeaturedSlot(
        id: 1,
        status: 'active',
        endsAt: DateTime.now().add(const Duration(hours: 30)),
      );
      expect(s.daysLeft, 2);
    });

    test('server MILLISEKUND yuborsa ham o‘qiladi', () {
      // `/api/featured` sanalarni raqam qilib yuboradi. Ilgari
      // `_dt` faqat ISO satrni o‘qirdi va `endsAt` HAR DOIM null
      // bo‘lardi — ya'ni "necha kun qoldi" doim 0 ko‘rinardi.
      final ms = DateTime.now()
          .add(const Duration(days: 2))
          .millisecondsSinceEpoch;
      final s = FeaturedSlot.fromJson({'id': 1, 'status': 'active', 'endsAt': ms});
      expect(s.endsAt, isNotNull);
      expect(s.daysLeft, greaterThan(0));
    });

    test('ISO satr ham o‘qiladi', () {
      final s = FeaturedSlot.fromJson({
        'id': 1,
        'endsAt': DateTime.now().add(const Duration(days: 2)).toIso8601String(),
      });
      expect(s.endsAt, isNotNull);
    });

    test('yil raqami sana deb o‘qilmaydi', () {
      // `2026` epoch emas. Aks holda u 1970-yil 1-yanvarga
      // aylanib ketardi va "muddati tugagan" ko‘rinardi.
      expect(FeaturedSlot.fromJson({'id': 1, 'endsAt': 2026}).endsAt, isNull);
    });
  });
}
