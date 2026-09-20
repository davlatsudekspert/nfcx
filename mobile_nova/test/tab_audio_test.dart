import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/routing/shell.dart';

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

  test('Reels tabining raqami 3 — ekran shunga qaraydi', () {
    // `_ReelsScreenState` da `activeTabProvider == 3` deb yozilgan.
    // Tartib o'zgarsa Reels ovozi yana boshqa bo'limda eshitilardi.
    expect(HomeShell.tabRoutes.indexOf('/reels'), 3,
        reason: 'tab tartibi o‘zgardi — Reels ekranidagi raqam ham '
            'yangilanishi kerak');
  });

  test('`stopAll` ro‘yxatdagi HAMMA manbani to‘xtatadi', () async {
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    final owner = c.read(audioOwnerProvider.notifier);

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
    final owner = c.read(audioOwnerProvider.notifier);

    // `InlineVideo` aynan shunday qiladi: to'xtaganda o'zini
    // ro'yxatdan chiqaradi. Ro'yxat bo'ylab yurib turib uni
    // o'zgartirish istisno berardi.
    owner.take(#a, () => owner.release(#a));
    owner.take(#b, () => owner.release(#b));

    expect(owner.stopAll, returnsNormally);
  });
}
