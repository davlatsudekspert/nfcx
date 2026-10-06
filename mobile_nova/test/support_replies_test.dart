import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/activity_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// YORDAM JAVOBLARI ILOVADA.
///
/// Ilgari Yordam ekrani faqat yuborardi: admin saytda javob yozsa ham
/// odam uni hech qayerda ko'rmasdi.

/// Murojaatlar xotirada; yuborilgani ro'yxat tepasiga tushadi.
class _SupportRepo extends ProfileRepository {
  _SupportRepo(this.items) : super(ApiClient());

  List<SupportMessage> items;
  final sent = <String>[];
  var fetches = 0;

  @override
  Future<Result<void>> support(String message) async {
    sent.add(message);
    items = [
      SupportMessage(id: 900, message: message, createdAt: DateTime.now()),
      ...items,
    ];
    return const Ok(null);
  }

  @override
  Future<Result<List<SupportMessage>>> supportMessages() async {
    fetches++;
    return Ok(items);
  }
}

class _SupportActivityRepo extends ActivityRepository {
  _SupportActivityRepo() : super(ApiClient());

  @override
  Future<Result<NotificationPage>> list({int cursor = 0}) async =>
      Ok(NotificationPage(
        unreadCount: 1,
        items: [
          // Server yuborgan shakl: tizim xabari — ism ham avatar ham yo'q.
          ActivityEvent.fromJson(const {
            'id': 77,
            'type': 'support_reply',
            'title': '',
            'avatarUrl': '',
            'targetType': 'support',
            'targetId': '42',
            'read': false,
          }),
        ],
      ));

  @override
  Future<Result<int>> markRead(int id) async => const Ok(0);
}

final _now = DateTime.now();

List<SupportMessage> _sample() => [
      SupportMessage(
        id: 4,
        message: 'Rejadagi taklif',
        status: SupportStatus.planned,
        createdAt: _now.subtract(const Duration(hours: 1)),
      ),
      SupportMessage(
        id: 3,
        message: 'Hal bo‘lgan savol',
        status: SupportStatus.resolved,
        createdAt: _now.subtract(const Duration(hours: 2)),
      ),
      SupportMessage(
        id: 2,
        message: 'Profil rasmi yuklanmayapti',
        reply: 'Ilovani yangilang, tuzatildi.',
        status: SupportStatus.replied,
        createdAt: _now.subtract(const Duration(hours: 3)),
        repliedAt: _now.subtract(const Duration(minutes: 30)),
      ),
      SupportMessage(
        id: 1,
        message: 'Javobsiz murojaat',
        createdAt: _now.subtract(const Duration(days: 2)),
      ),
    ];

/// Oxirgi ochilgan manzil.
String? _opened;

Widget _app(GoRouter router) => MaterialApp.router(
      routerConfig: router,
      theme: buildTheme(NfcTokens.pearl),
      locale: const Locale('uz'),
      supportedLocales: L.supportedLocales,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );

void main() {
  setUp(() => _opened = null);

  group('SupportMessage.fromJson', () {
    test('to‘liq javob', () {
      final m = SupportMessage.fromJson(const {
        'id': 5,
        'message': 'Salom',
        'reply': 'Va alaykum',
        'status': 'replied',
        'createdAt': '2026-10-06 05:11:00',
        'repliedAt': '2026-10-06T06:00:00Z',
      });
      expect(m.id, 5);
      expect(m.message, 'Salom');
      expect(m.reply, 'Va alaykum');
      expect(m.hasReply, isTrue);
      expect(m.status, SupportStatus.replied);
      // Zonasiz SQLite vaqti — UTC deb o'qiladi.
      expect(m.createdAt, DateTime.utc(2026, 10, 6, 5, 11));
      expect(m.repliedAt, DateTime.utc(2026, 10, 6, 6));
    });

    test('noma’lum holat — pending, yo‘q maydonlar yiqitmaydi', () {
      final m = SupportMessage.fromJson(const {
        'id': '7',
        'status': 'escalated',
        'reply': null,
      });
      expect(m.id, 7);
      expect(m.status, SupportStatus.pending);
      expect(m.reply, isNull);
      expect(m.message, '');
      expect(m.createdAt, isNull);
      expect(m.repliedAt, isNull);
    });

    test('holatlar va bo‘sh javob', () {
      SupportStatus st(String s) =>
          SupportMessage.fromJson({'id': 1, 'status': s}).status;
      expect(st('pending'), SupportStatus.pending);
      expect(st('resolved'), SupportStatus.resolved);
      expect(st('planned'), SupportStatus.planned);
      expect(st('REPLIED'), SupportStatus.replied);
      expect(
          SupportMessage.fromJson(const {'id': 1, 'reply': '  '}).reply,
          isNull);
    });

    test('bildirishnoma support_reply — o‘z turi, filtrlanmaydi', () {
      final e = ActivityEvent.fromJson(const {
        'id': 3,
        'type': 'support_reply',
        'title': '',
        'targetType': 'support',
        'targetId': '42',
      });
      expect(e.kind, ActivityKind.support);
      expect(e.targetId, '42');
      final page = NotificationPage.fromJson(const {
        'items': [
          {'id': 3, 'type': 'support_reply', 'title': '', 'actorCode': ''},
        ],
      });
      expect(page.items, hasLength(1));
    });
  });

  group('Yordam ekrani', () {
    Future<_SupportRepo> pump(WidgetTester tester,
        {String location = Routes.settingsSupport}) async {
      // Ro'yxat to'liq ko'rinsin: `ListView` faqat ko'rinadiganini quradi.
      tester.view.physicalSize = const Size(900, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final repo = _SupportRepo(_sample());
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          profileRepositoryProvider.overrideWithValue(repo),
        ],
        child: _app(GoRouter(
          initialLocation: location,
          routes: [
            GoRoute(
              path: '/settings/support',
              builder: (_, s) => SupportScreen(
                  highlightId:
                      int.tryParse(s.uri.queryParameters['id'] ?? '')),
            ),
          ],
        )),
      ));
      await settle(tester, frames: 20);
      return repo;
    }

    testWidgets('murojaatlar, holatlar va NFCSTORE javobi ko‘rinadi',
        (tester) async {
      await pump(tester);
      final l = await L.delegate.load(const Locale('uz'));

      expect(find.text(l.supportMyMessages), findsOneWidget);
      expect(find.text('Profil rasmi yuklanmayapti'), findsOneWidget);
      expect(find.text('Javobsiz murojaat'), findsOneWidget);

      expect(find.text(l.supportStatusPending), findsOneWidget);
      expect(find.text(l.supportStatusReplied), findsOneWidget);
      expect(find.text(l.supportStatusResolved), findsOneWidget);
      expect(find.text(l.supportStatusPlanned), findsOneWidget);

      // Javob pufagi faqat javobli murojaatda.
      expect(find.text(l.supportReplyLabel), findsOneWidget);
      expect(find.text('Ilovani yangilang, tuzatildi.'), findsOneWidget);
      expect(find.byType(BrandSeal), findsOneWidget);

      // Eng yangisi tepada.
      final top = tester.getTopLeft(find.text('Rejadagi taklif')).dy;
      final bottom = tester.getTopLeft(find.text('Javobsiz murojaat')).dy;
      expect(top, lessThan(bottom));
    });

    testWidgets('yuborilgach ro‘yxat yangilanadi, ekran yopilmaydi',
        (tester) async {
      final repo = await pump(tester);
      final l = await L.delegate.load(const Locale('uz'));
      final before = repo.fetches;

      await tester.enterText(find.byType(TextField), 'Yangi savol');
      await tester.tap(find.text(l.actionConfirm));
      await settle(tester, frames: 20);

      expect(repo.sent, ['Yangi savol']);
      expect(repo.fetches, greaterThan(before),
          reason: 'yuborilgandan keyin ro‘yxat qayta so‘ralmadi');
      expect(find.text('Yangi savol'), findsOneWidget);
      expect(find.byType(SupportScreen), findsOneWidget);

      final fresh = tester.getTopLeft(find.text('Yangi savol')).dy;
      final older = tester.getTopLeft(find.text('Rejadagi taklif')).dy;
      expect(fresh, lessThan(older), reason: 'yangi murojaat tepada emas');
    });

    testWidgets('bo‘sh matn yuborilmaydi', (tester) async {
      final repo = await pump(tester);
      final l = await L.delegate.load(const Locale('uz'));
      await tester.tap(find.text(l.actionConfirm));
      await settle(tester);
      expect(repo.sent, isEmpty);
      expect(find.text(l.errRequired), findsOneWidget);
    });

    testWidgets('?id= bilan ochilsa — murojaat ajratiladi', (tester) async {
      await pump(tester, location: Routes.supportMessage(2));
      final screen = tester.widget<SupportScreen>(find.byType(SupportScreen));
      expect(screen.highlightId, 2);
      expect(find.text('Ilovani yangilang, tuzatildi.'), findsOneWidget);
    });
  });

  group('bildirishnoma support_reply', () {
    Future<void> pump(WidgetTester tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          activityRepositoryProvider.overrideWithValue(_SupportActivityRepo()),
        ],
        child: _app(GoRouter(
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
                    path: 'settings/support',
                    builder: (_, s) {
                      _opened = s.uri.toString();
                      return const SizedBox.shrink();
                    }),
              ],
            ),
          ],
        )),
      ));
      await settle(tester, frames: 20);
    }

    testWidgets('brend muhri va matn bilan chiziladi', (tester) async {
      await pump(tester);
      final l = await L.delegate.load(const Locale('uz'));
      expect(find.text(l.activitySupportReply), findsOneWidget);
      expect(find.byType(BrandSeal), findsOneWidget);
    });

    testWidgets('bosilsa Yordam ekrani o‘sha murojaat bilan ochiladi',
        (tester) async {
      await pump(tester);
      final l = await L.delegate.load(const Locale('uz'));
      await tester.tap(find.text(l.activitySupportReply));
      await settle(tester, frames: 20);
      expect(_opened, Routes.supportMessage(42));
    });
  });
}
