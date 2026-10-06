import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/nfc/ndef_payload.dart';
import 'package:nfcstore_nova/features/nfc/nfc_scan_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/nfc/scan_target.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// BEGONA NFC YORLIG'I — NFCSTORE'GA ULASH VA TOZALASH (egasi,
/// 2026-10-06).
///
///   * qulflanmagan begona yorliq: asosiy amal — "Profilimni yozish"
///     (kirmagan — ro'yxatdan o'tish, ID yo'q — avval ID), ikkinchi —
///     "Yorliqni tozalash";
///   * qulflangan: faqat "qulflangan" qatori;
///   * tozalash — aniq roziligdan keyin, FAQAT skanerlangan tegning
///     o'zi, qayta o'qib tasdiqlanadi.

// ── Soxta xizmat ──────────────────────────────────────────────────

class _Nfc extends NfcService {
  _Nfc(this.tag, {this.erase = const NfcWriteResult(ok: true)});

  final TagInspection tag;
  final NfcWriteResult erase;
  final erased = <String>[];

  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;

  @override
  Future<TagInspection> inspect({Duration timeout = const Duration(seconds: 30)}) async =>
      tag;

  @override
  Future<NfcWriteResult> eraseTag({
    required String expectIdentity,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    erased.add(expectIdentity);
    return erase;
  }

  @override
  Future<void> stop() async {}
}

TagInspection _foreign({bool writable = true, String text = 'https://example.com/menu'}) =>
    TagInspection(
      found: true,
      isNdef: true,
      writable: writable,
      maxSize: 144,
      identity: '04a20bff',
      records: [NdefRecordData(kind: NdefKind.uri, value: text)],
    );

Future<void> _pump(
  WidgetTester tester,
  NfcService nfc, {
  bool signedIn = true,
  bool hasId = true,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => const NfcScanScreen()),
    GoRoute(
        path: Routes.nfcWrite,
        builder: (_, __) => const Scaffold(body: Text('WRITE SCREEN'))),
    GoRoute(
        path: Routes.nfcIds,
        builder: (_, __) => const Scaffold(body: Text('IDS SCREEN'))),
  ]);
  final overrides = [
    ...await testOverrides(signedIn: signedIn),
    nfcServiceProvider.overrideWithValue(nfc),
  ];
  // ID'siz hisob: `testOverrides` dagi auth (1-o'rin) almashtiriladi.
  if (!hasId) {
    overrides[1] =
        authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: const []));
  }
  await tester.pumpWidget(ProviderScope(
    overrides: overrides,
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
}

Future<void> _scan(WidgetTester tester, L l) async {
  await tester.tap(find.text(l.nfcTapToScan).last);
  await settle(tester);
}

Future<void> _tapKey(WidgetTester tester, String key) async {
  final f = find.byKey(ValueKey(key));
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await settle(tester);
}

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void main() {
  group('amallarni tanlash (sof mantiq)', () {
    ForeignTagActions plan({
      bool isNdef = true,
      bool writable = true,
      bool formattable = false,
      bool hasContent = true,
      bool loggedIn = true,
      bool hasId = true,
      Uri? webUrl,
    }) =>
        foreignTagActions(
          isNdef: isNdef,
          writable: writable,
          formattable: formattable,
          hasContent: hasContent,
          loggedIn: loggedIn,
          hasId: hasId,
          webUrl: webUrl,
        );

    test('qulflanmagan begona: asosiy — profil yozish, tozalash bor', () {
      final a = plan(webUrl: Uri.parse('https://example.com'));
      expect(a.primary, ForeignPrimary.writeProfile);
      expect(a.canErase, isTrue);
      expect(a.locked, isFalse);
      expect(a.openUrl.toString(), 'https://example.com');
    });

    test('qulflangan begona: faqat ma’lumot', () {
      final a = plan(writable: false, webUrl: Uri.parse('https://example.com'));
      expect(a.primary, isNull);
      expect(a.canErase, isFalse);
      expect(a.locked, isTrue);
      expect(a.openUrl, isNotNull, reason: 'brauzer havolasi qoladi');
    });

    test('kirmagan: asosiy — ro‘yxatdan o‘tish; tozalash baribir bor', () {
      final a = plan(loggedIn: false, hasId: false);
      expect(a.primary, ForeignPrimary.signUp);
      expect(a.canErase, isTrue);
    });

    test('kirgan, NFC ID yo‘q: avval ID', () {
      expect(plan(hasId: false).primary, ForeignPrimary.getId);
    });

    test('qulflangan + kirmagan: ro‘yxatdan o‘tish taklif qilinmaydi', () {
      final a = plan(writable: false, loggedIn: false, hasId: false);
      expect(a.primary, isNull);
      expect(a.locked, isTrue);
    });

    test('formatlanmagan (formatlanadigan) teg: bo‘sh — tozalash yo‘q', () {
      final a = plan(isNdef: false, writable: false, formattable: true, hasContent: false);
      expect(a.primary, ForeignPrimary.writeProfile);
      expect(a.canErase, isFalse);
      expect(a.locked, isFalse);
    });

    test('NDEF ham emas, formatlanmaydi: hech qanday amal yo‘q', () {
      final a = plan(isNdef: false, writable: false, hasContent: false);
      expect(a.primary, isNull);
      expect(a.canErase, isFalse);
      expect(a.locked, isFalse);
    });

    test('bo‘sh, yoziladigan NDEF: tozalashga hojat yo‘q', () {
      final a = plan(hasContent: false);
      expect(a.primary, ForeignPrimary.writeProfile);
      expect(a.canErase, isFalse);
    });
  });

  group('tozalash xabari va tekshiruv', () {
    test('bitta bo‘sh yozuv (TNF empty)', () {
      final m = emptyNdefMessage();
      expect(m.records, hasLength(1));
      final r = m.records.single;
      expect(r.typeNameFormat, NdefTypeNameFormat.empty);
      expect(r.type, isEmpty);
      expect(r.identifier, isEmpty);
      expect(r.payload, isEmpty);
      // Qayta o'qilganda — "bo'sh".
      expect(
          looksErased([
            classifyRecord(
                typeNameFormat: r.typeNameFormat.index,
                type: r.type,
                payload: r.payload),
          ]),
          isTrue);
    });

    test('looksErased: matn qolsa — tozalanmagan', () {
      expect(looksErased(const []), isTrue);
      expect(
          looksErased(const [
            NdefRecordData(kind: NdefKind.unknown, value: ''),
            NdefRecordData(kind: NdefKind.text, value: 'Wi-Fi'),
          ]),
          isFalse);
    });

    test('TagInspection.text: URI/matn birinchi, keyin boshqasi', () {
      expect(_foreign().text, 'https://example.com/menu');
      const vcard = TagInspection(found: true, isNdef: true, records: [
        NdefRecordData(kind: NdefKind.unknown, value: ''),
        NdefRecordData(kind: NdefKind.vcard, value: 'BEGIN:VCARD'),
        NdefRecordData(kind: NdefKind.text, value: 'Salom'),
      ]);
      expect(vcard.text, 'Salom');
      const onlyVcard = TagInspection(found: true, isNdef: true, records: [
        NdefRecordData(kind: NdefKind.vcard, value: 'BEGIN:VCARD'),
      ]);
      expect(onlyVcard.text, 'BEGIN:VCARD');
      expect(const TagInspection(found: true).text, isNull);
    });

    test('iPhone MiFare (NTAG) identifikatori ham o‘qiladi', () {
      expect(tagIdentity({'mifare': {'identifier': [0x04, 0xA2]}}), '04a2');
    });

    test('erasePreview: qisqartiriladi, bo‘shliqlar yig‘iladi', () {
      expect(erasePreview('  a \n b  '), 'a b');
      expect(erasePreview('x' * 120), '${'x' * 90}…');
    });
  });

  group('eraseTag — xizmat (soxta sessiya, soxta kanal)', () {
    const channel = MethodChannel('plugins.flutter.io/nfc_manager');
    late List<MethodCall> calls;
    Object? readBack;

    setUp(() {
      calls = [];
      readBack = null;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        calls.add(call);
        if (call.method == 'Ndef#write') {
          readBack ??= (call.arguments as Map)['message'];
          return null;
        }
        if (call.method == 'Ndef#read') return readBack;
        return null;
      });
    });
    tearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null));

    NfcService serviceWith(NfcTag tag) => NfcService(
          startSession: ({
            required NfcTagCallback onDiscovered,
            Set<NfcPollingOption>? pollingOptions,
            NfcErrorCallback? onError,
          }) async {
            await onDiscovered(tag);
          },
          stopSession: () async {},
        );

    NfcTag ndefTag({String key = 'nfca', List<int> id = const [4, 162, 11, 255], bool writable = true}) =>
        NfcTag(handle: 'h1', data: {
          key: {'identifier': Uint8List.fromList(id)},
          'ndef': {'isWritable': writable, 'maxSize': 144, 'cachedMessage': null},
        });

    test('o‘sha teg: bo‘sh yozuv yoziladi va qayta o‘qib tasdiqlanadi', () async {
      final r = await serviceWith(ndefTag()).eraseTag(expectIdentity: '04a20bff');
      expect(r.ok, isTrue);
      expect(calls.map((c) => c.method), ['Ndef#write', 'Ndef#read']);
      final records = ((calls.first.arguments as Map)['message'] as Map)['records'] as List;
      expect(records, hasLength(1));
      expect((records.single as Map)['typeNameFormat'], 0x00);
      expect((records.single as Map)['payload'], isEmpty);
    });

    test('iPhone (mifare): boshqa teg — tegilmaydi', () async {
      final r = await serviceWith(ndefTag(key: 'mifare', id: const [1, 2, 3]))
          .eraseTag(expectIdentity: '04a20bff');
      expect([r.ok, r.error], [false, TagError.differentTag]);
      expect(calls, isEmpty, reason: 'hech narsa yozilmadi');
    });

    test('qulflangan teg — readOnly, yozilmaydi', () async {
      final r = await serviceWith(ndefTag(writable: false))
          .eraseTag(expectIdentity: '04a20bff');
      expect([r.ok, r.error], [false, TagError.readOnly]);
      expect(calls, isEmpty);
    });

    test('qayta o‘qishda matn qoldi — verifyFailed', () async {
      readBack = {
        'records': [
          {
            'typeNameFormat': 0x01,
            'type': Uint8List.fromList([0x54]),
            'identifier': Uint8List(0),
            'payload': encodeTextPayload('eski'),
          }
        ]
      };
      final r = await serviceWith(ndefTag()).eraseTag(expectIdentity: '04a20bff');
      expect([r.ok, r.error], [false, TagError.verifyFailed]);
    });

    test('formatlanmagan teg — allaqachon bo‘sh, hech narsa yozilmaydi', () async {
      final tag = NfcTag(handle: 'h2', data: {
        'nfca': {'identifier': Uint8List.fromList(const [4, 162, 11, 255])},
        'ndefformatable': {'identifier': Uint8List.fromList(const [4, 162, 11, 255])},
      });
      final r = await serviceWith(tag).eraseTag(expectIdentity: '04a20bff');
      expect(r.ok, isTrue);
      expect(calls, isEmpty);
    });

    test('iPhone "Bekor qilish" — cancelled', () async {
      final nfc = NfcService(
        startSession: ({
          required NfcTagCallback onDiscovered,
          Set<NfcPollingOption>? pollingOptions,
          NfcErrorCallback? onError,
        }) async {
          await onError?.call(
              const NfcError(type: NfcErrorType.userCanceled, message: ''));
        },
        stopSession: () async {},
      );
      final r = await nfc.eraseTag(expectIdentity: 'x');
      expect([r.ok, r.error], [false, TagError.cancelled]);
      expect(nfc.lastCancelled, isTrue);
    });
  });

  group('skaner ekrani', () {
    testWidgets('qulflanmagan begona: yozish asosiy, tozalash ikkinchi, havola',
        (tester) async {
      await _pump(tester, _Nfc(_foreign()));
      final l = await _uz();
      await _scan(tester, l);
      expect(find.text(l.nfcNotNfcstore), findsOneWidget);
      expect(find.text(l.nfcForeignWritableHint), findsOneWidget);
      expect(find.text(l.nfcForeignWrite), findsOneWidget);
      expect(find.text(l.nfcEraseAction), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign-open')), findsOneWidget);
      // Tartib: yozish → tozalash → brauzer havolasi.
      double y(String k) => tester.getTopLeft(find.byKey(ValueKey(k))).dy;
      expect(y('nfc-foreign-write'), lessThan(y('nfc-foreign-erase')));
      expect(y('nfc-foreign-erase'), lessThan(y('nfc-foreign-open')));

      await _tapKey(tester, 'nfc-foreign-write');
      expect(find.text('WRITE SCREEN'), findsOneWidget);
    });

    testWidgets('qulflangan begona: faqat ma’lumot, tozalash yo‘q',
        (tester) async {
      await _pump(tester, _Nfc(_foreign(writable: false)));
      final l = await _uz();
      await _scan(tester, l);
      expect(find.text(l.nfcForeignLocked), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign-erase')), findsNothing);
      expect(find.byKey(const ValueKey('nfc-foreign-write')), findsNothing);
      expect(find.text(l.nfcForeignWritableHint), findsNothing);
    });

    testWidgets('NFC ID yo‘q: "Avval NFC ID oling" → ID\'lar ekrani',
        (tester) async {
      await _pump(tester, _Nfc(_foreign()), hasId: false);
      final l = await _uz();
      await _scan(tester, l);
      expect(find.text(l.nfcForeignGetId), findsOneWidget);
      await _tapKey(tester, 'nfc-foreign-write');
      expect(find.text('IDS SCREEN'), findsOneWidget);
    });

    testWidgets('kirmagan: "Ro‘yxatdan o‘tib yozish" → yozish manzili (router '
        'kirishga buradi va keyin qaytaradi)', (tester) async {
      await _pump(tester, _Nfc(_foreign()), signedIn: false);
      final l = await _uz();
      await _scan(tester, l);
      expect(find.text(l.nfcForeignSignUp), findsOneWidget);
      expect(find.text(l.nfcEraseAction), findsOneWidget);
      await _tapKey(tester, 'nfc-foreign-write');
      expect(find.text('WRITE SCREEN'), findsOneWidget);
    });

    testWidgets('bo‘sh yoziladigan teg: xato emas, profil yozish taklifi',
        (tester) async {
      await _pump(
          tester,
          _Nfc(const TagInspection(
              found: true, isNdef: false, formattable: true, identity: '04aa')));
      final l = await _uz();
      await _scan(tester, l);
      expect(find.text(l.nfcTagBlank), findsOneWidget);
      expect(find.text(l.nfcScanFailed), findsNothing);
      expect(find.text(l.nfcForeignWrite), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign-erase')), findsNothing);
    });

    testWidgets('tozalash: oyna → "Bekor qilish" — hech narsa bo‘lmaydi',
        (tester) async {
      final nfc = _Nfc(_foreign());
      await _pump(tester, nfc);
      final l = await _uz();
      await _scan(tester, l);
      await _tapKey(tester, 'nfc-foreign-erase');
      expect(find.byKey(const ValueKey('nfc-erase-dialog')), findsOneWidget);
      expect(find.text(l.nfcEraseTitle), findsOneWidget);
      expect(find.text(l.nfcEraseBody), findsOneWidget);
      // Nima o'chishi ko'rsatiladi.
      expect(
          find.descendant(
              of: find.byKey(const ValueKey('nfc-erase-dialog')),
              matching: find.text('https://example.com/menu')),
          findsOneWidget);
      await tester.tap(find.text(l.actionCancel));
      await settle(tester);
      expect(nfc.erased, isEmpty);
      expect(find.text(l.nfcNotNfcstore), findsOneWidget);
    });

    testWidgets('tozalash: "Ha, tozalash" → o‘sha teg tozalanadi, natija',
        (tester) async {
      final nfc = _Nfc(_foreign());
      await _pump(tester, nfc);
      final l = await _uz();
      await _scan(tester, l);
      await _tapKey(tester, 'nfc-foreign-erase');
      await tester.tap(find.byKey(const ValueKey('nfc-erase-confirm')));
      await settle(tester);
      expect(nfc.erased, ['04a20bff'], reason: 'skanerlangan tegning o‘zi');
      expect(find.text(l.nfcEraseDone), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign')), findsNothing);
      // Endi bo'sh — profil yozish taklifi, tozalash yo'q.
      expect(find.text(l.nfcForeignWrite), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign-erase')), findsNothing);
    });

    testWidgets('tozalash: boshqa teg — xato, mazmun joyida', (tester) async {
      final nfc = _Nfc(_foreign(),
          erase: const NfcWriteResult(ok: false, error: TagError.differentTag));
      await _pump(tester, nfc);
      final l = await _uz();
      await _scan(tester, l);
      await _tapKey(tester, 'nfc-foreign-erase');
      await tester.tap(find.byKey(const ValueKey('nfc-erase-confirm')));
      await settle(tester);
      expect(find.text(l.nfcWriteErrDifferentTag), findsOneWidget);
      expect(find.byKey(const ValueKey('nfc-foreign')), findsOneWidget);
      expect(find.text(l.nfcEraseDone), findsNothing);
    });

    testWidgets('tozalash: iPhone "Bekor qilish" — jim', (tester) async {
      final nfc = _Nfc(_foreign(),
          erase: const NfcWriteResult(ok: false, error: TagError.cancelled));
      await _pump(tester, nfc);
      final l = await _uz();
      await _scan(tester, l);
      await _tapKey(tester, 'nfc-foreign-erase');
      await tester.tap(find.byKey(const ValueKey('nfc-erase-confirm')));
      await settle(tester);
      expect(find.byKey(const ValueKey('nfc-erase-error')), findsNothing);
      expect(find.byKey(const ValueKey('nfc-foreign-erase')), findsOneWidget);
    });
  });

  test('uch tilda yangi matnlar bor', () async {
    for (final c in ['uz', 'ru', 'en']) {
      final l = await L.delegate.load(Locale(c));
      for (final s in [
        l.nfcForeignWritableHint,
        l.nfcForeignLocked,
        l.nfcTagBlank,
        l.nfcBlankHint,
        l.nfcForeignWrite,
        l.nfcForeignGetId,
        l.nfcForeignSignUp,
        l.nfcEraseAction,
        l.nfcEraseTitle,
        l.nfcEraseBody,
        l.nfcEraseConfirm,
        l.nfcEraseTapAgain,
        l.nfcEraseDone,
        l.nfcEraseErrVerify,
      ]) {
        expect(s.trim(), isNotEmpty, reason: c);
      }
    }
  });
}
