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

/// Profil: "Postlar | Reels" tablari HAQIQIY ro'yxatdan.
///
/// Reels alohida API emas — postlarning videolilari. Tablardagi sonlar
/// yig'indisi profil tepasidagi "Postlar" soniga TENG bo'lishi kerak
/// (egasining talabi: sonlar hamma joyda bir xil).
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
      ]);
}

void main() {
  testWidgets('tablar postlarni rasm va videoga ajratadi', (tester) async {
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
    // Tepadagi "Postlar" soni — hammasi (5), tablar — 3 + 2.
    expect(find.text('5'), findsOneWidget);
    expect(find.text('${l.profilePosts} · 3'), findsOneWidget);
    expect(find.text('${l.navReels} · 2'), findsOneWidget);
    expect(find.text('Rasm 0'), findsOneWidget);

    await tester.tap(find.text('${l.navReels} · 2'));
    await settle(tester, frames: 6);
    expect(find.text('Rasm 0'), findsNothing,
        reason: 'Reels tabida rasmli post ko‘rinyapti');
  });
}
