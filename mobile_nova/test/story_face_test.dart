import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/avatar.dart';

import 'helpers.dart';

/// STORIES DOIRACHASI HECH QACHON BO'SH OQ DOIRA BO'LMASIN (egasi,
/// 2026-09 surat: "stories ring empty").
///
/// Server o'z istoryamda muallif suratini bermaydi, video istoryaning
/// fayli esa rasm sifatida ochilmaydi. Har bir holatda doirachada
/// yo HAQIQIY surat, yo to'g'ri odamning bosh harflari bo'lishi shart.
void main() {
  const me = NfcId(code: 'VIP001', name: 'Muhammad Aliyev');
  const meWithPhoto = NfcId(
      code: 'VIP001', name: 'Muhammad Aliyev', avatarUrl: 'https://x/me.jpg');

  group('storyFace', () {
    test('o‘zimniki, rasmli, hech qayerda surat yo‘q -> istorya rasmi', () {
      final f = storyFace(
          const StoryItem(id: 1, code: 'VIP001', mediaUrl: 'https://x/s.jpg'),
          me: me);
      expect(f.avatarUrl, 'https://x/s.jpg');
      expect(f.label, 'Muhammad Aliyev');
      expect(f.initials, 'MA');
    });

    test('o‘zimniki, VIDEO, surat yo‘q -> bosh harflar (video URL emas)', () {
      final f = storyFace(
          const StoryItem(
              id: 2, code: 'VIP001', mediaUrl: 'https://x/v.mp4', isVideo: true),
          me: me);
      expect(f.avatarUrl, isEmpty);
      expect(f.initials, 'MA');
    });

    test('o‘zimniki -> ID surati hisob suratidan ustun', () {
      final f = storyFace(
          const StoryItem(
              id: 3, code: 'VIP001', mediaUrl: 'https://x/v.mp4', isVideo: true),
          me: meWithPhoto,
          userAvatar: 'https://x/user.jpg');
      expect(f.avatarUrl, 'https://x/me.jpg');
    });

    test('o‘zimniki, ID suratsiz -> hisob surati', () {
      final f = storyFace(
          const StoryItem(id: 4, code: '', mediaUrl: 'https://x/s.jpg'),
          me: me,
          userAvatar: 'https://x/user.jpg');
      expect(f.avatarUrl, 'https://x/user.jpg');
    });

    test('begona, muallif surati bor -> o‘sha surat', () {
      final f = storyFace(
          const StoryItem(
              id: 5,
              code: 'UZD772',
              authorName: 'Oybek Karimov',
              authorAvatar: 'https://x/oybek.jpg',
              mediaUrl: 'https://x/v.mp4',
              isVideo: true),
          me: meWithPhoto);
      expect(f.avatarUrl, 'https://x/oybek.jpg');
      expect(f.initials, 'OK');
    });

    test('begona, suratsiz, rasmli istorya -> istorya rasmi, MENING suratim emas',
        () {
      final f = storyFace(
          const StoryItem(
              id: 6,
              code: 'UZD772',
              authorName: 'Oybek Karimov',
              mediaUrl: 'https://x/s.jpg'),
          me: meWithPhoto,
          userAvatar: 'https://x/user.jpg');
      expect(f.avatarUrl, 'https://x/s.jpg');
    });

    test('begona, suratsiz VIDEO, ismsiz -> uning kodi, MENING ismim emas',
        () {
      final f = storyFace(
          const StoryItem(
              id: 7, code: 'UZD772', mediaUrl: 'https://x/v.mp4', isVideo: true),
          me: meWithPhoto,
          userAvatar: 'https://x/user.jpg');
      expect(f.avatarUrl, isEmpty);
      expect(f.label, 'UZD772');
      expect(f.initials, 'UZ');
    });
  });

  testWidgets('bosh sahifa: har doirachada surat yoki bosh harflar',
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        homeStoriesProvider.overrideWith((ref) async => const [
              StoryItem(id: 1, code: '48210377', mediaUrl: 'https://x/s.jpg'),
              StoryItem(
                  id: 2,
                  code: 'UZD772',
                  authorName: 'Oybek Karimov',
                  mediaUrl: 'https://x/v.mp4',
                  isVideo: true),
              StoryItem(
                  id: 3,
                  code: 'TTS075',
                  authorName: 'Tohir',
                  authorAvatar: 'https://x/tohir.jpg',
                  mediaUrl: 'https://x/v2.mp4',
                  isVideo: true),
            ]),
      ],
      child: wrapScreen(const HomeScreen()),
    ));
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    final avatars = tester
        .widgetList<Avatar>(find.byType(Avatar, skipOffstage: false))
        .toList();
    final urls = avatars.map((a) => a.url).toList();
    expect(urls, contains('https://x/s.jpg'),
        reason: 'o‘z rasmli istoryam — istorya rasmi');
    expect(urls, contains('https://x/tohir.jpg'));
    expect(urls.where((u) => u.endsWith('.mp4')), isEmpty,
        reason: 'video fayl rasm o‘rnida ochilmaydi — bo‘sh oq doira');
    final oybek = avatars.firstWhere((a) => a.initials == 'OK');
    expect(oybek.url, isEmpty);
    for (final a in avatars) {
      expect(a.url.isNotEmpty || a.initials.isNotEmpty, isTrue,
          reason: 'bo‘sh doira: surat ham, harf ham yo‘q');
    }
  });
}
