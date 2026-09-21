import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/activity_repository.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// BILDIRISHNOMALAR — sayt bilan BITTA manbadan.
///
/// Ilgari ekran `/api/records/:code/analytics` javobidan `events`
/// kalitini o'qirdi — server esa uni HECH QACHON yubormaydi. Ro'yxat
/// DOIM bo'sh edi va E2E buni "0 ta hodisa" deb yozib turardi.
class _FakeActivityRepo extends ActivityRepository {
  _FakeActivityRepo({this.fail = false}) : super(ApiClient());

  final bool fail;
  final readCalls = <int>[];
  var readAllCalls = 0;
  var unread = 2;

  @override
  Future<Result<NotificationPage>> list({int cursor = 0}) async {
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return Ok(NotificationPage(
      unreadCount: unread,
      items: [
        const ActivityEvent(
          id: 1,
          kind: ActivityKind.follow,
          title: 'Zafar',
          actorCode: 'ZZZ777',
          read: false,
        ),
        const ActivityEvent(
          id: 2,
          kind: ActivityKind.like,
          title: 'Ali',
          targetCode: 'TTS075',
          targetType: 'post',
          targetId: '10',
          read: false,
        ),
        const ActivityEvent(
          id: 3,
          kind: ActivityKind.comment,
          title: 'Dilnoza',
          targetCode: 'TTS075',
          read: true,
        ),
      ],
    ));
  }

  @override
  Future<Result<int>> markRead(int id) async {
    readCalls.add(id);
    unread = unread > 0 ? unread - 1 : 0;
    return Ok(unread);
  }

  @override
  Future<Result<int>> markAllRead() async {
    readAllCalls++;
    unread = 0;
    return const Ok(0);
  }
}

void main() {
  Future<_FakeActivityRepo> pump(WidgetTester tester, {bool fail = false}) async {
    final repo = _FakeActivityRepo(fail: fail);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        activityRepositoryProvider.overrideWithValue(repo),
      ],
      // Bildirishnoma bosilganda `context.push` chaqiriladi, ya'ni
      // HAQIQIY GoRouter kerak. Yalang'och `MaterialApp` da bu
      // asinxron istisno bo'lib chiqadi va sinov tekshiruvga yetib
      // ham bormaydi. Ichma-ich marshrut haqiqiy stekni beradi.
      child: MaterialApp.router(
        routerConfig: GoRouter(
          initialLocation: '/activity',
          routes: [
            GoRoute(
              path: '/',
              builder: (_, __) => const SizedBox.shrink(),
              routes: [
                GoRoute(
                    path: 'activity',
                    builder: (_, __) => const ActivityScreen()),
                GoRoute(
                    path: 'u/:code',
                    builder: (_, __) => const SizedBox.shrink()),
              ],
            ),
          ],
        ),
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
    await settle(tester, frames: 20);
    return repo;
  }

  testWidgets('ro‘yxat HAQIQIY endpointdan keladi', (tester) async {
    await pump(tester);
    expect(find.text('Zafar'), findsOneWidget);
    expect(find.text('Ali'), findsOneWidget);
    expect(find.text('Dilnoza'), findsOneWidget);
  });

  testWidgets('jumla TILGA bog‘liq — serverdan tayyor matn kelmaydi',
      (tester) async {
    await pump(tester);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.activityFollowed), findsOneWidget);
    expect(find.text(l.activityLiked), findsOneWidget);
    expect(find.text(l.activityCommented), findsOneWidget);
  });

  testWidgets('bosilganda SERVERGA o‘qildi deb yuboriladi', (tester) async {
    final repo = await pump(tester);
    await tester.tap(find.text('Zafar'));
    await settle(tester, frames: 20);

    expect(repo.readCalls, contains(1),
        reason: 'o‘qildi serverga ketmadi — boshqa qurilmada '
            'o‘qilmagan bo‘lib qolardi');
  });

  testWidgets('allaqachon o‘qilgan yozuv qayta YUBORILMAYDI',
      (tester) async {
    final repo = await pump(tester);
    await tester.tap(find.text('Dilnoza'));
    await settle(tester, frames: 20);

    expect(repo.readCalls, isNot(contains(3)),
        reason: 'o‘qilgan yozuv uchun bekorga so‘rov ketdi');
  });

  testWidgets('"Hammasini o‘qildi" faqat o‘qilmagani BORLIGIDA',
      (tester) async {
    final repo = await pump(tester);
    final l = await L.delegate.load(const Locale('uz'));

    expect(find.text(l.activityMarkAll), findsOneWidget);
    await tester.tap(find.text(l.activityMarkAll));
    await settle(tester, frames: 20);

    expect(repo.readAllCalls, 1);
  });

  testWidgets('server yiqilsa — qayta urinish paneli, bo‘sh ro‘yxat emas',
      (tester) async {
    await pump(tester, fail: true);
    expect(find.byType(StatePanel), findsWidgets);
  });

  testWidgets('o‘qilmaganlar sanog‘i sahifadan keladi', (tester) async {
    await pump(tester);
    final ctx = tester.element(find.byType(ActivityScreen));
    final container = ProviderScope.containerOf(ctx);
    expect(container.read(unreadCountProvider), 2);
  });
}
