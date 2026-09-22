import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore_v2/app.dart';
import 'package:nfcstore_v2/core/api.dart';
import 'package:nfcstore_v2/core/models.dart';
import 'package:nfcstore_v2/core/session.dart';
import 'package:nfcstore_v2/core/theme.dart';

void main() {
  Future<void> pumpShell(
    WidgetTester tester, {
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      final path = request.url.path;
      if (path.startsWith('/api/follow-stats/')) {
        return http.Response(
          jsonEncode({'followers': 193, 'following': 21, 'isFollowing': false}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/stories/feed') {
        return http.Response(
          jsonEncode({'feed': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/feed') {
        return http.Response(
          jsonEncode({
            'feed': [
              {
                'kind': 'post',
                'id': 1,
                'code': 'VIP001',
                'name': 'Muhammad',
                'caption': 'NFCSTORE preview reel',
                'likeable': true,
                'likeCount': 4,
                'commentCount': 2,
              }
            ],
            'hasMore': false,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/records/VIP001') {
        return http.Response(
          jsonEncode({
            'code': 'VIP001',
            'name': 'Muhammad',
            'role': 'Digital Identity',
            'about': 'Premium profile',
            'views': 1248,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/records/VIP001/posts') {
        return http.Response(
          jsonEncode({'posts': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/records') {
        return http.Response(
          jsonEncode({
            'records': [
              {'code': 'VIP001', 'name': 'Muhammad', 'role': 'Creator'}
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/companies') {
        return http.Response(
          jsonEncode({
            'companies': [
              {'companyId': 'NOIR01', 'displayName': 'NOIR Coffee'}
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{}', 200, headers: {'content-type': 'application/json'});
    });

    final session = AppSession(api: ApiClient(client: client))
      ..phase = SessionPhase.signedIn
      ..user = const AppUser(id: 1, email: 'preview@example.com')
      ..profiles = const [
        IdentityProfile(
          code: 'VIP001',
          name: 'Muhammad',
          role: 'Digital Identity',
          about: 'Premium profile',
          views: 1248,
          isPrimary: true,
        )
      ]
      ..activeProfile = const IdentityProfile(
        code: 'VIP001',
        name: 'Muhammad',
        role: 'Digital Identity',
        about: 'Premium profile',
        views: 1248,
        isPrimary: true,
      )
      ..companies = const [
        Company(
          id: 'NOIR01',
          name: 'NOIR Coffee',
          city: 'Tashkent',
          followers: 1200,
          views: 8400,
        )
      ];

    final theme = BrandThemeController();
    addTearDown(session.dispose);
    addTearDown(theme.dispose);

    await tester.pumpWidget(
      NfcstoreV2App(session: session, theme: theme),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    expect(tester.takeException(), isNull);
  }

  testWidgets('bottom navigation reaches every main section and back returns home',
      (tester) async {
    await pumpShell(tester);

    expect(find.textContaining('Your identity'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('nav-1')));
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.textContaining('Discover'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(const ValueKey('nav-2')));
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.textContaining('NFC'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(const ValueKey('nav-3')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Reels'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(const ValueKey('nav-4')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('VIP001'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.textContaining('Your identity'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('main shell has no overflow on compact Android-sized viewport',
      (tester) async {
    await pumpShell(tester, size: const Size(360, 800));

    for (final key in ['nav-1', 'nav-2', 'nav-3', 'nav-4', 'nav-0']) {
      await tester.tap(find.byKey(ValueKey(key)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      expect(tester.takeException(), isNull);
    }
  });
}
