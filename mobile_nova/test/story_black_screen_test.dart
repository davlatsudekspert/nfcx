import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/avatar.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';

import 'helpers.dart';

/// Server hech qachon javob bermaydi — sekin internetning eng yomon holi.
class _SlowRepo extends SocialRepository {
  _SlowRepo() : super(ApiClient());
  final _never = Completer<Result<List<StoryItem>>>();

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) => _never.future;

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

/// ISTORYA OCHILGANDA QORA EKRAN YO'Q (egasi, 2026-09: "istorya ko'rsez
/// yo avatarni bosib ko'raman desez birinchi qora ekran chiqib keyin
/// boshlayabdi").
void main() {
  Future<ProviderContainer> open(
    WidgetTester tester, {
    List<StoryItem>? home,
  }) async {
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(_SlowRepo()),
      if (home != null) homeStoriesProvider.overrideWith((ref) async => home),
    ]);
    addTearDown(c.dispose);
    if (home != null) {
      // Bosh sahifa ekranda — provayder tirik va ma'lumoti bor.
      c.listen(homeStoriesProvider, (_, __) {});
      await c.read(homeStoriesProvider.future);
    }
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(const StoryViewerScreen(code: 'UZD772')),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    return c;
  }

  testWidgets('bosh sahifadagi istorya server javobini KUTMASDAN ochiladi',
      (tester) async {
    await open(tester, home: const [
      StoryItem(id: 7, code: 'UZD772', caption: 'SEED-ISTORYA'),
      StoryItem(id: 8, code: 'TTS075', caption: 'BOSHQA ODAM'),
    ]);
    expect(find.text('SEED-ISTORYA'), findsOneWidget,
        reason: 'server javob bermadi — ko‘ruvchi bosh sahifadagi tayyor '
            'istoryani ko‘rsatishi kerak edi');
    expect(find.text('BOSHQA ODAM'), findsNothing,
        reason: 'boshqa odamning istoryasi aralashmasin');
  });

  testWidgets('ro‘yxat hali yo‘q — qora bo‘sh ekran emas, surat va yopish',
      (tester) async {
    await open(tester);
    expect(find.byType(Avatar), findsOneWidget,
        reason: 'yuklanish paytida egasining surati ko‘rinsin');
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsOneWidget,
        reason: 'kutib qolgan odam chiqib keta olsin');
  });

  testWidgets('video ochilmaguncha taymer YURMAYDI (sekin internet)',
      (tester) async {
    final c = await open(tester, home: const [
      StoryItem(
          id: 1,
          code: 'UZD772',
          mediaUrl: 'https://nfcstore.uz/uploads/a.mp4',
          isVideo: true),
      StoryItem(id: 2, code: 'UZD772', caption: 'IKKINCHI'),
    ]);
    expect(c, isNotNull);
    // Video test muhitida ochilmaydi va xato beradi — shunda taymer
    // oddiy 5 soniya bilan boshlanadi. Ungacha istorya o'tib ketmaydi.
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('IKKINCHI'), findsNothing);
  });
}
