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

/// IZOH YOZISH — HAMMAGA BEPUL (egasining qarori, 2026-10-04).
///
/// Ilgari Premium'siz (yoki sinov muddati tugagan) odamga yozish
/// maydoni ochilmasdi — o'rnida "Izoh yozish — Premium a'zolar uchun"
/// qulf kartasi turardi. iPhone'da Premium'ni ilova ichida olib
/// bo'lmaydi (IAP yo'q) — Apple 3.1.1 bo'yicha rad etish sababi. Endi
/// HAMMA PLATFORMADA har kim yoza oladi; har tekshiruv iPhone va
/// Android'da ikki marta o'tadi.
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

/// Yozish maydoni bor, qulf va Premium haqida so'z yo'q.
void _expectOpenComposer() {
  expect(find.byKey(const ValueKey('comment-premium-locked')), findsNothing);
  expect(find.byIcon(Icons.lock_rounded), findsNothing);
  expect(find.byType(TextField), findsOneWidget);
  expect(find.byKey(const ValueKey('comment-rules-note')), findsOneWidget);
  expect(find.textContaining('Premium'), findsNothing);
}

void main() {
  final both = TargetPlatformVariant(
      {TargetPlatform.iOS, TargetPlatform.android});

  testWidgets('oddiy (Premium’siz) foydalanuvchi — yozish maydoni bor',
      (tester) async {
    await _pump(tester, testUser);
    _expectOpenComposer();
  }, variant: both);

  testWidgets('sinov muddati tugagan — baribir yoza oladi', (tester) async {
    final expired = User(
      id: 4,
      email: 'e@nfcstore.uz',
      name: 'Tugagan',
      phone: '',
      trialUntil: DateTime.now().subtract(const Duration(days: 1)),
    );
    await _pump(tester, expired);
    _expectOpenComposer();
  }, variant: both);

  testWidgets('Premium — avvalgidek yozadi', (tester) async {
    const premium = User(
      id: 2,
      email: 'p@nfcstore.uz',
      name: 'Premium',
      phone: '',
      premium: true,
    );
    await _pump(tester, premium);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.byKey(const ValueKey('comment-rules-note')), findsOneWidget);
  }, variant: both);
}
