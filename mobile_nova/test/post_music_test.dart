import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/music_repository.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/social/music_picker.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';

import 'helpers.dart';

/// REELS VA POSTGA MUSIQA + RASMLI REEL (2026-09-25).
///
/// Egasi: "reelsda musiqa qo'yish joyi yo'q", "reelsga rasm ham
/// qo'yilsin, default 10 sekund bo'lsin".
class _FakeMusic extends MusicRepository {
  _FakeMusic() : super(ApiClient());

  @override
  Future<Result<MusicLibrary>> library({String genre = '', String q = ''}) async =>
      const Ok(MusicLibrary(
        genres: ['Ta’sirli', 'Romantik', 'Quvnoq'],
        tracks: [
          MusicTrack(id: 1, title: 'Ay bala', artist: 'NeomSongs', genre: 'Romantik', durationSec: 187, audioUrl: 'https://x/a.mp3', clipUrl: 'https://x/a-30s.mp3'),
          MusicTrack(id: 2, title: 'Yurak', artist: 'NeomSongs', genre: 'Ta’sirli', durationSec: 223, audioUrl: 'https://x/y.mp3'),
          MusicTrack(id: 3, title: 'Stardust', artist: 'Chosic', genre: 'Ta’sirli', durationSec: 243, audioUrl: 'https://x/s.mp3'),
        ],
      ));
}

void main() {
  group('Model', () {
    test('post: musiqa, rasmli reel va 10 soniya o‘qiladi', () {
      final p = Post.fromJson({
        'id': 7,
        'imageUrl': 'https://x/r.jpg',
        'reel': true,
        'imageSeconds': 10,
        'music': {'id': 1, 'title': 'Ay bala', 'artist': 'NeomSongs', 'audioUrl': '/uploads/music_a.mp3', 'clipUrl': '/uploads/music_a-30s.mp3', 'start': 0},
      });
      expect(p.reel, isTrue);
      expect(p.isVideo, isFalse);
      expect(p.inReels, isTrue, reason: 'rasmli reel Reels’da chiqishi kerak');
      expect(p.imageSeconds, 10);
      expect(p.music?.title, 'Ay bala');
      expect(p.music?.clipUrl.endsWith('/uploads/music_a-30s.mp3'), isTrue,
          reason: 'nisbiy manzil to‘liq manzilga aylanadi');
      // Boshlanish tanlanmagan — 30 s bo'lak o'ynaydi, boshidan.
      expect(p.music?.playUrl, p.music?.clipUrl);
      expect(p.music?.playFrom, Duration.zero);
      // like/izoh yangilanganda musiqa va reel yo'qolmaydi.
      final c = p.copyWith(likes: 3);
      expect([c.music?.id, c.reel], [1, true]);
    });

    test('oddiy rasm post Reels’ga tushmaydi; musiqasiz post — null', () {
      final p = Post.fromJson({'id': 1, 'imageUrl': 'https://x/p.jpg'});
      expect(p.inReels, isFalse);
      expect(p.music, isNull);
      expect(p.imageSeconds, 10);
    });

    test('boshlanish nuqtasi bo‘lsa — to‘liq trek shu joydan', () {
      final m = MusicTrack.fromJson({'id': 1, 'audioUrl': 'https://x/a.mp3', 'clipUrl': 'https://x/c.mp3', 'start': 42});
      expect(m.playUrl, 'https://x/a.mp3');
      expect(m.playFrom, const Duration(seconds: 42));
    });
  });

  Future<void> pumpComposer(WidgetTester tester, ComposerKind kind,
      {List<Override> extra = const []}) async {
    tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        musicRepositoryProvider.overrideWithValue(_FakeMusic()),
        ...extra,
      ],
      child: wrapScreen(ComposerScreen(kind: kind), tokens: NfcTokens.ivory),
    ));
    await settle(tester);
  }

  group('Joylash ekrani', () {
    testWidgets('reel va postda «Musiqa qo‘shish» bor, istoryada yo‘q', (tester) async {
      await pumpComposer(tester, ComposerKind.reel);
      expect(find.byKey(const ValueKey('composer-music-add')), findsOneWidget);
      expect(find.text('Rasm yoki video tanlash'), findsOneWidget,
          reason: 'reel endi rasm ham qabul qiladi');

      await pumpComposer(tester, ComposerKind.post);
      expect(find.byKey(const ValueKey('composer-music-add')), findsOneWidget);

      await pumpComposer(tester, ComposerKind.story);
      expect(find.byKey(const ValueKey('composer-music-add')), findsNothing);
    });

    testWidgets('reel: rasm yoki video tanlash varag‘ida ikkalasi ham bor', (tester) async {
      await pumpComposer(tester, ComposerKind.reel);
      await tester.tap(find.text('Rasm yoki video tanlash'));
      await settle(tester);
      expect(find.byKey(const ValueKey('pick-gallery-photo')), findsOneWidget);
      expect(find.byKey(const ValueKey('pick-gallery-video')), findsOneWidget);
    });

    testWidgets('musiqa tanlanadi, belgisi chiqadi va olib tashlanadi', (tester) async {
      await pumpComposer(tester, ComposerKind.reel);
      await tester.tap(find.byKey(const ValueKey('composer-music-add')));
      await settle(tester);
      expect(find.text('Ay bala'), findsOneWidget);
      expect(find.text('Stardust'), findsOneWidget);

      // Janr bo'yicha filtr.
      await tester.tap(find.widgetWithText(ChoiceChip, 'Ta’sirli'));
      await settle(tester);
      expect(find.text('Ay bala'), findsNothing);
      expect(find.text('Yurak'), findsOneWidget);

      // Qidiruv.
      await tester.enterText(find.byKey(const ValueKey('music-search')), 'star');
      await settle(tester);
      expect(find.text('Yurak'), findsNothing);
      expect(find.text('Stardust'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('music-pick-3')));
      await settle(tester);
      expect(find.byKey(const ValueKey('composer-music-picked')), findsOneWidget);
      expect(find.text('Stardust · Chosic'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('composer-music-remove')));
      await settle(tester);
      expect(find.byKey(const ValueKey('composer-music-add')), findsOneWidget);
    });

    testWidgets('«Shu musiqani ishlatish» — trek oldindan tanlangan', (tester) async {
      await pumpComposer(tester, ComposerKind.reel, extra: [
        pendingComposerMusicProvider.overrideWith((ref) =>
            const MusicTrack(id: 1, title: 'Ay bala', artist: 'NeomSongs')),
      ]);
      expect(find.byKey(const ValueKey('composer-music-picked')), findsOneWidget);
      expect(find.text('Ay bala · NeomSongs'), findsOneWidget);
    });
  });
}
