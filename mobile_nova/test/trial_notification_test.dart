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
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// SINOV MUDDATI ESLATMASI (`trial_ending`) VA NOMA'LUM TURLAR.
///
/// Server bepul sinov tugashidan oldin tizim xabarini yuboradi: ism,
/// avatar, sarlavha yo'q; `targetId` — tugash sanasi. iOS'da (App
/// Store 3.1.1) xabar xaridga yo'naltirmasligi va narx aytmasligi
/// kerak — faqat sana.

class _Repo extends ActivityRepository {
  _Repo(this.rows) : super(ApiClient());

  final List<Map<String, dynamic>> rows;
  final marked = <int>[];

  @override
  Future<Result<NotificationPage>> list({int cursor = 0}) async =>
      Ok(NotificationPage(
        unreadCount: rows.length,
        items: [for (final r in rows) ActivityEvent.fromJson(r)],
      ));

  @override
  Future<Result<int>> markRead(int id) async {
    marked.add(id);
    return const Ok(0);
  }
}

Map<String, dynamic> _trial([String date = '2026-10-29']) => {
      'id': 81,
      'type': 'trial_ending',
      'title': '',
      'actorCode': '',
      'avatarUrl': '',
      'targetType': 'trial',
      'targetId': date,
      'read': false,
    };

/// Ochilgan har qanday manzil shu yerga yoziladi.
final _opened = <String>[];

Future<void> _pump(WidgetTester tester, _Repo repo,
    {Locale locale = const Locale('uz')}) async {
  Widget sink(BuildContext _, GoRouterState s) {
    _opened.add(s.uri.toString());
    return const SizedBox.shrink();
  }

  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      activityRepositoryProvider.overrideWithValue(repo),
    ],
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
              // Xarid, sozlamalar, profil — birortasi ham ochilmasligi
              // kerak.
              GoRoute(path: 'settings', builder: sink, routes: [
                GoRoute(path: ':sub', builder: sink),
              ]),
              GoRoute(path: 'shop', builder: sink),
              GoRoute(path: 'premium', builder: sink),
              GoRoute(path: 'u/:code', builder: sink),
            ],
          ),
        ],
        errorBuilder: sink,
      ),
      theme: buildTheme(NfcTokens.pearl),
      locale: locale,
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
}

void main() {
  setUp(_opened.clear);

  test('trial_ending — alohida tur, sana targetId da', () {
    final e = ActivityEvent.fromJson(_trial());
    expect(e.kind, ActivityKind.trial);
    expect(e.targetId, '2026-10-29');
  });

  group('trial_ending bildirishnomasi', () {
    testWidgets('NFCSTORE, brend muhri va sana bilan chiziladi',
        (tester) async {
      await _pump(tester, _Repo([_trial()]));
      final l = await L.delegate.load(const Locale('uz'));
      expect(find.text('NFCSTORE'), findsOneWidget);
      expect(find.text('Bepul sinov muddatingiz 29.10.2026 da tugaydi'),
          findsOneWidget);
      expect(find.text(l.activityTrialEnding('29.10.2026')), findsOneWidget);
      expect(find.byType(BrandSeal), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('bosilsa faqat o‘qildi — hech narsa ochilmaydi',
        (tester) async {
      final repo = _Repo([_trial()]);
      await _pump(tester, repo);
      await tester.tap(find.textContaining('29.10.2026'));
      await settle(tester, frames: 20);
      expect(repo.marked, [81]);
      expect(_opened, isEmpty);
      expect(find.byType(ActivityScreen), findsOneWidget);
    });

    testWidgets('ruscha va inglizcha matn', (tester) async {
      await _pump(tester, _Repo([_trial()]), locale: const Locale('ru'));
      expect(find.text('Бесплатный пробный период закончится 29.10.2026'),
          findsOneWidget);
      await _pump(tester, _Repo([_trial()]), locale: const Locale('en'));
      expect(find.text('Your free trial ends on 29.10.2026'), findsOneWidget);
    });

    test('xarid yoki narx haqida so‘z yo‘q (App Store 3.1.1)', () async {
      for (final code in ['uz', 'ru', 'en']) {
        final l = await L.delegate.load(Locale(code));
        final s = l.activityTrialEnding('29.10.2026').toLowerCase();
        for (final w in [
          'sotib', 'narx', 'to‘lov', "to'lov", 'premium', 'obuna',
          'куп', 'цен', 'оплат', 'подпис',
          'buy', 'price', 'purchase', 'pay', 'subscri', 'upgrade',
          'so‘m', 'сум', r'$',
        ]) {
          expect(s.contains(w), isFalse, reason: '$code: "$w" — $s');
        }
      }
    });

    testWidgets('buzuq sana — umumiy matn, yiqilmaydi', (tester) async {
      await _pump(tester, _Repo([_trial('2026-02-31'), {
        ..._trial(''),
        'id': 82,
      }]));
      final l = await L.delegate.load(const Locale('uz'));
      expect(tester.takeException(), isNull);
      expect(find.text(l.activityGeneric), findsNWidgets(2));
      expect(find.textContaining('null'), findsNothing);
    });
  });

  group('noma’lum tur', () {
    testWidgets('NFCSTORE nomidan umumiy qator, hech qayerga o‘tmaydi',
        (tester) async {
      final repo = _Repo([
        {
          'id': 90,
          'type': 'kelajakdagi_tur',
          'title': '',
          'code': 'ABC123',
          'targetType': 'nimadir',
          'targetId': 'xyz',
          'read': false,
        },
      ]);
      await _pump(tester, repo);
      final l = await L.delegate.load(const Locale('uz'));
      expect(tester.takeException(), isNull);
      expect(find.text('NFCSTORE'), findsOneWidget);
      expect(find.text(l.activityGeneric), findsOneWidget);
      expect(find.byType(BrandSeal), findsOneWidget);

      await tester.tap(find.text(l.activityGeneric));
      await settle(tester, frames: 20);
      expect(repo.marked, [90]);
      expect(_opened, isEmpty);
    });

    testWidgets('sarlavhali tizim xabari avvalgidek chiziladi',
        (tester) async {
      await _pump(tester, _Repo([
        {'id': 91, 'type': 'system', 'title': 'Texnik ishlar', 'read': true},
      ]));
      expect(find.text('Texnik ishlar'), findsOneWidget);
      expect(find.byType(BrandSeal), findsNothing);
    });
  });
}
