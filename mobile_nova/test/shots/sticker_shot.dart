@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader, rootBundle;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/nfc_repository.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/nfc_id_hero.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_misc_screens.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/nfc/sticker_activate_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import '../helpers.dart' hide wrapScreen;

/// STIKERNI FAOLLASHTIRISH — egasiga ko'rsatish uchun suratlar.
class _Nfc extends NfcRepository {
  _Nfc() : super(ApiClient());

  @override
  Future<Result<ActivationCheck>> activationCheck(String code) async =>
      const Ok(ActivationCheck(productName: 'NFC avto stiker'));

  @override
  Future<Result<ActivationOptions>> activationOptions() async =>
      const Ok(ActivationOptions(
        personal: [
          (code: 'ALI777', name: 'Ali Valiyev', isPrimary: true),
          (code: '38479396', name: 'Ali Valiyev', isPrimary: false),
        ],
        business: [(companyId: 'NAMUNAKAFE', name: 'Namuna Kafe')],
      ));

  @override
  Future<Result<ActivationResult>> activateSticker({
    required String code,
    required bool business,
    String profileCode = '',
    String companyId = '',
    String deviceToken = '',
  }) async =>
      Ok(ActivationResult(
          profileKind: 'personal',
          profileCode: profileCode,
          deviceBound: deviceToken.isNotEmpty));

  @override
  Future<Result<List<NfcDevice>>> devices() async => const Ok([
        NfcDevice(id: 1, label: 'Namuna Kafe', companyId: 'NAMUNAKAFE'),
        NfcDevice(id: 2, label: 'Ali Valiyev', code: 'ALI777'),
        NfcDevice(
            id: 3, label: 'Ali Valiyev', code: '38479396', blockedByOwner: true),
      ]);
}

class _ReadyNfc extends NfcService {
  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;
}

Widget wrapScreen(Widget child, {NfcTokens? tokens}) => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(tokens ?? NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: L.supportedLocales,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: child,
    );

void main() {
  final l = LUz();
  Directory('test/shots/png/stiker').createSync(recursive: true);

  setUpAll(() async {
    final families = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': [
        'assets/fonts/IBMPlexMono-400.ttf',
        'assets/fonts/IBMPlexMono-500.ttf',
        'assets/fonts/IBMPlexMono-600.ttf',
      ],
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
    };
    for (final f in families.entries) {
      final loader = FontLoader(f.key);
      var any = false;
      for (final p in f.value) {
        if (File(p).existsSync()) {
          loader.addFont(rootBundle.load(p));
          any = true;
        }
      }
      if (any) await loader.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final fl = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await fl.load();
    }
  });

  Future<void> size(WidgetTester tester, [double h = 844]) async {
    tester.view.physicalSize = Size(390, h) * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  Future<void> snap(WidgetTester tester, String name) async {
    // Test muhitida soyalar qattiq blok bo'lib chiziladi — telefondagi
    // yumshoq soyani ko'rsatish uchun vaqtincha yoqiladi.
    debugDisableShadows = false;
    try {
      await tester.runAsync(() async {
        for (final e in tester.widgetList<Image>(find.byType(Image))) {
          await precacheImage(e.image, tester.element(find.byType(MaterialApp)));
        }
      });
      await settle(tester, frames: 14);
      await expectLater(
          find.byType(MaterialApp), matchesGoldenFile('png/stiker/$name.png'));
    } finally {
      debugDisableShadows = true;
    }
  }

  Future<void> tapText(WidgetTester tester, String text) async {
    final f = find.text(text).first;
    await tester.ensureVisible(f);
    await tester.tap(f);
    await settle(tester);
  }

  testWidgets('1 NFC markazi — yangi qator', (tester) async {
    await size(tester, 1500);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        nfcServiceProvider.overrideWithValue(_ReadyNfc()),
      ],
      child: wrapScreen(const NfcCenterScreen(), tokens: NfcTokens.ivory),
    ));
    await snap(tester, '1-nfc-markazi');
  });

  testWidgets('2-5 faollashtirish', (tester) async {
    await size(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        nfcRepositoryProvider.overrideWithValue(_Nfc()),
      ],
      child: wrapScreen(const StickerActivateScreen(deviceToken: 'tok'),
          tokens: NfcTokens.ivory),
    ));
    await tester.enterText(
        find.byKey(const ValueKey('activate-code')), 'k7m2p9qa');
    await snap(tester, '2-kod');
    await tapText(tester, l.actionContinue);
    await snap(tester, '3-profil-turi');
    await tapText(tester, l.actionContinue);
    await snap(tester, '4-id-tanlash');
    final submit = find.byKey(const ValueKey('activate-submit'));
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await snap(tester, '5-tayyor');
  });

  testWidgets('6 Kartalar', (tester) async {
    await size(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        nfcRepositoryProvider.overrideWithValue(_Nfc()),
      ],
      child: wrapScreen(const NfcCardsScreen(), tokens: NfcTokens.ivory),
    ));
    await snap(tester, '6-kartalar');
  });

  testWidgets('7 o‘chirilgan stiker', (tester) async {
    await size(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(const StickerStatusScreen(off: true),
          tokens: NfcTokens.ivory),
    ));
    await snap(tester, '7-ochirilgan');
  });

  testWidgets('8 Ivory — qora NFC ID karta', (tester) async {
    await size(tester, 520);
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(
        Builder(builder: (context) {
          final t = context.tokens;
          return Scaffold(
            backgroundColor: t.bg1,
            body: Padding(
              padding: const EdgeInsets.fromLTRB(20, 80, 20, 20),
              child: Align(
                alignment: Alignment.topCenter,
                child: NfcIdHeroCard(
                  code: 'ALI777',
                  eyebrow: 'NFC ID · ${l.modePersonal}',
                  name: 'nfcstore.uz/ALI777',
                  technical: true,
                  actions: [
                    NfcIdHeroAction(
                        icon: Icons.qr_code_2_rounded,
                        tooltip: l.nfcShowQr,
                        onTap: () {}),
                    NfcIdHeroAction(
                        icon: Icons.ios_share_rounded,
                        tooltip: l.actionShare,
                        onTap: () {}),
                  ],
                ),
              ),
            ),
          );
        }),
        tokens: NfcTokens.ivory,
      ),
    ));
    await snap(tester, '8-qora-karta');
  });

}
