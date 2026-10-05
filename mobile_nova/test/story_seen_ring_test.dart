import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/avatar.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';

import 'helpers.dart';

/// BOSH SAHIFA HALQASI KO'RILGANDAN KEYIN DARHOL KULRANG.
///
/// Ilgari istorya ko'rilib qaytilsa ham doiracha oltin ("ko'rilmagan")
/// bo'lib turardi — ro'yxat serverdan qayta yuklanmaguncha. Bundan
/// tashqari halqa faqat odamning BIRINCHI istoryasiga qarardi.
class _Repo extends FakeSocialRepository {
  final seen = <int>[];

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async =>
      Ok(_home.where((s) => s.code == code).toList());

  @override
  Future<Result<void>> markStorySeen(int id) async {
    seen.add(id);
    return const Ok(null);
  }
}

const _home = [
  StoryItem(id: 2, code: 'UZD772', authorName: 'Oybek Karimov'),
  StoryItem(id: 3, code: 'UZD772', authorName: 'Oybek Karimov'),
  StoryItem(id: 4, code: 'TTS075', authorName: 'Tohir Aliyev'),
];

void main() {
  late _Repo repo;

  Future<void> pumpHome(WidgetTester tester) async {
    // Baland oyna — bosh sahifa dangasa ro'yxat, qator ko'rinsin.
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    repo = _Repo();
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const HomeScreen(),
          routes: [
            GoRoute(
              path: 'story/:code',
              builder: (_, s) =>
                  StoryViewerScreen(code: s.pathParameters['code']!),
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(repo),
        homeStoriesProvider.overrideWith((ref) async => _home),
      ],
      child: wrapRouter(router),
    ));
    await settle(tester, frames: 20);
  }

  /// Ko'ruvchi ochiqmi. `context.push` bilan ochilgani uchun marshrut
  /// manzili emas, ekranning o'zi tekshiriladi.
  bool viewerOpen() => find.byType(StoryViewerScreen).evaluate().isNotEmpty;

  /// Qatordagi doiracha "ko'rilmagan" (oltin halqa) mi.
  bool unseen(WidgetTester tester, String initials) {
    final a = tester
        .widgetList<Avatar>(find.byType(Avatar, skipOffstage: false))
        .firstWhere((a) => a.initials == initials && a.size == 68);
    return a.ringGradient != null;
  }

  Future<void> wait(WidgetTester tester, Duration d) async {
    for (var t = Duration.zero; t < d; t += const Duration(milliseconds: 100)) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> closeViewer(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.close_rounded).first);
    await settle(tester, frames: 10);
    expect(viewerOpen(), isFalse);
  }

  testWidgets('halqa faqat odamning HAMMA istoryasi ko‘rilganda kulrang '
      'bo‘ladi — qayta yuklashsiz', (tester) async {
    await pumpHome(tester);
    expect(unseen(tester, 'OK'), isTrue);
    expect(unseen(tester, 'TA'), isTrue);

    // Oybek'ning BIRINCHI istoryasini ko'rib yopamiz.
    await tester.tap(find.text('Oybek Karimov'));
    await wait(tester, const Duration(milliseconds: 600));
    expect(viewerOpen(), isTrue);
    await closeViewer(tester);
    expect(repo.seen, [2]);
    expect(unseen(tester, 'OK'), isTrue,
        reason: 'ikkinchi istorya ko‘rilmagan — halqa hali oltin bo‘lishi '
            'kerak');

    // Qayta ochilganda KO'RILMAGAN (ikkinchi) istoryadan boshlanadi.
    await tester.tap(find.text('Oybek Karimov'));
    await wait(tester, const Duration(milliseconds: 600));
    expect(repo.seen, [2, 3],
        reason: 'ko‘rilmagan istoryadan boshlanmadi');
    await closeViewer(tester);
    expect(unseen(tester, 'OK'), isFalse,
        reason: 'hamma istorya ko‘rildi — halqa qayta yuklashsiz '
            'kulrangga o‘tmadi');
    // Boshqa odam tegmagan.
    expect(unseen(tester, 'TA'), isTrue);
  });

  testWidgets('bosh sahifadan ochilgan ko‘ruvchi qator tartibida KEYINGI '
      'odamga o‘tadi va oxirida yopiladi', (tester) async {
    await pumpHome(tester);

    await tester.tap(find.text('Oybek Karimov'));
    await wait(tester, const Duration(milliseconds: 600));
    // Oybek: 2 ta istorya, keyin Tohir: 1 ta — jami ~15 soniya.
    await wait(tester, const Duration(seconds: 11));
    expect(viewerOpen(), isTrue,
        reason: 'birinchi odamdan keyin yopilib qoldi');
    expect(find.text('Tohir Aliyev'), findsWidgets);
    await wait(tester, const Duration(seconds: 6));
    await settle(tester, frames: 10);

    expect(viewerOpen(), isFalse, reason: 'oxirgi odamdan keyin yopilmadi');
    expect(repo.seen, [2, 3, 4]);
    expect(unseen(tester, 'OK'), isFalse);
    expect(unseen(tester, 'TA'), isFalse);
  });
}
