import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore_v2/core/api.dart';
import 'package:nfcstore_v2/core/session.dart';

void main() {
  test('sign in refreshes account and sign out clears session', () async {
    final client = MockClient((request) async {
      final path = request.url.path;
      if (path == '/api/auth/login' && request.method == 'POST') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['login'], 'demo@example.com');
        expect(body['password'], 'secret123');
        return http.Response(
          jsonEncode({'token': 'token-login'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/auth/me' && request.method == 'GET') {
        expect(request.headers['authorization'], 'Bearer token-login');
        return http.Response(
          jsonEncode({
            'user': {'id': 7, 'email': 'demo@example.com', 'phone': '+998901234567'},
            'cards': [
              {
                'code': '12345678',
                'name': 'Demo User',
                'role': 'Creator',
                'isPrimary': true,
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/companies/mine' && request.method == 'GET') {
        return http.Response(
          jsonEncode({'companies': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/auth/logout' && request.method == 'POST') {
        return http.Response('{}', 200);
      }
      return http.Response('{"error":"not_found"}', 404);
    });

    final session = AppSession(api: ApiClient(client: client));
    addTearDown(session.dispose);

    await session.signIn('demo@example.com', 'secret123');
    expect(session.phase, SessionPhase.signedIn);
    expect(session.user?.email, 'demo@example.com');
    expect(session.activeProfile?.code, '12345678');
    expect(session.api.token, 'token-login');

    await session.signOut();
    expect(session.phase, SessionPhase.signedOut);
    expect(session.user, isNull);
    expect(session.activeProfile, isNull);
    expect(session.profiles, isEmpty);
    expect(session.api.token, isNull);
  });

  test('personal registration keeps free server-issued NFC ID active', () async {
    final client = MockClient((request) async {
      final path = request.url.path;
      if (path == '/api/auth/register' && request.method == 'POST') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['email'], 'new@example.com');
        expect(body['phone'], '+998901112233');
        expect(body['emailCode'], '654321');
        expect(body['tosAccepted'], true);
        return http.Response(
          jsonEncode({'token': 'token-register'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/auth/me' && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'user': {'id': 9, 'email': 'new@example.com'},
            'cards': [
              {
                'code': '87654321',
                'name': 'New User',
                'isPrimary': true,
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/companies/mine' && request.method == 'GET') {
        return http.Response(
          jsonEncode({'companies': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{"error":"not_found"}', 404);
    });

    final session = AppSession(api: ApiClient(client: client));
    addTearDown(session.dispose);

    final created = await session.signUp(
      email: 'new@example.com',
      phone: '+998901112233',
      password: 'Strong123!',
      code: '654321',
    );

    expect(created, isTrue);
    expect(session.phase, SessionPhase.signedIn);
    expect(session.activeProfile?.code, '87654321');
    expect(session.businessMode, isFalse);
  });

  test('business registration creates company after account and switches mode',
      () async {
    var companyCreated = false;
    final client = MockClient((request) async {
      final path = request.url.path;
      if (path == '/api/auth/register' && request.method == 'POST') {
        return http.Response(
          jsonEncode({'token': 'token-business'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/auth/me' && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'user': {'id': 10, 'email': 'biz@example.com'},
            'cards': [
              {
                'code': '11223344',
                'name': 'Business Owner',
                'isPrimary': true,
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/companies/mine' && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'companies': companyCreated
                ? [
                    {
                      'companyId': 'CAFE01',
                      'displayName': 'Cafe One',
                      'city': 'Andijan',
                    }
                  ]
                : []
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (path == '/api/companies' && request.method == 'POST') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['auto'], true);
        expect(body['displayName'], 'Cafe One');
        companyCreated = true;
        return http.Response(
          jsonEncode({'ok': true, 'companyId': 'CAFE01'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{"error":"not_found"}', 404);
    });

    final session = AppSession(api: ApiClient(client: client));
    addTearDown(session.dispose);

    final created = await session.signUp(
      email: 'biz@example.com',
      phone: '+998909998877',
      password: 'Strong123!',
      code: '123456',
      business: {
        'auto': true,
        'displayName': 'Cafe One',
        'city': 'Andijan',
        'description': 'Premium coffee and digital menu experience.',
        'category': 'cafe',
      },
    );

    expect(created, isTrue);
    expect(session.phase, SessionPhase.signedIn);
    expect(session.activeProfile?.code, '11223344');
    expect(session.companies.single.id, 'CAFE01');
    expect(session.activeCompany?.id, 'CAFE01');
    expect(session.businessMode, isTrue);
  });
}
