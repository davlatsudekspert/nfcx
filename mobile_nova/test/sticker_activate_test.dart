import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/nfc_repository.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/nfc_id_hero.dart';
import 'package:nfcstore_nova/features/nfc/nfc_misc_screens.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/nfc/sticker_activate_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// ILOVADA TOPILGAN KAMCHILIKLAR (egasi, 2026-09-26):
///
///   * sotib olingan stikerni ilovada ulab bo'lmasdi — faqat saytda;
///   * o'chirilgan stiker ilovada skanerlansa baribir ochilardi;
///   * ulanmagan stikerga tekkizilsa bosh sahifaga tashlardi;
///   * "Kartalar" da biznesga ulangan stiker kodi ko'rinmasdi;
///   * Ivory'da NFC ID kartasi saytdagi kabi qora emas edi.
class _Nfc extends NfcRepository {
  _Nfc({
    this.checkError,
    this.options = const ActivationOptions(
      personal: [(code: 'ALI777', name: 'Ali', isPrimary: true)],
    ),
    this.devicesList = const [],
  }) : super(ApiClient());

  final String? checkError;
  final ActivationOptions options;
  final List<NfcDevice> devicesList;

  final checks = <String>[];
  final activations = <Map<String, Object>>[];
  final attaches = <(String, String)>[];

  @override
  Future<Result<ActivationCheck>> activationCheck(String code) async {
    checks.add(code);
    if (checkError != null) {
      return Err(AppError(AppErrorKind.conflict, code: checkError));
    }
    return const Ok(ActivationCheck(productName: 'NFC stiker'));
  }

  @override
  Future<Result<ActivationOptions>> activationOptions() async => Ok(options);

  @override
  Future<Result<ActivationResult>> activateSticker({
    required String code,
    required bool business,
    String profileCode = '',
    String companyId = '',
    String deviceToken = '',
  }) async {
    activations.add({
      'code': code,
      'business': business,
      'profileCode': profileCode,
      'companyId': companyId,
      'deviceToken': deviceToken,
    });
    return Ok(ActivationResult(
      profileKind: business ? 'business' : 'personal',
      profileCode: business ? companyId : profileCode,
      deviceBound: deviceToken.isNotEmpty,
    ));
  }

  @override
  Future<Result<ActivationResult>> attachSticker({
    required String deviceToken,
    String code = '',
  }) async {
    attaches.add((deviceToken, code));
    return const Ok(ActivationResult(deviceBound: true));
  }

  @override
  Future<Result<List<NfcDevice>>> devices() async => Ok(devicesList);
}

class _TapNfc extends NfcService {
  _TapNfc(this.payload);
  final String? payload;

  @override
  Future<String?> readOnce({Duration timeout = const Duration(seconds: 30)}) async =>
      payload;

  @override
  Future<void> stop() async {}
}

void main() {
  final l = LUz();

  group('kod formati (NF-XXXX-XXXX)', () {
    test('odam faqat 8 belgini teradi — prefiks va chiziqchalar o‘zi', () {
      expect(formatActivationCode(''), '');
      expect(formatActivationCode('a'), 'NF-A');
      expect(formatActivationCode('abcd'), 'NF-ABCD');
      expect(formatActivationCode('abcde'), 'NF-ABCD-E');
      expect(formatActivationCode('ab cd ef gh'), 'NF-ABCD-EFGH');
      expect(formatActivationCode('abcdefghij'), 'NF-ABCD-EFGH',
          reason: '8 belgidan ortig‘i kesiladi');
    });

    test('butun kod prefiksi bilan joylansa — prefiks ikki marta chiqmaydi', () {
      expect(formatActivationCode('NF-ABCD-EFGH'), 'NF-ABCD-EFGH');
      expect(formatActivationCode('nf-abcd-efgh'), 'NF-ABCD-EFGH');
      expect(formatActivationCode('NFABCDEFGH'), 'NF-ABCD-EFGH');
    });

    test('kodning O‘ZI "NF" bilan boshlansa ham buzilmaydi (server qoidasi)', () {
      expect(formatActivationCode('NFXY'), 'NF-NFXY');
      expect(formatActivationCode('NF-NFXY-ZZZZ'), 'NF-NFXY-ZZZZ');
      // Har bir tugma bosilishida formatlagich o'z natijasini qayta oladi.
      var v = '';
      for (final ch in 'NFXYZZZZ'.split('')) {
        v = formatActivationCode(v + ch);
      }
      expect(v, 'NF-NFXY-ZZZZ');
    });
  });

  group('stiker tokeni NFC yozuvidan', () {
    test('NFCSTORE stikeri', () {
      expect(stickerTokenFromPayload('https://nfcstore.uz/t/abc_123'), 'abc_123');
      expect(stickerTokenFromPayload('https://www.nfcstore.uz/t/Xy-9'), 'Xy-9');
      expect(stickerTokenFromPayload('https://nfcstore.uz/tap/abc'), 'abc');
    });

    test('boshqa narsa — null', () {
      expect(stickerTokenFromPayload(null), isNull);
      expect(stickerTokenFromPayload(''), isNull);
      expect(stickerTokenFromPayload('https://evil.uz/t/abc'), isNull);
      expect(stickerTokenFromPayload('https://nfcstore.uz/u/ALI777'), isNull);
      expect(stickerTokenFromPayload('https://nfcstore.uz/t/'), isNull);
      expect(stickerTokenFromPayload('https://nfcstore.uz/t/a%20b'), isNull);
    });
  });

  group('server javoblari', () {
    test('/api/tap: ulanmagan, o‘chirilgan, noma‘lum, biznes', () {
      final unlinked = ChipLookup.fromJson(
          {'found': true, 'active': false, 'linkedCode': null, 'linkedCompanyId': null});
      expect(unlinked.unlinked, isTrue);

      final off = ChipLookup.fromJson(
          {'found': true, 'active': false, 'linkedCode': 'ALI777'});
      expect(off.unlinked, isFalse);
      expect(off.active, isFalse);

      final unknown = ChipLookup.fromJson({'found': false, 'active': true});
      expect(unknown.found, isFalse);
      expect(unknown.unlinked, isFalse);

      final biz = ChipLookup.fromJson(
          {'found': true, 'active': true, 'linkedCode': null, 'linkedCompanyId': 'C-KAFE1'});
      expect(biz.company, isTrue);
      expect(biz.code, 'C-KAFE1');
    });

    test('faollashtirish: check / options / natija', () {
      final c = ActivationCheck.fromJson({
        'ok': true,
        'product': {'name': 'Avto stiker'},
      });
      expect(c.productName, 'Avto stiker');
      expect(c.already, isNull);

      final a = ActivationCheck.fromJson({
        'ok': true,
        'alreadyActivated': true,
        'result': {'profileKind': 'business', 'profileCode': 'C-KAFE1'},
      });
      expect(a.already?.business, isTrue);
      expect(a.already?.profileCode, 'C-KAFE1');

      final o = ActivationOptions.fromJson({
        'personal': [
          {'code': 'ALI777', 'name': 'Ali', 'isPrimary': true},
          {'code': '', 'name': 'bo‘sh'},
        ],
        'business': [
          {'companyId': 'C-KAFE1', 'displayName': 'Kafe', 'status': 'active'},
        ],
      });
      expect(o.personal.single.code, 'ALI777');
      expect(o.personal.single.isPrimary, isTrue);
      expect(o.business.single.name, 'Kafe');

      final r = ActivationResult.fromJson(
          {'profileKind': 'personal', 'profileCode': 'ALI777', 'deviceBound': true});
      expect(r.business, isFalse);
      expect(r.deviceBound, isTrue);
    });

    test('Kartalar: biznes stikeri kompaniya ID si bilan o‘qiladi', () {
      final d = NfcDevice.fromJson({
        'id': 5,
        'tokenTail': 'AB12',
        'linkedCode': null,
        'linkedName': null,
        'linkedCompanyId': 'C-KAFE1',
        'linkedCompanyName': 'Kafe Nur',
        'active': 1,
      });
      expect(d.business, isTrue);
      expect(d.companyId, 'C-KAFE1');
      expect(d.label, 'Kafe Nur');
      expect(d.code, isEmpty);
    });

    test('so‘rov kalitlari server bilan bir xil (marketplace.js)', () {
      final repo = File('lib/data/repositories/nfc_repository.dart').readAsStringSync();
      final server = File('../hosting/api/marketplace.js').readAsStringSync();
      for (final path in [
        "'/api/activate/check'",
        "'/api/activate/options'",
        "'/api/activate'",
        "'/api/activate/attach-sticker'",
      ]) {
        expect(repo, contains(path));
        expect(server, contains(path));
      }
      for (final key in ['profileKind', 'profileCode', 'companyId', 'deviceToken']) {
        expect(repo, contains("'$key'"));
        expect(server, contains('body.$key'));
      }
    });
  });

  group('ilovadagi yo‘naltirish', () {
    tearDown(disposeTestContainers);

    test('yangi manzillar routerda bor', () {
      final router = buildTestRouter();
      expect(routeExists(router, '/nfc/activate'), isTrue);
      expect(routeExists(router, '/nfc/activate?d=abc_123'), isTrue);
      expect(routeExists(router, '/nfc/sticker/off'), isTrue);
      expect(routeExists(router, '/nfc/sticker/unknown'), isTrue);
    });

    test('ulanmagan va o‘chirilgan stiker profilni ochmaydi', () {
      final router = File('lib/routing/router.dart').readAsStringSync();
      expect(router, contains('chip.unlinked'));
      expect(router, contains("Routes.stickerStatus('off')"));
      expect(router, contains("Routes.stickerStatus('unknown')"));
      expect(router, isNot(contains('chip.code.isEmpty) return Routes.home')));
      final scan = File('lib/features/nfc/nfc_scan_screen.dart').readAsStringSync();
      expect(scan, contains('chip.unlinked'));
      expect(scan, contains('!chip.active'));
    });
  });

  group('faollashtirish ekrani', () {
    Future<_Nfc> pump(WidgetTester tester, _Nfc nfc,
        {String deviceToken = '', NfcService? service}) async {
      tester.view.physicalSize = const Size(390 * 3, 900 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          nfcRepositoryProvider.overrideWithValue(nfc),
          if (service != null) nfcServiceProvider.overrideWithValue(service),
        ],
        child: wrapScreen(StickerActivateScreen(deviceToken: deviceToken)),
      ));
      await settle(tester);
      return nfc;
    }

    Future<void> tapText(WidgetTester tester, String text) async {
      final f = find.text(text).first;
      await tester.ensureVisible(f);
      await tester.tap(f);
      await settle(tester);
    }

    Future<void> tapKey(WidgetTester tester, String key) async {
      final f = find.byKey(ValueKey(key));
      await tester.ensureVisible(f);
      await tester.tap(f);
      await settle(tester);
    }

    testWidgets('yarim kod serverga ketmaydi', (tester) async {
      final nfc = await pump(tester, _Nfc());
      await tester.enterText(find.byKey(const ValueKey('activate-code')), 'abcd');
      await settle(tester);
      await tapText(tester, l.actionContinue);
      expect(nfc.checks, isEmpty);
      expect(find.text(l.activateErrBadCode), findsOneWidget);
    });

    testWidgets('server xatosi tushunarli matnda', (tester) async {
      await pump(tester, _Nfc(checkError: 'code_expired'));
      await tester.enterText(
          find.byKey(const ValueKey('activate-code')), 'abcdefgh');
      await settle(tester);
      await tapText(tester, l.actionContinue);
      expect(find.text(l.activateErrExpired), findsOneWidget);
    });

    testWidgets('shaxsiy ID ga to‘liq oqim, keyin stikerni tekkizish',
        (tester) async {
      final nfc = await pump(tester, _Nfc(),
          service: _TapNfc('https://nfcstore.uz/t/abc_123'));
      await tester.enterText(
          find.byKey(const ValueKey('activate-code')), 'ab cd ef gh');
      await settle(tester);
      expect(find.text('NF-ABCD-EFGH'), findsOneWidget);

      await tapText(tester, l.actionContinue);
      expect(nfc.checks, ['NF-ABCD-EFGH']);
      expect(find.text(l.activateKindTitle), findsOneWidget);

      await tapText(tester, l.actionContinue);
      // Asosiy ID oldindan tanlangan.
      expect(find.text('ALI777'), findsOneWidget);

      await tapKey(tester, 'activate-submit');
      expect(nfc.activations.single['business'], isFalse);
      expect(nfc.activations.single['profileCode'], 'ALI777');
      expect(nfc.activations.single['deviceToken'], '');
      expect(find.text(l.activateDoneTitle), findsOneWidget);
      expect(find.text(l.activateDoneTapNow), findsOneWidget);

      await tapKey(tester, 'activate-tap');
      expect(nfc.attaches.single, ('abc_123', 'NF-ABCD-EFGH'));
      expect(find.text(l.activateAttached), findsOneWidget);
      expect(find.byKey(const ValueKey('activate-tap')), findsNothing);
    });

    testWidgets('tekkizib kelgan stiker shu amalda bog‘lanadi', (tester) async {
      final nfc = await pump(tester, _Nfc(), deviceToken: 'tok_9');
      expect(find.text(l.activateStickerTapped), findsOneWidget);
      await tester.enterText(
          find.byKey(const ValueKey('activate-code')), 'abcdefgh');
      await settle(tester);
      await tapText(tester, l.actionContinue);
      await tapText(tester, l.actionContinue);
      await tapKey(tester, 'activate-submit');
      expect(nfc.activations.single['deviceToken'], 'tok_9');
      expect(find.text(l.activateDoneBound), findsOneWidget);
      expect(find.byKey(const ValueKey('activate-tap')), findsNothing);
    });

    testWidgets('biznes: kompaniya tanlanadi', (tester) async {
      final nfc = await pump(
          tester,
          _Nfc(
            options: const ActivationOptions(
                business: [(companyId: 'C-KAFE1', name: 'Kafe Nur')]),
          ));
      await tester.enterText(
          find.byKey(const ValueKey('activate-code')), 'abcdefgh');
      await settle(tester);
      await tapText(tester, l.actionContinue);
      await tapKey(tester, 'activate-business');
      await tapText(tester, l.actionContinue);
      expect(find.text('Kafe Nur'), findsOneWidget);
      await tapKey(tester, 'activate-submit');
      expect(nfc.activations.single['business'], isTrue);
      expect(nfc.activations.single['companyId'], 'C-KAFE1');
      expect(find.text('C-KAFE1'), findsOneWidget);
    });

    testWidgets('biznesi yo‘q — kompaniya ochish taklifi, faollashtirish yo‘q',
        (tester) async {
      await pump(tester, _Nfc(options: const ActivationOptions()));
      await tester.enterText(
          find.byKey(const ValueKey('activate-code')), 'abcdefgh');
      await settle(tester);
      await tapText(tester, l.actionContinue);
      await tapKey(tester, 'activate-business');
      await tapText(tester, l.actionContinue);
      expect(find.text(l.activateNoCompany), findsOneWidget);
      expect(find.text(l.activateCreateCompany), findsOneWidget);
      expect(find.byKey(const ValueKey('activate-submit')), findsNothing);
    });
  });

  group('Kartalar', () {
    Future<void> pump(WidgetTester tester, List<NfcDevice> items) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          nfcRepositoryProvider.overrideWithValue(_Nfc(devicesList: items)),
        ],
        child: wrapScreen(const NfcCardsScreen()),
      ));
      await settle(tester);
    }

    testWidgets('biznesga ulangan stiker kodi ko‘rinadi', (tester) async {
      await pump(tester, const [
        NfcDevice(id: 1, label: 'Kafe Nur', companyId: 'C-KAFE1'),
        NfcDevice(id: 2, label: 'Ali', code: 'ALI777'),
      ]);
      expect(find.text('${l.cardLinkedBusiness} · C-KAFE1'), findsOneWidget);
      expect(find.text('ALI777'), findsOneWidget);
      expect(find.byIcon(Icons.storefront_rounded), findsOneWidget);
      expect(find.byTooltip(l.stickerActivate), findsOneWidget);
    });

    testWidgets('bo‘sh ro‘yxatda — faollashtirish tugmasi', (tester) async {
      await pump(tester, const []);
      expect(find.text(l.stickerActivate), findsOneWidget);
    });
  });

  testWidgets('Ivory: NFC ID kartasi qora (saytdagi namuna karta kabi)',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    Future<List<Color>> cardColors(NfcTokens tokens) async {
      await tester.pumpWidget(wrapScreen(
        const Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: NfcIdHeroCard(code: 'ALI777', eyebrow: 'NFC ID', name: 'Ali'),
          ),
        ),
        tokens: tokens,
      ));
      await settle(tester);
      final boxes = tester
          .widgetList<Container>(find.descendant(
              of: find.byType(NfcIdHeroCard), matching: find.byType(Container)))
          .map((c) => c.decoration)
          .whereType<BoxDecoration>()
          .where((d) => d.gradient is LinearGradient);
      return (boxes.first.gradient! as LinearGradient).colors;
    }

    final ivory = await cardColors(NfcTokens.ivory);
    for (final c in ivory) {
      expect(c.computeLuminance(), lessThan(.05),
          reason: 'Ivory kartasi qora bo‘lishi kerak');
    }
    // Boshqa mavzular o'z ko'rinishida qoladi.
    final pearl = await cardColors(NfcTokens.pearl);
    expect(pearl.first.computeLuminance(), greaterThan(.5));
  });
}
