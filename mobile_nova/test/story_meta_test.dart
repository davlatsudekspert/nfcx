import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// ISTORYA SARLAVHASIDAGI VAQT VA EGASIGA KO'RISHLAR SONI.
///
/// Server `createdAt` va `viewCount` ni HAR DOIM yuborardi; model
/// `viewCount` ni tashlab yuborardi, sarlavhada esa vaqt umuman
/// yo'q edi — istorya 3 daqiqalikmi yoki 23 soatlikmi, bilinmasdi.
class _Repo extends SocialRepository {
  _Repo(this.items) : super(ApiClient());
  final List<StoryItem> items;

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(items);

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

void main() {
  group('StoryItem.fromJson', () {
    test('viewCount va createdAt o‘qiladi', () {
      final s = StoryItem.fromJson({
        'id': 7,
        'imageUrl': 'https://x/s.jpg',
        'createdAt': '2026-10-05T09:00:00Z',
        'likeCount': 2,
        'viewCount': 41,
      });
      expect(s.viewCount, 41);
      expect(s.createdAt, DateTime.utc(2026, 10, 5, 9));
    });

    test('created_at (snake_case) va epoch millisekund ham', () {
      final a = StoryItem.fromJson({'id': 1, 'created_at': '2026-10-05T09:00:00Z'});
      expect(a.createdAt, DateTime.utc(2026, 10, 5, 9));
      final ms = DateTime.utc(2026, 10, 5, 9).millisecondsSinceEpoch;
      final b = StoryItem.fromJson({'id': 2, 'createdAt': ms});
      expect(b.createdAt!.toUtc(), DateTime.utc(2026, 10, 5, 9));
    });

    test('viewCount yo‘q bo‘lsa 0, copyWith uni saqlaydi', () {
      expect(StoryItem.fromJson({'id': 1}).viewCount, 0);
      const s = StoryItem(id: 1, viewCount: 5);
      expect(s.copyWith(seen: true).viewCount, 5);
    });
  });

  group('storyAgo — uch tilda, ko‘plik shakli bilan', () {
    final now = DateTime(2026, 10, 5, 12);
    String uz(Duration d) => storyAgo(LUz(), now.subtract(d), now: now)!;

    test('sana bo‘lmasa — vaqt chizilmaydi', () {
      expect(storyAgo(LUz(), null), isNull);
    });

    test('uzbekcha', () {
      expect(uz(const Duration(seconds: 20)), LUz().storyTimeJustNow);
      expect(uz(const Duration(minutes: 5)), '5 daqiqa oldin');
      expect(uz(const Duration(hours: 3)), '3 soat oldin');
      expect(uz(const Duration(days: 2)), '2 kun oldin');
      // Telefon soati serverdan orqada — manfiy farq ham "hozirgina".
      expect(storyAgo(LUz(), now.add(const Duration(minutes: 2)), now: now),
          LUz().storyTimeJustNow);
    });

    test('ruscha — bir/bir nechta/ko‘p', () {
      String ru(Duration d) => storyAgo(LRu(), now.subtract(d), now: now)!;
      expect(ru(const Duration(hours: 1)), '1 час назад');
      expect(ru(const Duration(hours: 3)), '3 часа назад');
      expect(ru(const Duration(hours: 5)), '5 часов назад');
      expect(ru(const Duration(minutes: 21)), '21 минуту назад');
    });

    test('inglizcha — birlik/ko‘plik', () {
      String en(Duration d) => storyAgo(LEn(), now.subtract(d), now: now)!;
      expect(en(const Duration(hours: 1)), '1 hour ago');
      expect(en(const Duration(hours: 3)), '3 hours ago');
      expect(en(const Duration(days: 1)), '1 day ago');
    });
  });

  Future<void> pump(WidgetTester tester, StoryItem s, {bool own = false}) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(_Repo([s])),
        if (own) myIdsProvider.overrideWithValue(testIds),
      ],
      child: wrapScreen(StoryViewerScreen(code: s.code)),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  Future<void> tearDownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 11));
  }

  testWidgets('sarlavhada "3 soat oldin"', (tester) async {
    await pump(
      tester,
      StoryItem(
        id: 1,
        code: 'VIP001',
        authorName: 'M',
        authorAvatar: 'https://x/m.jpg',
        createdAt: DateTime.now().subtract(const Duration(hours: 3, minutes: 4)),
      ),
    );
    expect(find.text('3 soat oldin'), findsOneWidget);
    await tearDownTree(tester);
  });

  testWidgets('sanasiz istoryada vaqt chizilmaydi', (tester) async {
    await pump(
      tester,
      const StoryItem(
          id: 1, code: 'VIP001', authorName: 'M', authorAvatar: 'https://x/m.jpg'),
    );
    expect(find.byKey(const ValueKey('story-time')), findsNothing);
    await tearDownTree(tester);
  });

  testWidgets('O‘Z istoryasida ko‘z belgisi va ko‘rishlar soni', (tester) async {
    final own = testIds.first;
    await pump(tester, StoryItem(id: 1, code: own.code, viewCount: 41),
        own: true);
    final views = find.byKey(const ValueKey('story-views'));
    expect(views, findsOneWidget, reason: 'egasiga ko‘rishlar soni chiqmadi');
    expect(
        find.descendant(
            of: views, matching: find.byIcon(Icons.visibility_outlined)),
        findsOneWidget);
    expect(find.descendant(of: views, matching: find.text('41')),
        findsOneWidget);
    await tearDownTree(tester);
  });

  testWidgets('BEGONA istoryada ko‘rishlar soni ko‘rinmaydi', (tester) async {
    await pump(
      tester,
      const StoryItem(
          id: 1,
          code: 'VIP001',
          authorName: 'M',
          authorAvatar: 'https://x/m.jpg',
          viewCount: 41),
    );
    expect(find.byKey(const ValueKey('story-views')), findsNothing);
    expect(find.text('41'), findsNothing);
    await tearDownTree(tester);
  });
}
