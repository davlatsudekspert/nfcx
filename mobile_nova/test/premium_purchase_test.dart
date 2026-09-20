import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/shop_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// PREMIUMNI ILOVADAN SOTIB OLISH.
///
/// Ilgari ekran bor edi, lekin SOXTA edi: `requestPremium()`
/// `post<void>` bo'lgani uchun server qaytargan TO'LOV HAVOLASI
/// tashlab yuborilardi, ekran esa "Xabar yuborildi" deb yozardi.
/// Ya'ni serverda to'lanmagan buyurtma qolar, odam hech qayerga
/// bormasdi.
///
/// Bu testlar shuni tekshiradi: havola O'QILADI, narx SERVERDAN
/// keladi va to'lov yo'li bo'lmasa SOXTA muvaffaqiyat berilmaydi.

class _PremiumRepo extends ProfileRepository {
  _PremiumRepo(this.body) : super(ApiClient());

  /// Server javobining AYNAN o'zi (`hosting/api/account.js`).
  final Map<String, dynamic> body;
  int calls = 0;

  @override
  Future<Result<PremiumOffer>> requestPremium() async {
    calls++;
    return Ok(PremiumOffer.fromJson(body));
  }
}

class _StatusRepo extends ShopRepository {
  _StatusRepo(this.status) : super(ApiClient());
  final String status;
  int calls = 0;

  @override
  Future<Result<Map<String, dynamic>>> paymentStatus(int orderId) async {
    calls++;
    return Ok({'id': orderId, 'kind': 'premium_upgrade', 'status': status});
  }
}

/// Bosilgan to'lov havolalari — sinovda brauzer ochilmaydi.
late List<Uri> opened;

Future<void> _pumpPremium(
  WidgetTester tester, {
  required _PremiumRepo repo,
  ShopRepository? shop,
  bool browserWorks = true,
}) async {
  opened = [];
  openLinkOverride = (u) async {
    opened.add(u);
    return browserWorks;
  };
  addTearDown(() => openLinkOverride = null);

  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      profileRepositoryProvider.overrideWithValue(repo),
      if (shop != null) shopRepositoryProvider.overrideWithValue(shop),
    ],
    child: wrapScreen(const PremiumScreen()),
  ));
  await settle(tester);
}

/// Tugmani ekranga surib bosadi.
///
/// Ekran uzun: narx, imkoniyatlar ro'yxati va izohlar qo'shilgach
/// pastdagi tugmalar ko'rinish maydonidan chiqib ketadi.
Future<void> _tap(WidgetTester tester, String label) async {
  final f = find.text(label);
  await tester.scrollUntilVisible(f, 120,
      scrollable: find.byType(Scrollable).first);
  await tester.tap(f);
  await settle(tester);
}

void main() {
  group('Tashqi havola — QOTIB QOLMAYDI', () {
    tearDown(() {
      openLinkOverride = null;
      openLinkTimeout = const Duration(seconds: 5);
    });

    test('brauzer JAVOB BERMASA kutish to‘xtaydi va havola buferga tushadi',
        () async {
      // O'LCHANGAN HAQIQAT: `launchUrl` ni oddiy widget testida
      // chaqirsangiz test TUGAMAYDI — platforma kanali javobsiz
      // qoladi. Telefonda ham brauzer topilmasa shunday bo'ladi va
      // tugma cheksiz "yuklanmoqda" holatida qotib qolardi.
      openLinkOverride = (_) => Completer<bool>().future;
      openLinkTimeout = const Duration(milliseconds: 80);

      String? clip;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          clip = (call.arguments as Map)['text'] as String?;
        }
        return null;
      });
      addTearDown(() => TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      final ok = await openLink('https://checkout.paycom.uz/AAA')
          .timeout(const Duration(seconds: 3));

      expect(ok, isFalse);
      expect(clip, 'https://checkout.paycom.uz/AAA',
          reason: 'odam to‘lov havolasisiz qoldi');
    });

    test('bo‘sh yoki buzuq manzil platformaga umuman ketmaydi', () async {
      var calls = 0;
      openLinkOverride = (_) async {
        calls++;
        return true;
      };
      expect(await openLink('   '), isFalse);
      expect(calls, 0);
    });
  });

  group('Server javobi — havola YO‘QOLMAYDI', () {
    test('`payLinks` dagi Payme va Click o‘qiladi', () {
      final o = PremiumOffer.fromJson({
        'orderId': 412,
        'amount': 20000,
        'payLink': 'https://checkout.paycom.uz/AAA',
        'payLinks': {
          'payme': 'https://checkout.paycom.uz/AAA',
          'click': 'https://my.click.uz/services/pay?x=1',
        },
      });

      expect(o.orderId, 412);
      expect(o.amount, 20000, reason: 'narx serverdan olinmadi');
      expect(o.payme, 'https://checkout.paycom.uz/AAA');
      expect(o.click, 'https://my.click.uz/services/pay?x=1');
      expect(o.payable, isTrue);
    });

    test('eski, bitta havolali shakl ham qabul qilinadi', () {
      // Click ulanmagan bo'lsa server `payLinks` ichiga uni
      // QO'SHMAYDI — bu holat haqiqiy.
      final o = PremiumOffer.fromJson({
        'orderId': 7,
        'amount': 20000,
        'payLink': 'https://checkout.paycom.uz/BBB',
        'payLinks': {'payme': 'https://checkout.paycom.uz/BBB'},
      });
      expect(o.payme, 'https://checkout.paycom.uz/BBB');
      expect(o.click, isEmpty);
      expect(o.payable, isTrue);
    });

    test('to‘lov tizimi ULANMAGAN bo‘lsa `payable` FALSE', () {
      // `paymentsEnabledD1` o'chiq bo'lsa havolalar bo'sh keladi.
      final o = PremiumOffer.fromJson(
          {'orderId': 9, 'amount': 20000, 'payLinks': <String, dynamic>{}});
      expect(o.payable, isFalse,
          reason: 'havolasiz buyurtmaga "to‘lash" tugmasi berilmasligi kerak');
    });
  });

  group('Obuna muddati — model tashlab yubormaydi', () {
    test('`premiumExpiresAt` o‘qiladi va kelajak sana FAOL deydi', () {
      final u = User.fromJson({
        'id': 1,
        'email': 'a@b.uz',
        'isPremium': true,
        'premiumExpiresAt':
            DateTime.now().add(const Duration(days: 12)).toIso8601String(),
      });
      expect(u.premiumUntil, isNotNull, reason: 'sana tashlab yuborildi');
      expect(u.premiumActive, isTrue);
    });

    test('MUDDATSIZ egada sana YO‘Q, lekin premium FAOL', () {
      // Eski, bir martalik to'lov qilganlar: `is_premium = 1`.
      final u = User.fromJson({'id': 1, 'email': 'a@b.uz', 'isPremium': true});
      expect(u.premiumUntil, isNull);
      expect(u.premiumActive, isTrue,
          reason: 'sana yo‘qligi "premium emas" degani emas');
    });

    test('SINOV muddati ham premium darajasini beradi', () {
      final u = User.fromJson({
        'id': 1,
        'email': 'a@b.uz',
        'isPremium': false,
        'trialExpiresAt':
            DateTime.now().add(const Duration(days: 3)).toIso8601String(),
      });
      expect(u.trialActive, isTrue);
      expect(u.premiumActive, isTrue);
    });

    test('muddati o‘tgan obuna FAOL emas', () {
      final u = User.fromJson({
        'id': 1,
        'email': 'a@b.uz',
        'isPremium': false,
        'premiumExpiresAt':
            DateTime.now().subtract(const Duration(days: 1)).toIso8601String(),
      });
      expect(u.premiumActive, isFalse);
    });
  });

  group('Premium ekrani', () {
    testWidgets('tugma bosilganda buyurtma yaratiladi va NARX ko‘rsatiladi',
        (tester) async {
      final repo = _PremiumRepo({
        'orderId': 412,
        'amount': 20000,
        'payLinks': {'payme': 'https://checkout.paycom.uz/AAA'},
      });
      await _pumpPremium(tester, repo: repo);
      final l = await L.delegate.load(const Locale('uz'));

      await _tap(tester, l.premiumBuy);

      expect(repo.calls, 1, reason: 'buyurtma so‘ralmadi');
      // MANA ESKI XATO: "Xabar yuborildi" chiqardi.
      expect(find.text(l.supportSent), findsNothing,
          reason: 'qo‘llab-quvvatlashga hech narsa yuborilmagan');
      expect(find.textContaining('20 000'), findsOneWidget,
          reason: 'serverdan kelgan narx ko‘rsatilmadi');
      // MANA ENG MUHIMI: to'lov sahifasi OCHILDI. Ilgari havola
      // umuman o'qilmasdi, ya'ni bu ro'yxat bo'sh qolardi.
      expect(opened.map((e) => '$e').toList(),
          ['https://checkout.paycom.uz/AAA'],
          reason: 'to‘lov sahifasiga olib borilmadi');
      expect(find.text(l.premiumPending), findsOneWidget);
    });

    testWidgets('brauzer OCHILMASA odam xabardor qilinadi', (tester) async {
      final repo = _PremiumRepo({
        'orderId': 412,
        'amount': 20000,
        'payLinks': {'payme': 'https://checkout.paycom.uz/AAA'},
      });
      await _pumpPremium(tester, repo: repo, browserWorks: false);
      final l = await L.delegate.load(const Locale('uz'));

      await _tap(tester, l.premiumBuy);

      // Bufer kanali sinovda javob bermaydi — `copyToClipboard`
      // chegarasi shu yerda ishlaydi.
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);
      expect(find.text(l.premiumBrowserFailed), findsOneWidget);
      expect(find.text(l.premiumPending), findsNothing,
          reason: 'ochilmagan sahifani "kutilmoqda" deyish yolg‘on');
    });

    testWidgets('to‘lov tizimi ulanmagan bo‘lsa SOXTA muvaffaqiyat yo‘q',
        (tester) async {
      final repo = _PremiumRepo(
          {'orderId': 9, 'amount': 20000, 'payLinks': <String, dynamic>{}});
      await _pumpPremium(tester, repo: repo);
      final l = await L.delegate.load(const Locale('uz'));

      await _tap(tester, l.premiumBuy);

      expect(find.text(l.premiumNoProvider), findsOneWidget);
      expect(find.text(l.premiumPending), findsNothing);
    });

    testWidgets('to‘lov TASDIQLANSA holat aytiladi', (tester) async {
      final repo = _PremiumRepo({
        'orderId': 412,
        'amount': 20000,
        'payLinks': {'payme': 'https://checkout.paycom.uz/AAA'},
      });
      final shop = _StatusRepo('paid');
      await _pumpPremium(tester, repo: repo, shop: shop);
      final l = await L.delegate.load(const Locale('uz'));

      await _tap(tester, l.premiumBuy);
      await _tap(tester, l.premiumCheck);

      expect(shop.calls, greaterThanOrEqualTo(1));
      expect(find.text(l.premiumPaid), findsOneWidget);
    });

    testWidgets('to‘lov hali TASDIQLANMAGAN bo‘lsa premium deyilmaydi',
        (tester) async {
      final repo = _PremiumRepo({
        'orderId': 412,
        'amount': 20000,
        'payLinks': {'payme': 'https://checkout.paycom.uz/AAA'},
      });
      final shop = _StatusRepo('pending');
      await _pumpPremium(tester, repo: repo, shop: shop);
      final l = await L.delegate.load(const Locale('uz'));

      await _tap(tester, l.premiumBuy);
      await _tap(tester, l.premiumCheck);

      expect(find.text(l.premiumNotYet), findsOneWidget);
      expect(find.text(l.premiumPaid), findsNothing);
    });
  });

  _historyTests();

  group('Darvoza yopiq bo‘lsa — BOSHI BERK KO‘CHA EMAS', () {
    final code = File('lib/features/social/post_screens.dart')
        .readAsStringSync()
        .split('\n')
        .where((l) {
          final t = l.trimLeft();
          return !t.startsWith('//') && !t.startsWith('///');
        })
        .join('\n');

    test('`feature_locked` UMUMIY xato sifatida ko‘rsatilmaydi', () {
      // Ilgari bu yerda faqat `describeError(l, e)` turardi va
      // server 403 qaytarganda ekranda "Ruxsat yo‘q" chiqardi —
      // odam nega joylay olmasligini bilmasdi.
      expect(code, contains("e.code == 'feature_locked'"),
          reason: 'darvoza xatosi ajratilmagan');
    });

    test('Premium ekraniga olib boradigan tugma bor', () {
      expect(code, contains('Routes.settingsPremium'),
          reason: 'odam qayerga borishini bilmaydi');
      expect(code, contains('l.premiumBuy'));
    });

    test('har bir tur uchun ALOHIDA sabab yoziladi', () {
      expect(code, contains('l.premiumLockedVideo'));
      expect(code, contains('l.premiumLockedStory'));
      expect(code, contains('l.premiumLockedPost'));
    });
  });
}

/// TO'LOVLAR TARIXI — HAMMA SUMMA "0 so'm" EDI.
///
/// Server `/api/payments` da summani `price` deb yuboradi
/// (`hosting/api/account.js`), ekran esa `amount` ni o'qirdi —
/// bunday kalit javobda umuman yo'q.
void _historyTests() {
  group('To‘lovlar tarixi', () {
    /// Serverning AYNAN javobi.
    final row = <String, dynamic>{
      'id': 412,
      'kind': 'premium_upgrade',
      'code': 'PREMIUM',
      'price': 20000,
      'status': 'paid',
      'createdAt': '2026-09-20 10:00:00',
      'paymentProvider': 'payme',
    };

    testWidgets('summa KO‘RINADI, "0 so‘m" emas', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          shopRepositoryProvider.overrideWithValue(_HistoryRepo([row])),
        ],
        child: wrapScreen(const PaymentHistoryScreen()),
      ));
      await settle(tester);

      expect(find.textContaining('20 000'), findsOneWidget,
          reason: 'summa `price` dan o‘qilmadi');
      expect(find.text('0 so\'m'), findsNothing,
          reason: 'eski xato qaytib kelgan');
    });

    testWidgets('holat va sabab TARJIMA qilinadi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          shopRepositoryProvider.overrideWithValue(_HistoryRepo([
            row,
            {...row, 'id': 9, 'status': 'pending', 'price': 20000},
          ])),
        ],
        child: wrapScreen(const PaymentHistoryScreen()),
      ));
      await settle(tester);
      final l = await L.delegate.load(const Locale('uz'));

      // Odam "premium_upgrade" yoki "pending" degan xom so'zlarni
      // ko'rmasligi kerak.
      expect(find.text(l.payKindPremium), findsNWidgets(2));
      expect(find.text(l.payStatusPaid), findsOneWidget);
      expect(find.text(l.payStatusPending), findsOneWidget);
      expect(find.text('pending'), findsNothing);
      expect(find.text('premium_upgrade'), findsNothing);
      // Tugallanmagan to'lov shundayligini AYTADI.
      expect(find.text(l.payPendingHint), findsOneWidget);
    });
  });
}

class _HistoryRepo extends ShopRepository {
  _HistoryRepo(this.rows) : super(ApiClient());
  final List<Map<String, dynamic>> rows;

  @override
  Future<Result<List<Map<String, dynamic>>>> payments() async => Ok(rows);
}
