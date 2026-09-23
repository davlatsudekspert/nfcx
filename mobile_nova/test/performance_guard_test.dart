import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// TEZLIK QO'RIQCHISI (egasi, 2026-09: "ilova qotib ishlayapti",
/// "boshqa bo'limga o'tishda qotyapti").
///
/// Sabab: har ekranning foni to'xtovsiz animatsiya bo'lib, sekundiga
/// 60 marta butun ekranni qayta chizardi va shisha (blur) kartalarni
/// har kadrda qayta xiralatardi; NFC ID kartasidagi halqalar ham
/// cheksiz aylanardi; rasmlar to'liq (4000 px) o'lchamda ochilardi.
void main() {
  String src(String p) => File(p).readAsStringSync();

  test('fon sukut bo‘yicha QOTGAN', () {
    expect(src('lib/design/widgets/backdrop.dart'),
        contains('this.animate = false'));
    expect(src('lib/design/widgets/nova_scaffold.dart'),
        contains('this.animateBackdrop = false'));
    expect(src('lib/design/widgets/backdrop.dart'), contains('RepaintBoundary'));
  });

  test('hech bir ekran fonni qayta jonlantirmaydi', () {
    final bad = <String>[];
    for (final f in Directory('lib').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      if (f.readAsStringSync().contains('animateBackdrop: true')) bad.add(f.path);
    }
    expect(bad, isEmpty);
  });

  test('NFC ID halqalari cheksiz aylanmaydi', () {
    final s = src('lib/design/widgets/nfc_id_hero.dart');
    expect(s, contains('_rings.repeat(count: 2)'));
    expect(s, isNot(contains('_rings.repeat();')));
  });

  test('tarmoq rasmlari ekran o‘lchamida ochiladi', () {
    expect(src('lib/features/social/media_frame.dart'),
        contains('memCacheWidth: decodeWidth(context)'));
    expect(src('lib/features/home/widgets/avatar.dart'),
        contains('memCacheWidth: decodeWidth(context, inner)'));
    expect(src('lib/features/home/home_screen.dart'),
        contains('memCacheWidth: decodeWidth(context, size)'));
  });

  // ── Telefonda qotish (egasi, 2026-09: "profildan asosiyga
  // o'tganda qotib qolyapti") ────────────────────────────────────

  test('router sessiya yangilanganda QAYTA YARATILMAYDI', () {
    final s = src('lib/routing/router.dart');
    // `ref.watch(sessionProvider)` har `refresh()` da yangi GoRouter
    // yaratib, butun ilovani noldan qurardi.
    expect(s, isNot(contains('= ref.watch(sessionProvider)')));
    expect(s, contains('refreshListenable: kind'));
    expect(s, contains('ref.read(sessionProvider)'));
  });

  test('tablar darhol almashadi — shaffoflik qatlami yo‘q', () {
    final s = src('lib/routing/shell.dart');
    expect(s, contains('Offstage('));
    expect(s, isNot(contains('AnimatedOpacity(')));
  });

  test('pastki menyu va fon blur ishlatmaydi', () {
    expect(src('lib/design/widgets/bottom_nav.dart'),
        isNot(contains('BackdropFilter(')));
    expect(src('lib/design/widgets/backdrop.dart'),
        isNot(contains('..maskFilter')));
  });

  test('profil panjarasida har video o‘z pleerini ochmaydi', () {
    final s = src('lib/features/profile/profile_screen.dart');
    expect(s, contains('VideoPoster('));
    expect(s, isNot(contains('InlineVideo(')));
    // Muqova navbatda, bitta pleer bilan olinadi va pleer yopiladi.
    final p = src('lib/features/social/video_poster.dart');
    expect(p, contains('_tail'));
    expect(p, contains('await c.dispose()'));
  });

  test('lentada ekrandan chiqqan video pleeri yopiladi', () {
    final s = src('lib/features/social/inline_video.dart');
    expect(s, contains('_release();'));
    expect(s, contains('widget.active == true && TickerMode.of(context)'));
  });

  test('rasm qutisi o‘lchamida ochiladi, MediaQuery to‘liq kuzatilmaydi', () {
    final s = src('lib/features/social/media_frame.dart');
    expect(s, isNot(contains('MediaQuery.maybeOf(context)')));
    expect(s, contains('decodeWidth(context, side)'));
  });
}
