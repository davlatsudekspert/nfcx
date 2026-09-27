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

  test('bitta brend muhri uch joyda', () {
    expect(code('lib/design/widgets/bottom_nav.dart'), contains('BrandSeal('));
    expect(code('lib/features/nfc/nfc_center_screen.dart'),
        contains('BrandSeal('));
    expect(code('lib/features/auth/login_screen.dart'), contains('BrandSeal('));
  });

  // Egasining qarori (2026-09-27): Splash'dagi logo "logo bilan bir
  // xil, qora" — telefon ekranidagi ilova belgisi kabi. Ilgari bu yerda
  // ham oq muhr (`BrandSeal`) turardi va ivory fonda oqarib qolardi.
  test('Splash — ilova belgisi (qora plastina), oq muhr emas', () {
    expect(code('lib/features/entry/splash_screen.dart'),
        contains('BrandLockup('));
    final brand = code('lib/design/widgets/brand_logo.dart');
    final lockup = brand.substring(brand.indexOf('class BrandLockup'));
    final body = lockup.substring(0, lockup.indexOf('\n}'));
    expect(body, contains('BrandAppIcon('));
    expect(body, isNot(contains('BrandSeal(')));
    // Belgi — brend aktivining o'zi, yuqori sifatda kichraytiriladi.
    final icon = brand.substring(brand.indexOf('class BrandAppIcon'));
    final iconBody = icon.substring(0, icon.indexOf('\n}'));
    expect(iconBody, contains('BrandLogo.assetLogo'));
    expect(iconBody, contains('FilterQuality.high'));
  });

  test('markaziy tugmada generic NFC ikonkasi yo‘q', () {
    final nav = code('lib/design/widgets/bottom_nav.dart');
    final center = nav.substring(nav.indexOf('class _CenterNavButton'),
        nav.indexOf('class _NavButton'));
    expect(center, isNot(contains('Icons.nfc')));
    expect(center, isNot(contains('Icons.contactless')));
  });
}
