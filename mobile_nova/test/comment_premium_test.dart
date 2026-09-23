import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/social/comments.dart';

import 'helpers.dart';

/// IZOH — FAQAT PREMIUM (server qoidasi, `comments.js`).
///
/// Egasi (2026-09 surat): Premium bo'lmagan odam yozib yuborgach
/// "Ruxsat yo'q" chiqardi, sababi aytilmasdi. Endi maydon umuman
/// ochilmaydi — o'rnida sababi yozilgan qulf kartasi.
class _Repo extends SocialRepository {
  _Repo() : super(ApiClient());

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));
}

Future<void> _pump(WidgetTester tester, User user) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      socialRepositoryProvider.overrideWithValue(_Repo()),
      currentUserProvider.overrideWithValue(user),
    ],
    // Haqiqiy ekranda bo'lim `Scaffold` ichida turadi.
    child: wrapScreen(const Scaffold(
      body: SingleChildScrollView(
        child: CommentsSection(kind: 'post', id: 1),
      ),
    )),
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('Premium bo‘lmaganga maydon YO‘Q, qulf kartasi bor',
      (tester) async {
    await _pump(tester, testUser);
    expect(find.byKey(const ValueKey('comment-premium-locked')), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('Premium — yozish maydoni va qoidalar eslatmasi',
      (tester) async {
    const premium = User(
      id: 2,
      email: 'p@nfcstore.uz',
      name: 'Premium',
      phone: '',
      premium: true,
    );
    await _pump(tester, premium);
    expect(find.byKey(const ValueKey('comment-premium-locked')), findsNothing);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.byKey(const ValueKey('comment-rules-note')), findsOneWidget);
  });

  testWidgets('sinov muddatida yoza oladi (egasining qarori)',
      (tester) async {
    final trial = User(
      id: 3,
      email: 't@nfcstore.uz',
      name: 'Sinov',
      phone: '',
      trialUntil: DateTime.now().add(const Duration(days: 10)),
    );
    await _pump(tester, trial);
    expect(find.byKey(const ValueKey('comment-premium-locked')), findsNothing);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('sinov tugagan — yana qulf', (tester) async {
    final expired = User(
      id: 4,
      email: 'e@nfcstore.uz',
      name: 'Tugagan',
      phone: '',
      trialUntil: DateTime.now().subtract(const Duration(days: 1)),
    );
    await _pump(tester, expired);
    expect(find.byKey(const ValueKey('comment-premium-locked')), findsOneWidget);
  });
}
