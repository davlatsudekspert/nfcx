import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

/// EKRAN TEPASIDAGI ORTIQCHA QAVATLAR QAYTIB KELMASIN.
///
/// Bu tekshiruvlar matn bo'yicha ishlaydi va bir soniyada tugaydi:
/// olib tashlangan bloklar keyinchalik "tiklab" qo'yilsa, CI ning
/// eng arzon bosqichida tutiladi.
void main() {
  String read(String path) => File(path).readAsStringSync();

  /// Izohlarni olib tashlaydi — tekshiruv KOD haqida, izohda esa
  /// nima uchun olib tashlangani yozilgan.
  String codeOnly(String s) => s
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///');
      })
      .join('\n');

  group('bosh ekran sarlavhasi', () {
    final home = codeOnly(read('lib/features/home/home_screen.dart'));

    test('salomlashuv YO‘Q', () {
      // "Xayrli tong" va hisob login nomi pastdagi avatar, ism va
      // lavozim bilan bir xil narsani takrorlardi.
      expect(home, isNot(contains('_greeting(')),
          reason: 'salomlashuv qaytib kelgan');
      expect(home, isNot(contains('homeGreeting')),
          reason: 'salomlashuv tarjimasi qaytib kelgan');
    });

    test('hisob login nomi tepada ko‘rsatilmaydi', () {
      // `user.displayName` — bu `ali77099` kabi XOM login nomi.
      final header = home.substring(
          home.indexOf('NovaScaffold('), home.indexOf('NovaIconButton('));
      expect(header, isNot(contains('user.displayName')),
          reason: 'login nomi profil tepasida qayta paydo bo‘lgan');
    });
  });

  group('Kashf eting ekrani', () {
    final discover =
        codeOnly(read('lib/features/discover/discover_screen.dart'));

    test('sarlavha berilmaydi — yuqori panel umuman chizilmaydi', () {
      expect(discover, isNot(contains('title: l.discoverTitle')),
          reason: '"Kashf eting" sarlavhasi qaytib kelgan');
    });

    test('qidiruv va tablar joyida qoladi', () {
      expect(discover, contains('searchQueryProvider'));
      expect(discover, contains('discoverTabProvider'));
    });
  });

  group('avatar ustidagi nishon', () {
    final home = codeOnly(read('lib/features/home/home_screen.dart'));

    test('NFC brend muhri suratni yopmaydi', () {
      expect(home, isNot(contains('_BrandSeal')),
          reason: 'brend muhri avatarga qaytib kelgan');
    });

    test('musiqa nishoni bor va BITTA', () {
      expect('MusicControl('.allMatches(home).length, 1,
          reason: 'avatar ustida bittadan ortiq nishon bor');
    });
  });

  group('musiqa varag‘i', () {
    final music = codeOnly(read('lib/features/profile/music_player.dart'));

    test('pastki navigatsiya varaqni yopmaydi', () {
      // Varaq ILDIZ navigatorda ochiladi — u tab qobig'i (va suzuvchi
      // navigatsiya) USTIDAGI marshrut, ya'ni panel uni yopa olmaydi.
      // Pastda qurilmaning jest paneli uchun `SafeArea` + tizim
      // bo'shlig'i.
      expect(music, contains('useRootNavigator: true'),
          reason: 'varaq tab navigatorida ochilsa, panel ostida qoladi');
      expect(music, contains('MediaQuery.paddingOf(context).bottom'),
          reason: 'jest paneli hisobga olinmagan');
    });
  });

  group('istorya manbasi', () {
    final home = codeOnly(read('lib/features/home/home_screen.dart'));
    final repo =
        codeOnly(read('lib/data/repositories/social_repository.dart'));

    test('obuna bo‘lganlarning istoryasi ham o‘qiladi', () {
      expect(repo, contains("'/api/stories/feed'"),
          reason: 'obuna istoryalari endpointi chaqirilmayapti');
      expect(home, contains('followedStories()'),
          reason: 'bosh ekran faqat o‘z istoryasini ko‘rsatyapti');
    });

    test('o‘z istoryasi ham qoladi', () {
      expect(home, contains('storiesOf(p.code)'));
      expect(home, contains('stories(p.code)'),
          reason: 'kompaniya istoryalari yo‘qolgan');
    });

    test('qatorda bitta odam bitta marta chiqadi', () {
      expect(home, contains('seenCodes'),
          reason: 'bitta odamning har istoryasi alohida doiracha bo‘lyapti');
    });

    test('obuna lentasi kelmasa ham o‘z istoryang ko‘rinadi', () {
      // `valueOrNull` — xato yutiladi, butun qator yo‘qolmaydi.
      expect(home, contains('followed.valueOrNull'),
          reason: 'obuna lentasidagi xato butun qatorni yiqitadi');
    });
  });

  group('Reels va istorya manbalari aralashmaydi', () {
    final reels = codeOnly(read('lib/features/social/reels_screen.dart'));

    test('Reels lentadan FAQAT videolarni oladi', () {
      expect(reels, contains('isVideo'));
      expect(reels, isNot(contains('storiesOf')),
          reason: 'Reels istorya manbasidan o‘qiyapti');
      expect(reels, isNot(contains('followedStories')),
          reason: 'Reels istorya manbasidan o‘qiyapti');
    });
  });

  group('tarjimalar', () {
    test('uchala tilda ham bo‘sh Reels holati bor', () {
      for (final l in [LUz(), LRu(), LEn()]) {
        expect(l.reelsEmpty.trim(), isNotEmpty);
      }
    });
  });
}
