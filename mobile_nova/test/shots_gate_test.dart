import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// SURAT GENERATORI APK DARVOZASINI BLOKLAMASLIGI KERAK.
///
/// `test/shots/` ilovaning haqiqiy vidjetlarini PNG ga chizadi.
/// U SINOV emas — hech narsani tekshirmaydi, surat oladi. Natija
/// fayllari `.gitignore` da, ya'ni CI da ular YO'Q va
/// `matchesGoldenFile` solishtiradigan narsa topolmaydi.
///
/// Aynan shu APK #41–#43 ni qizil qildi: 18 ta surat 18 ta
/// "yiqilgan test" bo'lib chiqdi va build to'xtadi. O'shanda
/// `@Tags(['shots'])` yetarli deb o'ylangan edi — YETARLI EMAS.
/// Teg faqat FILTRLASH uchun; o'zi hech narsani o'tkazib
/// yubormaydi. O'tkazib yuborishni `dart_test.yaml` dagi `skip`
/// hal qiladi.
///
/// Bu fayl o'sha sozlama joyida turganini qotiradi.
void main() {
  final root = Directory.current.path;

  /// `dart_test.yaml` dan `tags: > shots: > skip:` ni oladi.
  ///
  /// `yaml` paketi loyihada yo'q va FAQAT shu qo'riqchi uchun
  /// bog'liqlik qo'shish noo'rin. Fayl uch qatorli, shuning uchun
  /// chekinish bo'yicha o'qish yetarli.
  String? skipReason(String text) {
    var inTags = false;
    var inShots = false;
    for (final raw in text.split('\n')) {
      final line = raw.replaceAll('\t', '  ');
      final trimmed = line.trim();
      if (trimmed.isEmpty || trimmed.startsWith('#')) continue;
      final indent = line.length - line.trimLeft().length;

      if (indent == 0) {
        inTags = trimmed == 'tags:';
        inShots = false;
        continue;
      }
      if (!inTags) continue;
      if (indent == 2) {
        inShots = trimmed == 'shots:';
        continue;
      }
      if (inShots && indent >= 4 && trimmed.startsWith('skip:')) {
        return trimmed.substring('skip:'.length).trim();
      }
    }
    return null;
  }

  group('Surat generatori darvozasi', () {
    test('`dart_test.yaml` `shots` tegini o‘tkazib yuboradi', () {
      final f = File('$root/dart_test.yaml');
      expect(f.existsSync(), isTrue,
          reason: '`dart_test.yaml` yo‘q — oddiy `flutter test` surat '
              'generatorini ishga tushiradi va CI qiziradi');

      final skip = skipReason(f.readAsStringSync());
      expect(skip, isNotNull,
          reason: '`tags: shots: skip:` topilmadi — generator oddiy '
              '`flutter test` ichida ishlab ketadi');
      expect(skip!.replaceAll('"', '').trim(), isNotEmpty,
          reason: 'sabab bo‘sh');
      // Sabab ichida chaqirish usuli tursin: keyin ochgan odam
      // NEGA o'tkazib yuborilayotganini va QANDAY surat olishni
      // o'sha yerdan ko'rsin.
      expect(skip, contains('--run-skipped'),
          reason: 'sababda chaqirish usuli ko‘rsatilmagan');
    });

    test('`test/shots/` dagi har bir sinov fayli teg ko‘taradi', () {
      final shots = Directory('$root/test/shots');
      expect(shots.existsSync(), isTrue);

      final files = shots
          .listSync()
          .whereType<File>()
          .where((f) => f.path.endsWith('_test.dart'))
          .toList();
      expect(files, isNotEmpty, reason: 'generator fayli topilmadi');

      for (final f in files) {
        expect(f.readAsStringSync(), contains("@Tags(['shots'])"),
            reason: '${f.uri.pathSegments.last} da `@Tags([\'shots\'])` '
                'yo‘q — u oddiy `flutter test` ichida ishlab ketadi');
      }
    });

    test('golden solishtiruvi `test/shots/` dan tashqariga chiqmagan', () {
      // Piksel solishtiruvi shrift versiyasi va platformaga
      // bog'liq, shuning uchun APK darvozasi bo'lishga yaramaydi.
      // U sekin-asta oddiy testlarga sizib kirmasin.
      final leaked = <String>[];
      for (final e in Directory('$root/test').listSync(recursive: true)) {
        if (e is! File || !e.path.endsWith('_test.dart')) continue;
        if (e.path.contains('/test/shots/')) continue;
        if (e.path.endsWith('shots_gate_test.dart')) continue;
        if (e.readAsStringSync().contains('matchesGoldenFile')) {
          leaked.add(e.path.split('/test/').last);
        }
      }
      expect(leaked, isEmpty,
          reason: 'golden solishtiruvi `test/shots/` dan tashqarida: '
              '${leaked.join(', ')}');
    });

    test('surat natijalari repozitoriyaga yuklanmaydi', () {
      final ignore = File('$root/../.gitignore').readAsStringSync();
      expect(ignore, contains('mobile_nova/test/shots/png/'),
          reason: 'PNG natijalari `.gitignore` da emas');
    });
  });
}
