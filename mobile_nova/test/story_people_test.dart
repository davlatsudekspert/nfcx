import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';

import 'helpers.dart';

/// ODAMLAR ORASIDA O'TISH (Instagram kabi).
///
/// Ilgari bir odamning oxirgi istoryasi tugasa ko'ruvchi YOPILARDI —
/// keyingi odamni ko'rish uchun bosh sahifaga qaytib, yana bosish
/// kerak edi. Endi bosh sahifa qatori tartibida keyingi odamga
/// o'tiladi, ko'ruvchi faqat ENG OXIRGI odamdan keyin yopiladi.
class _Repo extends SocialRepository {
  _Repo(this.byCode) : super(ApiClient());

  final Map<String, List<StoryItem>> byCode;
  final seen = <int>[];

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async =>
      Ok(byCode[code] ?? const []);

  @override
  Future<Result<void>> markStorySeen(int id) async {
    seen.add(id);
    return const Ok(null);
  }
}

StoryItem _s(int id, String code, String name) => StoryItem(
      id: id,
      code: code,
      authorName: name,
      authorAvatar: 'https://x/$code.jpg',
    );

final _byCode = {
  'AAA001': [_s(1, 'AAA001', 'Ali'), _s(2, 'AAA001', 'Ali')],
  'BBB002': [_s(3, 'BBB002', 'Bobur')],
  'CCC003': [_s(4, 'CCC003', 'Vali')],
};

const _a = StoryOwner('AAA001');
const _b = StoryOwner('BBB002');
const _c = StoryOwner('CCC003');

void main() {
  late _Repo repo;

  /// Ko'ruvchini routerda ochadi. [queue] — bosh sahifa qo'yadigan
  /// navbat (u bo'lmasa — profil halqasidagi kabi bitta odam).
  Future<GoRouter> pump(
    WidgetTester tester,
    String code, {
    StoryQueue? queue,
  }) async {
    repo = _Repo(_byCode);
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('HOME')),
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
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapRouter(router),
    ));
    await tester.pump();
    if (queue != null) c.read(storyQueueProvider.notifier).state = queue;
    router.go('/story/$code');
    // `pumpAndSettle` EMAS — u taymerni oxirigacha aylantirib yuboradi.
    // 400 ms — sahifa o'tish animatsiyasi tugaydi (aks holda tegish
    // nuqtasi siljigan kadrga tushadi).
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    return router;
  }

  String where(GoRouter r) =>
      r.routerDelegate.currentConfiguration.uri.toString();

  /// Hozir kimning istoryasi ekranda — sarlavhadagi ism bo'yicha.
  void showing(String name) {
    expect(find.text(name), findsOneWidget, reason: '$name ko‘rinmayapti');
  }

  /// Bitta istorya (5 soniya) va odamlar orasidagi varaqlash.
  ///
  /// Mayda qadamlar bilan: taymer media tayyor bo'lgach KEYINGI kadrda
  /// boshlanadi — bitta katta `pump` uni o'tkazib yuborardi.
  Future<void> playOne(WidgetTester tester) async {
    for (var i = 0; i < 60; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> tapSide(WidgetTester tester, {required bool right}) async {
    final size = tester.view.physicalSize / tester.view.devicePixelRatio;
    await tester.tapAt(
        Offset(size.width * (right ? 0.8 : 0.2), size.height * 0.5));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
  }

  testWidgets('oxirgi istorya tugagach KEYINGI ODAMGA o‘tadi, '
      'eng oxirgi odamdan keyin yopiladi', (tester) async {
    final router = await pump(tester, 'AAA001',
        queue: const StoryQueue([_a, _b, _c], 0));
    showing('Ali');

    await playOne(tester); // Ali 1 -> Ali 2
    showing('Ali');
    await playOne(tester); // Ali 2 -> Bobur
    showing('Bobur');
    expect(find.text('Ali'), findsNothing);
    expect(where(router), '/story/AAA001',
        reason: 'birinchi odam tugashi bilan ko‘ruvchi yopildi');

    await playOne(tester); // Bobur -> Vali
    showing('Vali');
    expect(where(router), '/story/AAA001');

    await playOne(tester); // Vali — eng oxirgi odam
    await tester.pumpAndSettle();
    expect(where(router), '/',
        reason: 'eng oxirgi odamdan keyin ko‘ruvchi yopilmadi');
    // Har bir istorya serverga bir marta, ko'ringan tartibda.
    expect(repo.seen, [1, 2, 3, 4]);
  });

  testWidgets('o‘ngga tegish oxirgi istoryadan keyingi odamga, '
      'chapga tegish birinchisidan OLDINGI odamga o‘tkazadi', (tester) async {
    final router = await pump(tester, 'BBB002',
        queue: const StoryQueue([_a, _b, _c], 1));
    showing('Bobur');

    // Bobur'ning bitta istoryasi bor — o'ngga tegish Vali'ga o'tkazadi.
    await tapSide(tester, right: true);
    showing('Vali');

    // Vali'ning birinchi istoryasida chapga — Bobur'ga qaytadi.
    await tapSide(tester, right: false);
    showing('Bobur');

    // Yana chapga — Ali (navbatdagi birinchi odam).
    await tapSide(tester, right: false);
    showing('Ali');
    expect(where(router), '/story/BBB002');

    // Birinchi odamning birinchi istoryasida chapga — hech qayerga
    // ketmaydi va yopilmaydi.
    await tapSide(tester, right: false);
    showing('Ali');
    expect(where(router), '/story/BBB002');
  });

  testWidgets('yon tomonga surish odam almashtiradi', (tester) async {
    await pump(tester, 'AAA001', queue: const StoryQueue([_a, _b, _c], 0));
    showing('Ali');

    await tester.fling(find.byKey(const ValueKey('story-pager')),
        const Offset(-300, 0), 1500);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    showing('Bobur');

    await tester.fling(find.byKey(const ValueKey('story-pager')),
        const Offset(300, 0), 1500);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    showing('Ali');
  });

  testWidgets('qo‘shni odamning istoryasi u ekranga kelmaguncha '
      '"ko‘rildi" deb yuborilmaydi', (tester) async {
    await pump(tester, 'AAA001', queue: const StoryQueue([_a, _b], 0));
    await tester.pump(const Duration(seconds: 1));
    expect(repo.seen, [1]);
  });

  testWidgets('navbatsiz (profil halqasi) — avvalgidek BITTA odam',
      (tester) async {
    final router = await pump(tester, 'BBB002');
    showing('Bobur');
    await playOne(tester);
    await tester.pumpAndSettle();
    expect(where(router), '/',
        reason: 'navbat bo‘lmasa ham boshqa odamga o‘tib ketdi');
  });

  testWidgets('BOSHQA odam uchun qo‘yilgan eskirgan navbat e’tiborsiz '
      'qoladi', (tester) async {
    // Navbat Ali uchun qo'yilgan, ochilgani esa Vali — profil
    // halqasidan kirilgan deb hisoblanadi.
    final router = await pump(tester, 'CCC003',
        queue: const StoryQueue([_a, _b, _c], 0));
    showing('Vali');
    await playOne(tester);
    await tester.pumpAndSettle();
    expect(where(router), '/');
  });

  testWidgets('navbat konstruktor orqali ham beriladi', (tester) async {
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(_Repo(_byCode)),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: wrapScreen(const StoryViewerScreen(
        code: 'BBB002',
        owners: [_a, _b, _c],
        initialIndex: 2,
      )),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    showing('Vali');
    await tapSide(tester, right: false);
    showing('Bobur');
    // Taymerlar (qo'riqchi, rasm keshi) ochiq qolmasin.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 11));
  });
}
