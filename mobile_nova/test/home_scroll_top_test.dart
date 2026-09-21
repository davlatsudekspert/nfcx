import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';

import 'helpers.dart';

/// "ASOSIY" TUGMASI TEPAGA QAYTARADI.
///
/// Qurilmada topilgan shikoyat: lentani pastga silkitgandan keyin
/// pastdagi "Asosiy" tugmasini bosish hech narsa qilmasdi. Bu
/// odatiy mobil xulq va odam uni kutadi.
///
/// Shell `homeReselectProvider` ni oshiradi (faqat Home'da turib
/// bosilganda), bosh sahifa esa uni eshitib ro'yxatni tepaga
/// suradi. Bu test o'sha zanjirning bosh sahifadagi qismini
/// HAQIQIY ekranda o'lchaydi.
void main() {
  testWidgets('pastga silkitilgan lenta tepaga QAYTADI', (tester) async {
    // Baland oyna: bosh sahifa uzun va oddiy 600px da siljishga
    // joy qolmaydi.
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final container = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(container.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: wrapScreen(const HomeScreen()),
    ));
    await settle(tester, frames: 12);

    final scrollable = find.byType(Scrollable).first;
    final position = tester.state<ScrollableState>(scrollable).position;

    // Siljitishga joy bormi — bo'lmasa test hech narsa isbotlamaydi.
    expect(position.maxScrollExtent, greaterThan(100),
        reason: 'bosh sahifa siljimaydi — test ma\'nosiz');

    position.jumpTo(position.maxScrollExtent.clamp(0, 400));
    await tester.pump();
    expect(position.pixels, greaterThan(0));

    // "Asosiy" qayta bosildi.
    container.read(homeReselectProvider.notifier).state++;
    // Animatsiya 320 ms — undan uzunroq kutamiz.
    await settle(tester, frames: 10);

    expect(position.pixels, 0,
        reason: '"Asosiy" bosilganda lenta eng tepaga qaytishi kerak');
  });

  testWidgets('tepada turganda qayta bosish hech narsani buzmaydi',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final container = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(container.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: wrapScreen(const HomeScreen()),
    ));
    await settle(tester, frames: 12);

    container.read(homeReselectProvider.notifier).state++;
    await settle(tester, frames: 10);

    final position = tester.state<ScrollableState>(find.byType(Scrollable).first).position;
    expect(position.pixels, 0);
    expect(tester.takeException(), isNull);
  });
}
