import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// O'Z ISTORYANGDA EGASI KO'RINADI (egasi, 2026-09 surat).
///
/// `GET /api/records/:code/stories` istoryaga egasining kodi, ismi va
/// suratini qo'shmaydi. Natijada tepada bo'sh oq doira turardi, ism
/// yo'q edi, o'chirish o'rniga shikoyat tugmasi chiqardi.
class _Repo extends SocialRepository {
  _Repo() : super(ApiClient());

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => const Ok([
        // Server javobidagidek: kod, ism va surat YO'Q.
        StoryItem(id: 1, mediaUrl: 'https://nfcstore.uz/uploads/s.jpg'),
      ]);

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

void main() {
  testWidgets('o‘z istoryasida ism va o‘chirish tugmasi chiqadi',
      (tester) async {
    final own = testIds.first;
    final router = GoRouter(
      initialLocation: '/story/${own.code}',
      routes: [
        GoRoute(
          path: '/story/:code',
          builder: (_, s) => StoryViewerScreen(code: s.pathParameters['code']!),
        ),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(_Repo()),
        myIdsProvider.overrideWithValue(testIds),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(NfcTokens.mono),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text(own.name), findsOneWidget,
        reason: 'egasining ismi ko‘rinmadi');
    expect(find.byIcon(Icons.delete_outline_rounded), findsOneWidget,
        reason: 'o‘z istoryasida o‘chirish tugmasi yo‘q');
    expect(find.byKey(const ValueKey('story-actions')), findsNothing,
        reason: 'o‘z istoryasida shikoyat tugmasi chiqmasligi kerak');
  });
}
