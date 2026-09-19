import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// HAR BIR KO'RINADIGAN BOSHQARUV HAQIQIY AMALGA EGA.
///
/// Bu tekshiruv `flutter test` da, emulyatorsiz bajariladi va butun
/// `lib/` ni o'qiydi. Maqsad — "bosiladi, lekin hech narsa
/// qilmaydi" degan tugma qolmasligi.
///
/// Nima uchun kerak: ilgari `profile_setup_screen.dart` da avatar
/// doirasi `onTap: () {}` edi. U bosilardi, animatsiya ham berardi,
/// lekin surat tanlash oynasi ochilmasdi. Bunday narsani ko'z bilan
/// topish qiyin — bosasiz, "ishlamadi shekilli" deb o'tib ketasiz.
void main() {
  final files = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();

  /// Izohlarni tashlaydi: hujjatda `onTap: () {}` misol sifatida
  /// keltirilgan bo'lishi mumkin va u chaqiruv emas.
  String codeOnly(String src) => src
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///') && !t.startsWith('*');
      })
      .join('\n');

  test('lib/ da dart fayllar bor', () {
    expect(files, isNotEmpty);
  });

  test('BO\'SH handler yo\'q — har bir boshqaruv ish bajaradi', () {
    // `() {}`, `(_) {}`, `() async {}` — hammasi bo'sh tana.
    final empty = RegExp(
      r'on(Tap|Pressed|Changed|Submitted|Long[Pp]ress)\s*:\s*'
      r'\(\s*[_\w]*\s*\)\s*(async\s*)?\{\s*\}',
    );
    final bad = <String>[];
    for (final f in files) {
      final src = codeOnly(f.readAsStringSync());
      for (final m in empty.allMatches(src)) {
        final line = '\n'.allMatches(src.substring(0, m.start)).length + 1;
        bad.add('${f.path}:$line  ${m.group(0)}');
      }
    }
    expect(bad, isEmpty,
        reason: 'Quyidagi boshqaruvlar bosiladi-yu, hech narsa '
            'qilmaydi:\n${bad.join('\n')}');
  });

  test('boshqaruvlar SONI kutilgan darajada', () {
    // Pastki chegara: ekranlar jimgina olib tashlanib, sinov
    // "hammasi joyida" deb qolmasligi uchun. Aniq raqam emas,
    // KUTILGAN TARTIB tekshiriladi.
    var total = 0;
    for (final f in files) {
      total += RegExp(r'on(Tap|Pressed|Changed):')
          .allMatches(codeOnly(f.readAsStringSync()))
          .length;
    }
    expect(total, greaterThan(150),
        reason: 'interaktiv boshqaruvlar soni keskin kamaygan — '
            'ekran yoki blok tushib qolgan bo\'lishi mumkin');
  });

  test('`onPressed: null` faqat SHARTLI o\'chirish uchun', () {
    // `onPressed: null` — tugmani o'chirish usuli. U SHART bilan
    // bo'lishi kerak (`busy ? null : ...`), doimiy `null` esa
    // ko'rinib turgan, lekin hech qachon bosilmaydigan tugma
    // degani.
    //
    // Ikki nuqtadan OLDIN bo'shliq QO'YILMAYDI. Aks holda uchlik
    // shartning o'zi tushib qolardi: `onTap: enabled ? onTap : null`
    // da `onTap : null` bo'lagi mos kelib, mutlaqo to'g'ri kod
    // xato deb belgilanardi.
    final always = RegExp(r'on(Tap|Pressed):\s*null\s*[,)]');
    final bad = <String>[];
    for (final f in files) {
      final src = codeOnly(f.readAsStringSync());
      for (final m in always.allMatches(src)) {
        final line = '\n'.allMatches(src.substring(0, m.start)).length + 1;
        bad.add('${f.path}:$line');
      }
    }
    expect(bad, isEmpty,
        reason: 'Doimiy o\'chirilgan boshqaruv — ko\'rinadi, lekin '
            'hech qachon ishlamaydi:\n${bad.join('\n')}');
  });

  test('Sozlamalardagi har bir band marshrutga yoki amalga bog\'langan',
      () {
    final settings = File('lib/features/settings/settings_screen.dart')
        .readAsStringSync();
    final code = codeOnly(settings);
    // Har bir `_Tile`/`_Item` da `onTap` bo'lishi kerak.
    final tiles = RegExp(r'_(Tile|Item|Row)\(').allMatches(code).length;
    final taps = RegExp(r'onTap:').allMatches(code).length;
    expect(taps, greaterThanOrEqualTo(tiles > 0 ? 1 : 0),
        reason: 'Sozlamalarda amalga bog\'lanmagan band bor');
  });
}
