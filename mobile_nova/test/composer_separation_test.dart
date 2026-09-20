import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// STORY VA POST FOYDALANUVCHI UCHUN ARALASHMASIN.
///
/// Backend yo'llari ilgari ham alohida edi, lekin EKRANDA ikkalasi
/// bir xil ko'rinardi: tugma ikkalasida ham generic "Chop etish"
/// deb turardi va yozuv saqlangach IKKALA ro'yxat ham qayta
/// o'qilardi. Ya'ni foydalanuvchi uchun Story va Post bitta
/// narsadek edi.
///
/// Bu testlar o'sha ajratishni QOTIRADI.
void main() {
  final src = File('lib/features/social/post_screens.dart').readAsStringSync();

  /// Izohlarni olib tashlaydi — tekshiruv KOD haqida.
  String codeOnly(String s) => s
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///');
      })
      .join('\n');

  final code = codeOnly(src);

  /// `_publish` metodining boshlanishi.
  ///
  /// `res.when(` fayl boshida ham uchraydi (`postProvider`),
  /// shuning uchun har bir qidiruv SHU nuqtadan boshlanadi.
  final publishAt = code.indexOf('Future<void> _publish()');

  /// `_publish` ichidagi `res.when(ok: ...)` bloki.
  String refreshBlock() {
    final start = code.indexOf(
        'switch (widget.kind) {', code.indexOf('res.when(', publishAt));
    expect(start, greaterThan(0),
        reason: 'yangilanish turga qarab ajratilmagan');
    return code.substring(start, code.indexOf('context.pop()', start));
  }

  group('A — STORY oqimi', () {
    test('sarlavha va tugma matni Storyga XOS', () {
      final uz = LUz();
      expect(uz.storyCreate, 'Story qo‘shish');
      expect(uz.storyPublish, 'Storyni joylash');
    });

    test('Story STORY endpointiga yozadi', () {
      expect(code, contains('ComposerKind.story, true'));
      expect(code, contains('ComposerKind.story, false'));
      // Story shoxobchasi `createStory` ni chaqiradi.
      final storyBranch = code.substring(
        code.indexOf('(ComposerKind.story, true)'),
        code.indexOf('(ComposerKind.post || ComposerKind.reel, true)'),
      );
      expect(storyBranch, contains('createStory'));
      expect(storyBranch, isNot(contains('createPost')),
          reason: 'Story POST endpointiga ketyapti');
    });

    test('Story joylangach FAQAT storylar yangilanadi', () {
      final block = refreshBlock();
      final story = block.substring(
        block.indexOf('case ComposerKind.story:'),
        block.indexOf('case ComposerKind.post:'),
      );
      expect(story, contains('homeStoriesProvider'));
      expect(story, contains('storiesOfProvider'));
      // POSTLAR RO'YXATIGA TEGILMAYDI.
      expect(story, isNot(contains('homeFeedProvider')),
          reason: 'story joylanganda lenta ham qayta o‘qilyapti');
      expect(story, isNot(contains('_invalidatePosts')),
          reason: 'story joylanganda postlar ham qayta o‘qilyapti');
    });
  });

  group('B — POST oqimi', () {
    test('sarlavha va tugma matni Postga XOS', () {
      final uz = LUz();
      expect(uz.postCreate, 'Post qo‘shish');
      expect(uz.postPublish, 'Postni joylash');
    });

    test('Post POST endpointiga yozadi', () {
      final postBranch = code.substring(
          code.indexOf('(ComposerKind.post || ComposerKind.reel, true)'));
      expect(postBranch, contains('createPost'));
      expect(postBranch, isNot(contains('createStory')),
          reason: 'Post STORY endpointiga ketyapti');
    });

    test('Post joylangach FAQAT postlar yangilanadi', () {
      final block = refreshBlock();
      final post = block.substring(
        block.indexOf('case ComposerKind.post:'),
        block.indexOf('case ComposerKind.reel:'),
      );
      expect(post, contains('homeFeedProvider'));
      expect(post, contains('_invalidatePosts'));
      // STORY HALQASIGA TEGILMAYDI.
      expect(post, isNot(contains('homeStoriesProvider')),
          reason: 'post joylanganda storylar ham qayta o‘qilyapti');
      expect(post, isNot(contains('storiesOfProvider')),
          reason: 'post joylanganda storylar ham qayta o‘qilyapti');
    });
  });

  group('C — PROFIL KONTEKSTI', () {
    test('yozuv FAOL profilga ketadi — birinchi yozuvga emas', () {
      // `activeIdProvider` HAR DOIM shaxsiy yozuvni beradi. Yozish
      // uchun u ishlatilsa, biznes rejimida yaratilgan post
      // shaxsiy profilga tushardi.
      final publish =
          code.substring(publishAt, code.indexOf('res.when(', publishAt));
      expect(publish, contains('activeProfileProvider'));
      expect(publish, isNot(contains('activeIdProvider')),
          reason: '`_publish` faol profilni emas, shaxsiy yozuvni o‘qiyapti');
      // Kod HAR DOIM tanlangan profilning kodini yuboradi.
      expect(publish, contains('profile.code'));
    });

    test('tanlangan shaxsiy yozuv o‘zgarsa, faol profil ham o‘zgaradi',
        () async {
      const ids = [
        NfcId(code: 'VIP001', name: 'Muhammad', primary: true),
        NfcId(code: 'TTS075', name: 'Ikkinchi'),
      ];
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        myIdsProvider.overrideWithValue(ids),
      ]);
      addTearDown(c.dispose);

      // Standart — asosiy yozuv.
      expect(c.read(activeProfileProvider)?.code, 'VIP001');

      // Tanlov o‘zgardi: endi yozuv TTS075 ga ketishi kerak.
      c.read(selectedPersonalCodeProvider.notifier).state = 'TTS075';
      expect(c.read(activeProfileProvider)?.code, 'TTS075');
      expect(c.read(activeProfileProvider)?.isBusiness, isFalse);
    });

    test('kompaniya postlari va shaxsiy postlar BOSHQA manbadan', () {
      // `/api/records/:code/posts` kompaniya uchun ishlamaydi.
      expect(code, contains('companyPostsProvider'));
      expect(code, contains('profilePostsProvider'));
      final inv = code.substring(code.indexOf('void _invalidatePosts('));
      expect(inv.substring(0, inv.indexOf('}')), contains('isBusiness'));
    });
  });

  group('D — ARALASHUV = 0', () {
    test('composer generic "Chop etish" tugmasini ishlatmaydi', () {
      expect(code, isNot(contains('l.actionPublish')),
          reason: 'tugma matni amalga qarab o‘zgarmayapti');
      expect(code, contains('l.storyPublish'));
      expect(code, contains('l.postPublish'));
      expect(code, contains('l.reelPublish'));
    });

    test('uchala amalning matni uchala tilda ham TURLICHA', () {
      for (final l in [LUz(), LRu(), LEn()]) {
        final labels = {l.storyPublish, l.postPublish, l.reelPublish};
        expect(labels.length, 3,
            reason: 'tugma matnlari takrorlanyapti: $labels');
        final titles = {l.storyCreate, l.postCreate, l.reelCreate};
        expect(titles.length, 3,
            reason: 'sarlavhalar takrorlanyapti: $titles');
      }
    });

    test('Story ekranida izoh maydoni YO‘Q, Postda BOR', () {
      // Bu ikki oqimni ko‘rinishdan ham ajratadi: story izohsiz,
      // post izohli.
      expect(code, contains('widget.kind != ComposerKind.story'));
    });
  });

  group('ekran matni haqiqatan ko‘rinadi', () {
    testWidgets('Story composer — Story sarlavhasi va tugmasi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const ComposerScreen(kind: ComposerKind.story)),
      ));
      await settle(tester);

      final uz = LUz();
      expect(find.text(uz.storyCreate), findsWidgets);
      expect(find.text(uz.storyPublish), findsOneWidget);
      // POST matnlari bu ekranda BO‘LMASIN.
      expect(find.text(uz.postPublish), findsNothing);
    });

    testWidgets('Post composer — Post sarlavhasi va tugmasi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const ComposerScreen(kind: ComposerKind.post)),
      ));
      await settle(tester);

      final uz = LUz();
      expect(find.text(uz.postCreate), findsWidgets);
      expect(find.text(uz.postPublish), findsOneWidget);
      // STORY matnlari bu ekranda BO‘LMASIN.
      expect(find.text(uz.storyPublish), findsNothing);
    });
  });
}
