import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_v2/app.dart';
import 'package:nfcstore_v2/core/models.dart';
import 'package:nfcstore_v2/core/session.dart';
import 'package:nfcstore_v2/core/theme.dart';
import 'package:nfcstore_v2/screens/shell.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(_loadPreviewFonts);

  testWidgets('render actual current V2 Home preview', (tester) async {
    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final session = AppSession()
      ..phase = SessionPhase.signedIn
      ..user = const AppUser(
        id: 1,
        email: 'preview@nfcstore.local',
      )
      ..profiles = const [
        IdentityProfile(
          code: 'VIP001',
          name: 'Muhammad',
          role: 'Digital Identity',
          about: 'Bitta profil. Barcha havolalar. Bir tegishda.',
          views: 1248,
          isPrimary: true,
        ),
      ]
      ..activeProfile = const IdentityProfile(
        code: 'VIP001',
        name: 'Muhammad',
        role: 'Digital Identity',
        about: 'Bitta profil. Barcha havolalar. Bir tegishda.',
        views: 1248,
        isPrimary: true,
      )
      ..companies = const [
        Company(
          id: 'NOIR01',
          name: 'NOIR Coffee',
          city: 'Tashkent',
          about: 'Specialty coffee, sokin atmosfera va raqamli menyu.',
          views: 8420,
          followers: 1240,
          verified: true,
        ),
        Company(
          id: 'LUMEN7',
          name: 'Lumen Studio',
          city: 'Andijan',
          about: 'Brand, product va digital tajribalar uchun creative studio.',
          views: 3160,
          followers: 486,
          verified: true,
        ),
      ];
    final theme = BrandThemeController();
    addTearDown(session.dispose);
    addTearDown(theme.dispose);

    await tester.pumpWidget(
      NfcstoreV2App(session: session, theme: theme),
    );
    await tester.pump();
    // The production app intentionally keeps the branded boot visible
    // for at least 1.05 s, then cross-fades into the shell.
    await tester.pump(const Duration(milliseconds: 1500));
    await tester.pump(const Duration(milliseconds: 450));

    expect(find.byType(V2Shell), findsOneWidget);
    await expectLater(
      find.byType(V2Shell),
      matchesGoldenFile('goldens/home_actual.png'),
    );
  });
}

Future<void> _loadPreviewFonts() async {
  Future<void> loadFile(String family, String path) async {
    final file = File(path);
    final bytes = Uint8List.fromList(await file.readAsBytes());
    final loader = FontLoader(family)
      ..addFont(Future.value(ByteData.sublistView(bytes)));
    await loader.load();
  }

  await loadFile('Manrope', 'assets/fonts/Manrope-400.ttf');
  await loadFile(
    'InstrumentSerif',
    'assets/fonts/InstrumentSerif-400.ttf',
  );
  await loadFile('IBMPlexMono', 'assets/fonts/IBMPlexMono-400.ttf');

  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  if (flutterRoot != null && flutterRoot.isNotEmpty) {
    final iconPath =
        flutterRoot + '/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf';
    final iconFile = File(iconPath);
    if (await iconFile.exists()) {
      await loadFile('MaterialIcons', iconPath);
    }
  }
}