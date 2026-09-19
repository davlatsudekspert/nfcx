import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Kontent qoidalari matni', () {
    late Map<String, dynamic> uz;
    late Map<String, dynamic> ru;
    late Map<String, dynamic> en;

    setUpAll(() {
      Map<String, dynamic> read(String lang) => jsonDecode(
            File('lib/l10n/arb/app_$lang.arb').readAsStringSync(),
          ) as Map<String, dynamic>;
      uz = read('uz');
      ru = read('ru');
      en = read('en');
    });

    test('matn saytdagi manba bilan AYNAN bir xil', () {
      // `src/components/ContentRulesGate.jsx` da: "MATN EGASI BERGAN
      // TAHRIRDA — o'zgartirilmaydi, qisqartirilmaydi". Shuning uchun
      // bu tekshiruv qat'iy: bitta belgi ham farq qilmasligi kerak.
      const source =
          'Joylashtirilayotgan kontent quyidagilarni o‘z ichiga olmasligi '
          'shart: diniy targ‘ibot yoki ekstremistik mazmun, pornografik '
          'yoki jinsiy xarakterdagi tasvirlar, siyosiy targ‘ibot, '
          'shuningdek O‘zbekiston Respublikasi qonunchiligiga zid har '
          'qanday material. Ushbu qoidalar buzilgan taqdirda kontent '
          'ogohlantirishsiz o‘chiriladi.';
      expect(uz['rulesBody'], source);
    });

    test('qoidalar uchala tilda ham bor va bo‘sh emas', () {
      for (final k in ['rulesTitle', 'rulesBody', 'rulesAccept']) {
        for (final (name, d) in [('uz', uz), ('ru', ru), ('en', en)]) {
          expect(d[k], isA<String>(), reason: '$name.$k');
          expect((d[k] as String).trim(), isNotEmpty, reason: '$name.$k');
        }
      }
    });

    test('qoidalar matni taqiqlangan kontentni ANIQ sanaydi', () {
      // Ro'yxat qisqartirilib ketmasligi uchun — har til uchun
      // o'sha mavzular nomlanganini tekshiramiz.
      final checks = {
        'uz': ['diniy', 'pornografik', 'siyosiy', 'qonunchilig'],
        'ru': ['религиозн', 'порнограф', 'политическ', 'законодательств'],
        'en': ['religious', 'pornographic', 'political', 'laws'],
      };
      for (final e in checks.entries) {
        final body = ({'uz': uz, 'ru': ru, 'en': en}[e.key]!['rulesBody']
                as String)
            .toLowerCase();
        for (final word in e.value) {
          expect(body, contains(word), reason: '${e.key}: $word');
        }
      }
    });
  });

  group('Serverning roziligi', () {
    test('post va istorya so‘rovlari `agreed` yuboradi', () {
      // `hosting/worker.js` -> `rulesAcceptedD1`: roziliksiz 422
      // `rules_not_accepted`. Bu maydon tushib qolsa joylash butunlay
      // ishlamay qoladi, shuning uchun test doimiy qo'riqchi.
      final src =
          File('lib/data/repositories/social_repository.dart').readAsStringSync();

      // Metodni keyingi metod boshlanishigacha kesamiz.
      String bodyOf(String name, String until) {
        final i = src.indexOf(name);
        expect(i, greaterThan(-1), reason: '$name topilmadi');
        final j = src.indexOf(until, i);
        return src.substring(i, j == -1 ? src.length : j);
      }

      expect(bodyOf('createPost', 'videosOf').contains("'agreed': true"),
          isTrue,
          reason: 'createPost `agreed` yubormayapti');
      expect(bodyOf('createStory', 'Kashfiyot lentasi').contains("'agreed': true"),
          isTrue,
          reason: 'createStory `agreed` yubormayapti');
    });

    test('joylash oldidan darvoza chaqiriladi', () {
      final src =
          File('lib/features/social/post_screens.dart').readAsStringSync();
      final publish = src.substring(src.indexOf('Future<void> _publish'));
      final body = publish.substring(0, publish.indexOf('final res ='));
      expect(body.contains('ensureContentRules'), isTrue,
          reason: 'publish qoidalar darvozasidan o‘tmayapti');
    });

    test('qoidalar Sozlamalardan ham ochiladi', () {
      final src =
          File('lib/features/settings/settings_screen.dart').readAsStringSync();
      expect(src.contains('ensureContentRules'), isTrue);
      expect(src.contains('l.rulesOpen'), isTrue);
    });
  });
}
