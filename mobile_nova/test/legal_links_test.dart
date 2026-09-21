import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// HUQUQIY HAVOLALAR — PLAY TALABI.
///
/// Google shaxsiy ma'lumot yig'adigan ilovadan maxfiylik
/// siyosatini talab qiladi. Ilova esa email, telefon, ism va
/// foto yig'adi.
///
/// Ilgari "Ilova haqida" ekranida faqat `nfcstore.uz` degan MATN
/// turardi — odam siyosatni qayerdan o'qishini bilmasdi va
/// tekshiruvchi ham topa olmasdi.
///
/// Bu sinov havolalarning QAYTIB YO'QOLMASLIGINI qo'riqlaydi.
void main() {
  final src =
      File('lib/features/settings/settings_subscreens.dart').readAsStringSync();

  test('maxfiylik siyosati havolasi ilovada bor', () {
    expect(src, contains('/maxfiylik'),
        reason: 'Play maxfiylik siyosatini TALAB qiladi');
    expect(src, contains('l.legalPrivacy'));
  });

  test('foydalanish shartlari havolasi ilovada bor', () {
    expect(src, contains('/shartlar'));
    expect(src, contains('l.legalTerms'));
  });

  test('havolalar HAQIQATAN bosiladi', () {
    // Matn bo'lib turgan manzil hujjatni ochmaydi. Bu yerda
    // aynan `openLink` chaqirilishi kerak.
    expect(src, contains('_LegalRow'));
    expect(src, contains('onTap: () => openLink(url)'),
        reason: 'havola bosilmaydigan bo\'lib qolgan');
  });

  test('manzil qo\'lda yozilmagan — `kSiteHost` dan olinadi', () {
    // Sayt manzili bir joyda turishi kerak: u o'zgarsa, havolalar
    // ham o'zi o'zgarsin.
    expect(src, contains(r"https://$kSiteHost/maxfiylik"));
    expect(src, contains(r"https://$kSiteHost/shartlar"));
  });

  test('uchala tilda ham tarjima bor', () {
    for (final lang in ['uz', 'ru', 'en']) {
      final arb = File('lib/l10n/arb/app_$lang.arb').readAsStringSync();
      expect(arb, contains('"legalPrivacy"'), reason: lang);
      expect(arb, contains('"legalTerms"'), reason: lang);
    }
  });
}
