import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// DEMO MA'LUMOT RELIZGA TUSHMASLIGI — doimiy kafolat.
///
/// `tool/gallery.dart` va `test/helpers.dart` ichida namunaviy
/// foydalanuvchi, NFC ID va mahsulotlar bor. Ular surat olish va test
/// uchun kerak, lekin ILOVAGA tushmasligi shart.
///
/// Bu bir martalik tekshiruv emas: kimdir kelajakda `lib/` ichiga
/// "vaqtincha" namunaviy ma'lumot qo'ysa yoki `tool/` dan import
/// qilsa, shu test yiqiladi.
void main() {
  final libFiles = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();

  test('lib/ ichida dart fayllar topildi', () {
    // Agar yo'l o'zgarib ketsa, quyidagi testlar bo'sh ro'yxatda
    // "o'tib" ketardi va hech nimani tekshirmasdi.
    expect(libFiles.length, greaterThan(50));
  });

  test('lib/ hech qayerda tool/ yoki test/ dan import qilmaydi', () {
    for (final f in libFiles) {
      final src = f.readAsStringSync();
      for (final line in src.split('\n')) {
        final t = line.trimLeft();
        if (!t.startsWith('import ') && !t.startsWith('export ')) continue;
        expect(
          t.contains("'package:nfcstore_nova/../tool/") ||
              t.contains("tool/gallery") ||
              RegExp(r"""['"](\.\./)*test/""").hasMatch(t),
          isFalse,
          reason: '${f.path}: $t',
        );
      }
    }
  });

  test('lib/ ichida gallereya va test namunalari yo‘q', () {
    // Gallereya va testdagi aniq qiymatlar. Ular `lib/` da uchrasa,
    // demak namunaviy ma'lumot ishlab chiqarish kodiga ko'chib o'tgan.
    const fixtures = [
      'Nodira Rahimova',
      'Test Foydalanuvchi',
      'Nova Studio',
      '48210377',
      'nova@nfcstore.uz',
      'test@nfcstore.uz',
      'Matte Black',
      'Brend identifikatsiyasi',
    ];

    for (final f in libFiles) {
      final src = f.readAsStringSync();
      for (final fixture in fixtures) {
        expect(src.contains(fixture), isFalse,
            reason: '${f.path} ichida namunaviy qiymat: "$fixture"');
      }
    }
  });

  test('gallereya kirish nuqtasi lib/ dan TASHQARIDA', () {
    expect(File('tool/gallery.dart').existsSync(), isTrue);
    expect(File('lib/gallery.dart').existsSync(), isFalse);
  });

  test('pubspec faqat assets/ ni paketlaydi — tool/ va test/ ni emas', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final assetLines = pubspec
        .split('\n')
        .where((l) => l.trim().startsWith('- ') && l.contains('/'))
        .map((l) => l.trim().substring(2).trim())
        .where((l) => !l.endsWith('.ttf'));

    for (final a in assetLines) {
      expect(a.startsWith('assets/'), isTrue, reason: 'Asset: $a');
    }
  });
}
