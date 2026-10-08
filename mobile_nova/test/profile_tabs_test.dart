import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// Profil: "Postlar | Ko'rgazma" tablari HAQIQIY ro'yxatdan (2026-10,
/// avval "Postlar | Reels").
///
/// Ko'rgazma alohida API emas — ko'rgazma postlari va rasmli reel'lar.
/// VIDEO postlar "Postlar" da qoladi (egasi ko'rib o'chira olsin).
/// Tablardagi sonlar yig'indisi profil tepasidagi "Postlar" soniga TENG
/// bo'lishi kerak (egasining talabi: sonlar hamma joyda bir xil).
class _Social extends FakeSocialRepository {
  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async => Ok([
        for (var i = 0; i < 3; i++)
          Post(id: i + 1, code: code, text: 'Rasm $i', createdAt: DateTime(2026)),
        for (var i = 0; i < 2; i++)
          Post(
            id: 10 + i,
            code: code,
            text: 'Video $i',
            mediaUrls: const ['https://nfcstore.uz/uploads/v.mp4'],
            isVideo: true,
            createdAt: DateTime(2026),
          ),
        Post(id: 20, code: code, text: 'Vitrina', showcase: true,
            createdAt: DateTime(2026)),
        Post(id: 21, code: code, text: 'Rasmli reel', reel: true,
            createdAt: DateTime(2026)),
      ]);
}

void main() {
  testWidgets('tablar: postlar (video ham) va ko‘rgazma', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 2600 * 3);
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
    // Tepadagi "Postlar" soni — hammasi (7), tablar — 5 + 2.
    expect(find.text('7'), findsOneWidget);
    expect(find.text('${l.profilePosts} · 5'), findsOneWidget);
    expect(find.text('${l.navShowcase} · 2'), findsOneWidget);
    expect(find.text('${l.navReels} · 2'), findsNothing);
    expect(find.text('Rasm 0'), findsOneWidget);
    expect(find.text('Vitrina'), findsNothing);

    await tester.tap(find.text('${l.navShowcase} · 2'));
    await settle(tester, frames: 6);
    expect(find.text('Rasm 0'), findsNothing,
        reason: 'Ko‘rgazma tabida oddiy post ko‘rinyapti');
    expect(find.text('Vitrina'), findsOneWidget);
    expect(find.text('Rasmli reel'), findsOneWidget);
    // O'z profilim — Ko'rgazma yaratish tugmasi.
    expect(find.byKey(const ValueKey('profile-showcase-create')),
        findsOneWidget);
  });
}
