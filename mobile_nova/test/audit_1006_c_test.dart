import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/nfc/ndef_payload.dart';
import 'package:nfcstore_nova/features/nfc/nfc_scan_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/nfc/scan_target.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// AUDIT 2026-10-06 (3-qism): iPhone'da NFC "Bekor qilish" ekranni 30 s
/// qotirmaydi; begona yorliq begona profilni ochmaydi.

/// Soxta `startSession`: darhol `onError` chaqiradi (iOS tizim oynasi
/// yopilganidek).
NfcService _closing(NfcErrorType type, List<String> log) => NfcService(
      startSession: ({
        required NfcTagCallback onDiscovered,
        Set<NfcPollingOption>? pollingOptions,
        NfcErrorCallback? onError,
      }) async {
        log.add('start');
        await onError?.call(NfcError(type: type, message: type.name));
      },
      stopSession: () async => log.add('stop'),
    );

class _Nfc extends NfcService {
  _Nfc(this.payload, {this.cancelled = false});
  final String? payload;
  final bool cancelled;

  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;

  // Skaner `inspect` orqali o'qiydi: matn + teg holati.
  @override
  Future<TagInspection> inspect({Duration timeout = const Duration(seconds: 30)}) async {
    lastCancelled = cancelled;
    final p = payload;
    if (p == null) {
      return TagInspection(
          found: false,
          error: cancelled ? TagError.cancelled : TagError.timeout);
    }
    return TagInspection(
      found: true,
      isNdef: true,
      writable: true,
      identity: '04aa',
      records: [
        NdefRecordData(
            kind: p.contains(':') ? NdefKind.uri : NdefKind.text, value: p),
      ],
    );
  }
}

Future<GoRouter> _pump(WidgetTester tester, NfcService nfc) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => const NfcScanScreen()),
    GoRoute(
        path: '/c/:id',
        builder: (_, s) => Scaffold(body: Text('STORE ${s.pathParameters['id']}'))),
    GoRoute(
        path: '/u/:code',
        builder: (_, s) => Scaffold(body: Text('USER ${s.pathParameters['code']}'))),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      nfcServiceProvider.overrideWithValue(nfc),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  ));
  await settle(tester);
  return router;
}

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void main() {
  group('5. iPhone NFC: bekor qilish darhol tugaydi', () {
    test('readOnce — null, lastCancelled, stopSession chaqirilmaydi',
        () async {
      final log = <String>[];
      final nfc = _closing(NfcErrorType.userCanceled, log);
      final sw = Stopwatch()..start();
      final r = await nfc.readOnce();
      expect(r, isNull);
      expect(nfc.lastCancelled, isTrue);
      expect(sw.elapsed, lessThan(const Duration(seconds: 2)),
          reason: '30 s kutilmadi');
      expect(log, ['start'], reason: 'tizim yopgan sessiya qayta yopilmaydi');
      // Keyingi o'qish yangi sessiya ochadi (`_sessionOpen` qaytarildi).
      await nfc.readOnce();
      expect(log, ['start', 'start']);
    });

    test('inspect / write — TagError.cancelled', () async {
      final nfc = _closing(NfcErrorType.userCanceled, []);
      expect((await nfc.inspect()).error, TagError.cancelled);
      final w = await nfc.writeProfileUrl(url: 'https://nfcstore.uz/u/ABC123');
      expect([w.ok, w.error], [false, TagError.cancelled]);
    });

    test('tizim vaqti tugadi — timeout, bekor emas', () async {
      final nfc = _closing(NfcErrorType.sessionTimeout, []);
      expect((await nfc.inspect()).error, TagError.timeout);
      expect(nfc.lastCancelled, isFalse);
    });

    testWidgets('skaner ekrani: "Bekor qilindi", xato emas', (tester) async {
      await _pump(tester, _Nfc(null, cancelled: true));
      final l = await _uz();
      await tester.tap(find.text(l.nfcTapToScan).last);
      await settle(tester);
      expect(find.text(l.nfcCancelled), findsOneWidget);
      expect(find.text(l.nfcScanFailed), findsNothing);
    });
  });

  group('7. faqat NFCSTORE yorliqlari ichkariga olib kiradi', () {
    test('tasniflash', () {
      expect(classifyScan('https://nfcstore.uz/t/TOK1'), isA<ScanChip>());
      expect((classifyScan('https://www.nfcstore.uz/u/abc123') as ScanProfile).code,
          'ABC123');
      expect((classifyScan('https://nfcstore.uz/48210377') as ScanProfile).code,
          '48210377');
      expect((classifyScan('https://nfcstore.uz/c/KARTAUZ') as ScanRoute).location,
          '/c/KARTAUZ');
      expect((classifyScan('https://nfcstore.uz/post/5') as ScanRoute).location,
          '/post/5');
      expect((classifyScan('nfcstore://u/ABC123') as ScanProfile).code, 'ABC123');

      final f = classifyScan('https://example.com/menu');
      expect(f, isA<ScanForeign>());
      expect((f as ScanForeign).webUrl.toString(), 'https://example.com/menu');
      // Soxta xost (nfcstore.uz.evil.com) — begona.
      expect(classifyScan('https://nfcstore.uz.evil.com/u/ABC'), isA<ScanForeign>());
      final txt = classifyScan('Salom dunyo') as ScanForeign;
      expect(txt.webUrl, isNull);
      expect(classifyScan('MENU'), isA<ScanForeign>(),
          reason: 'oddiy matn profil kodi deb olinmaydi');
      expect(classifyScan('tel:+998901234567'), isA<ScanForeign>());
    });

    testWidgets('begona URL: profil OCHILMAYDI, mazmun va brauzer tugmasi',
        (tester) async {
      final opened = <Uri>[];
      openLinkOverride = (u) async {
        opened.add(u);
        return true;
      };
      addTearDown(() => openLinkOverride = null);
      await _pump(tester, _Nfc('https://example.com/menu'));
      final l = await _uz();
      await tester.tap(find.text(l.nfcTapToScan).last);
      await settle(tester);
      expect(find.text(l.nfcNotNfcstore), findsOneWidget);
      expect(find.text('https://example.com/menu'), findsOneWidget);
      expect(find.textContaining('USER'), findsNothing);
      expect(find.text('MENU'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('nfc-foreign-open')));
      await settle(tester);
      expect(opened.single.toString(), 'https://example.com/menu');
    });

    testWidgets('begona matn: brauzer tugmasi yo‘q', (tester) async {
      await _pump(tester, _Nfc('Wi-Fi: parol 12345'));
      final l = await _uz();
      await tester.tap(find.text(l.nfcTapToScan).last);
      await settle(tester);
      expect(find.text(l.nfcNotNfcstore), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign-open')), findsNothing);
    });

    testWidgets('nfcstore.uz/c/... — do‘kon sahifasi (router yo‘li)',
        (tester) async {
      await _pump(tester, _Nfc('https://nfcstore.uz/c/KARTAUZ'));
      final l = await _uz();
      await tester.tap(find.text(l.nfcTapToScan).last);
      await settle(tester);
      expect(find.text('STORE KARTAUZ'), findsOneWidget);
    });

    testWidgets('nfcstore.uz/<KOD> — profil kodi chiqadi', (tester) async {
      await _pump(tester, _Nfc('https://nfcstore.uz/48210377'));
      final l = await _uz();
      await tester.tap(find.text(l.nfcTapToScan).last);
      await settle(tester);
      expect(find.text('48210377'), findsOneWidget);
      expect(find.text(l.nfcScanSuccess), findsOneWidget);
      expect(Routes.user('48210377'), contains('48210377'));
    });
  });
}
