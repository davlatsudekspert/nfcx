import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/routing/shell.dart';

import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// TAB ALMASHGANDA OVOZ TO'XTASIN.
///
/// Telefonda topildi: Reels'dan chiqib Profilga o'tsangiz ham
/// video ovozi davom etardi.
///
/// Sabab — `StatefulShellRoute.indexedStack`. U tablarni
/// O'CHIRMAYDI, faqat berkitadi: `dispose()` hech qachon
/// chaqirilmaydi, shuning uchun unga tayanib bo'lmaydi.
void main() {
  test('`activeTabProvider` boshida bosh ekranni ko‘rsatadi', () async {
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    expect(c.read(activeTabProvider), 0);
  });

  test('Ko‘rgazma tabining raqami — ekran shunga qaraydi', () {
    // `ShowcaseScreen` ko'rinishni `activeTabProvider == kShowcaseTab`
    // dan biladi. Tartib o'zgarsa musiqa boshqa bo'limda eshitilardi.
    expect(HomeShell.tabRoutes.indexOf(Routes.showcase), kShowcaseTab,
        reason: 'tab tartibi o‘zgardi — kShowcaseTab ham '
            'yangilanishi kerak');
    // Reels pastki menyuda YO'Q.
    expect(HomeShell.tabRoutes, isNot(contains(Routes.reels)));
  });

  test('`stopAll` ro‘yxatdagi HAMMA manbani to‘xtatadi', () async {
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    final owner = c.read(audioOwnerProvider);

    final stopped = <String>[];
    owner.take(#reels, () => stopped.add('reels'));
    owner.take(#story, () => stopped.add('story'));

    owner.stopAll();

    // `take` avvalgi egasini to'xtatadi, shuning uchun `story`
    // olinganda `reels` allaqachon bir marta to'xtagan.
    expect(stopped, contains('reels'));
    expect(stopped, contains('story'));
  });

  test('to‘xtatuvchi `release` chaqirsa ham `stopAll` yiqilmaydi',
      () async {
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    final owner = c.read(audioOwnerProvider);

    // `InlineVideo` aynan shunday qiladi: to'xtaganda o'zini
    // ro'yxatdan chiqaradi. Ro'yxat bo'ylab yurib turib uni
    // o'zgartirish istisno berardi.
    owner.take(#a, () => owner.release(#a));
    owner.take(#b, () => owner.release(#b));

    expect(owner.stopAll, returnsNormally);
  });
}
