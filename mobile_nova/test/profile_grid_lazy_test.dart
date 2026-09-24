import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/nova_scaffold.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/video_poster.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// PROFIL TO'RI DANGASA (performance auditi, SM-1).
///
/// Postlar to'ri `Wrap` edi: u HAMMA bolasini birdan quradi. Server
/// postlarni sahifalamay beradi, ya'ni 60 postli profil ochilishi
/// bilan 60 ta rasm yuklanib-dekodlanar va HAR video katakcha uchun
/// muqova navbatga (pleer ochish + bufer + kadr olish) qo'yilardi.
/// Profil tabi yashirin holda ham tirik turgani uchun bu xotira
/// bo'shamasdi.
///
/// Endi to'r sliver: faqat ekranga yaqin katakchalar quriladi,
/// pastga aylantirganda keyingilari paydo bo'ladi. Katakcha o'lchami
/// o'zgarmagan.
const _photo = 'assets/demo/z_post_cafe.jpg';

class _Social extends FakeSocialRepository {
  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async => Ok([
        for (var i = 0; i < 30; i++)
          Post(
            id: i + 1,
            code: code,
            text: 'Rasm $i',
            mediaUrls: const [_photo],
            createdAt: DateTime(2026),
          ),
        for (var i = 0; i < 30; i++)
          Post(
            id: 31 + i,
            code: code,
            text: 'Video $i',
            mediaUrls: ['https://nfcstore.uz/uploads/v$i.mp4'],
            isVideo: true,
            createdAt: DateTime(2026),
          ),
      ]);
}

/// To'rdagi QURILGAN rasm katakchalari — ekrandan tashqaridagi kesh
/// zonasidagilari ham (`skipOffstage: false`): ular ham rasm yuklaydi.
Finder _photoTiles() => find.byWidgetPredicate((w) {
      if (w is! Image) return false;
      final p = w.image;
      final a = p is ResizeImage ? p.imageProvider : p;
      return a is AssetImage && a.assetName == _photo;
    }, skipOffstage: false);

Finder _posters() => find.byType(VideoPoster, skipOffstage: false);

void main() {
  testWidgets('60 postli profil hamma katakchani birdan qurmaydi',
      (tester) async {
    VideoPoster.clearCache();
    VideoPlayerPlatform.instance = FakeVideoPlatform();
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[2])),
        socialRepositoryProvider.overrideWithValue(_Social()),
      ],
      child: wrapScreen(const ProfileScreen(), tokens: NfcTokens.ivory),
    ));
    await settle(tester, frames: 16);
    final l = await L.delegate.load(const Locale('uz'));
    expect(tester.takeException(), isNull);

    // Katakcha kengligi AVVALGIDEK: (ekran - 2*20 - 2*6) / 3.
    const side = (390 - 40 - 12) / 3;
    // Ekran + Flutter'ning 250 px kesh zonasi — ko'pi bilan ~6 qator.
    // `Wrap` da har doim 30 tadan 30 tasi qurilardi.
    const few = 18;

    // ── Postlar tabi: 30 ta rasm ───────────────────────────────
    final photos = _photoTiles().evaluate().length;
    expect(photos, greaterThan(0), reason: 'to‘r umuman chizilmadi');
    expect(photos, lessThanOrEqualTo(few),
        reason: 'ekranda ~1 qator ko‘rinadi, lekin $photos/30 rasm '
            'katakchasi qurilgan — to‘r dangasa emas');
    final photo = tester.getSize(_photoTiles().first);
    expect(photo.width, closeTo(side, .5));
    expect(photo.height, closeTo(side, .5));

    // ── Reels tabi: 30 ta video ────────────────────────────────
    await tester.tap(find.text('${l.navReels} · 30'));
    await settle(tester, frames: 6);
    final posters = _posters().evaluate().length;
    expect(posters, greaterThan(0));
    expect(posters, lessThanOrEqualTo(few),
        reason: '$posters/30 video muqovasi navbatga qo‘yilgan — har biri '
            'pleer ochadi');
    final reel = tester.getSize(find.byKey(const ValueKey('tile-31')));
    expect(reel.width, closeTo(side, .5));
    expect(reel.height, closeTo(side * 1.25, .5));

    // ── Pastga aylantirganda keyingilari quriladi ──────────────
    final scroll = find
        .descendant(
          of: find.byType(NovaScroll),
          matching: find.byType(Scrollable),
        )
        .first;
    const last = ValueKey('tile-60');
    expect(find.byKey(last, skipOffstage: false), findsNothing,
        reason: 'oxirgi video katakcha oldindan qurilgan');
    await tester.scrollUntilVisible(find.byKey(last), 300,
        scrollable: scroll);
    await settle(tester, frames: 4);
    expect(find.byKey(last), findsOneWidget);
    expect(tester.getSize(find.byKey(last)).width, closeTo(side, .5));

    // Eng pastda — tepadagi katakchalar bo'shatilgan.
    final pos = tester.state<ScrollableState>(scroll).position;
    pos.jumpTo(pos.maxScrollExtent);
    await settle(tester, frames: 4);
    expect(find.byKey(const ValueKey('tile-31'), skipOffstage: false),
        findsNothing,
        reason: 'ekrandan chiqqan katakcha xotirada qolib ketdi');
    expect(_posters().evaluate().length, lessThanOrEqualTo(few));
    expect(tester.takeException(), isNull);

    // Muqova navbatidagi taymerlar tugasin.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });
}
