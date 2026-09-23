import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Egasining talabi: markaziy NFC tugmasida generic contactless ikonka
/// emas, NFCSTORE oltin belgisi; xuddi shu brend elementi Splash, Login
/// va NFC markazida takrorlansin.
void main() {
  String code(String p) => File(p)
      .readAsLinesSync()
      .where((l) => !l.trimLeft().startsWith('//'))
      .join('\n');

  test('bitta brend muhri to‘rt joyda', () {
    expect(code('lib/design/widgets/bottom_nav.dart'), contains('BrandSeal('));
    expect(code('lib/features/nfc/nfc_center_screen.dart'),
        contains('BrandSeal('));
    expect(code('lib/features/auth/login_screen.dart'), contains('BrandSeal('));
    // Splash `BrandLockup` orqali — u muhrni ichida chizadi.
    expect(code('lib/features/entry/splash_screen.dart'),
        contains('BrandLockup('));
    final brand = code('lib/design/widgets/brand_logo.dart');
    final lockup = brand.substring(brand.indexOf('class BrandLockup'));
    expect(lockup.substring(0, lockup.indexOf('\n}')), contains('BrandSeal('));
  });

  test('markaziy tugmada generic NFC ikonkasi yo‘q', () {
    final nav = code('lib/design/widgets/bottom_nav.dart');
    final center = nav.substring(nav.indexOf('class _CenterNavButton'),
        nav.indexOf('class _NavButton'));
    expect(center, isNot(contains('Icons.nfc')));
    expect(center, isNot(contains('Icons.contactless')));
  });
}
