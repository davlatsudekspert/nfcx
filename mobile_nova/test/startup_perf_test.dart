import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/routing/shell.dart';

import 'helpers.dart';

/// STARTUP VA TAB TEZLIGI (o'lchov, build 304 — 2026-10).
///
///   1. Bir xil GET so'rovlari bir vaqtda ikki marta ketmaydi.
///   2. Tez start: shu token bilan oxirgi tasdiqlangan sessiya darhol
///      ishlatiladi, `/api/auth/me` fonda tekshiradi.
///   3. Yashirin (preload) tablar Asosiy so'rovlari tugagach quriladi.

/// Xotiradagi Keychain.
class _MemStore extends SecureStore {
  _MemStore() : super(const FlutterSecureStorage());
  final data = <String, String>{};

  @override
  Future<String?> readToken() async => data['token'];
  @override
  Future<void> writeToken(String token) async => data['token'] = token;
  @override
  Future<void> clear() async {
    data.remove('token');
    data.remove('snap');
  }

  @override
  Future<String?> readSnapshot() async => data['snap'];
  @override
  Future<void> writeSnapshot(String json) async => data['snap'] = json;
}

/// So'rovlarni sanaydi; javob [gate] ochilguncha ushlanadi.
class _Server implements HttpClientAdapter {
  final calls = <String>[];
  Completer<void> gate = Completer<void>()..complete();
  Object? me = {
    'user': {'id': 7, 'email': 'a@b.uz', 'name': 'Yangi ism'},
    'cards': [
      {'code': 'AB1234', 'primary': true},
    ],
  };
  bool fail = false;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body,
      Future<void>? cancel) async {
    calls.add('${o.path}?${o.queryParameters}');
    await gate.future;
    if (fail) {
      throw DioException.connectionError(
          requestOptions: o, reason: 'offline');
    }
    final data = o.path == '/api/auth/me' ? me : {'feed': []};
    return ResponseBody.fromString(jsonEncode(data), 200, headers: {
      'content-type': ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _api(_Server server, _MemStore store) =>
    ApiClient(dio: Dio()..httpClientAdapter = server, store: store);

void main() {
  group('GET birlashtirish', () {
    test('bir vaqtda ikkita bir xil GET — serverga bitta so\'rov, '
        'ikkalasi ham javob oladi', () async {
      final server = _Server()..gate = Completer<void>();
      final api = _api(server, _MemStore());
      final a = api.get<Map<String, dynamic>>('/api/feed',
          query: {'page': 1, 'limit': 15});
      final b = api.get<Map<String, dynamic>>('/api/feed',
          query: {'limit': 15, 'page': 1});
      expect(api.inFlight.value, 1);
      server.gate.complete();
      final ra = await a, rb = await b;
      expect(server.calls, hasLength(1));
      expect(ra, isA<Ok<Map<String, dynamic>>>());
      expect(rb, isA<Ok<Map<String, dynamic>>>());
      expect(api.inFlight.value, 0);
    });

    test('tugagan so\'rov saqlanmaydi (kesh emas) — keyingisi yangi', () async {
      final server = _Server();
      final api = _api(server, _MemStore());
      await api.get<Map<String, dynamic>>('/api/feed');
      await api.get<Map<String, dynamic>>('/api/feed');
      expect(server.calls, hasLength(2));
    });

    test('boshqa so\'rov parametri yoki boshqa token — alohida', () async {
      final server = _Server()..gate = Completer<void>();
      final api = _api(server, _MemStore());
      final a = api.get<Map<String, dynamic>>('/api/feed', query: {'page': 1});
      final b = api.get<Map<String, dynamic>>('/api/feed', query: {'page': 2});
      api.debugSetTokenForTest('t2');
      final c = api.get<Map<String, dynamic>>('/api/feed', query: {'page': 1});
      server.gate.complete();
      await Future.wait([a, b, c]);
      expect(server.calls, hasLength(3));
    });
  });

  group('tez start (saqlangan sessiya)', () {
    test('me() javobi shu token bilan saqlanadi; boshqa tokenga '
        'berilmaydi; chiqishda o\'chadi', () async {
      final store = _MemStore();
      final server = _Server();
      final api = _api(server, store);
      await api.setToken('tok-A');
      final repo = AuthRepository(api);
      expect(await repo.cachedSession(), isNull);

      expect(await repo.me(), isA<Ok>());
      await Future<void>.delayed(Duration.zero);
      expect(store.data['snap'], isNotNull);
      expect(store.data['snap'], isNot(contains('tok-A')),
          reason: 'token ikkinchi marta yozilmaydi');
      final cached = await AuthRepository(_api(server, store)).cachedSession();
      expect(cached!.user.name, 'Yangi ism');
      expect(cached.ids.single.code, 'AB1234');

      // Boshqa token — eski profil ko'rsatilmaydi.
      store.data['token'] = 'tok-B';
      expect(await AuthRepository(_api(server, store)).cachedSession(), isNull);

      // Chiqish — o'chadi.
      await api.setToken(null);
      expect(store.data['snap'], isNull);
    });

    test('user: null (sessiya tugagan) — saqlanmaydi', () async {
      final store = _MemStore();
      final server = _Server()..me = {'user': null, 'cards': []};
      final api = _api(server, store);
      await api.setToken('tok-A');
      expect(await AuthRepository(api).me(), isA<Err>());
      await Future<void>.delayed(Duration.zero);
      expect(store.data['snap'], isNull);
    });
  });

  group('SessionController — saqlangan sessiya bilan', () {
    Future<(_MemStore, _Server)> seeded() async {
      final store = _MemStore();
      final server = _Server()
        ..me = {
          'user': {'id': 7, 'email': 'a@b.uz', 'name': 'Eski ism'},
          'cards': [],
        };
      final api = _api(server, store);
      await api.setToken('tok-A');
      await AuthRepository(api).me();
      await Future<void>.delayed(Duration.zero);
      return (store, server);
    }

    test('Asosiy /me javobini KUTMAYDI; yangi javob kelgach yangilanadi',
        () async {
      final (store, server) = await seeded();
      server
        ..calls.clear()
        ..gate = Completer<void>()
        ..me = {
          'user': {'id': 7, 'email': 'a@b.uz', 'name': 'Yangi ism'},
          'cards': [],
        };
      final c = SessionController(AuthRepository(_api(server, store)));
      addTearDown(c.dispose);
      await pumpEventQueue();
      expect(c.state, isA<SessionActive>(),
          reason: 'server javobini kutmasdan faol');
      expect((c.state as SessionActive).user.name, 'Eski ism');
      expect(server.calls, ['/api/auth/me?{}'],
          reason: 'fonda tekshiruv ketgan');
      server.gate.complete();
      await pumpEventQueue();
      expect((c.state as SessionActive).user.name, 'Yangi ism');
    });

    test('server sessiyani rad etsa (user: null) — chiqariladi', () async {
      final (store, server) = await seeded();
      server.me = {'user': null, 'cards': []};
      final c = SessionController(AuthRepository(_api(server, store)));
      addTearDown(c.dispose);
      await pumpEventQueue();
      expect(c.state, isA<SessionAnonymous>());
      expect(store.data['token'], isNull);
      expect(store.data['snap'], isNull);
    });

    test('internet yo\'q — oxirgi tasdiqlangan sessiya qoladi', () async {
      final (store, server) = await seeded();
      server.fail = true;
      final c = SessionController(AuthRepository(_api(server, store)));
      addTearDown(c.dispose);
      await pumpEventQueue();
      expect(c.state, isA<SessionActive>());
      expect((c.state as SessionActive).user.name, 'Eski ism');
    });

    test('saqlangan sessiya yo\'q — oldingi yo\'l (Splash /me ni kutadi)',
        () async {
      final store = _MemStore()..data['token'] = 'tok-A';
      final server = _Server()..gate = Completer<void>();
      final c = SessionController(AuthRepository(_api(server, store)));
      addTearDown(c.dispose);
      await pumpEventQueue();
      expect(c.state, isA<SessionRestoring>());
      server.gate.complete();
      await pumpEventQueue();
      expect(c.state, isA<SessionActive>());
    });
  });

  group('yashirin tablar Asosiydan keyin', () {
    Future<(ProviderContainer, ApiClient)> host(
        WidgetTester t, int current, {bool busy = false}) async {
      final api = ApiClient(dio: Dio()..httpClientAdapter = _Server());
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        apiProvider.overrideWithValue(api),
      ]);
      addTearDown(c.dispose);
      if (busy) api.inFlight.value = 2;
      await t.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: FadingBranchContainer(
            currentIndex: current,
            children: [
              for (var i = 0; i < 4; i++) Text('tab$i', key: ValueKey('tab$i')),
            ],
          ),
        ),
      ));
      return (c, api);
    }

    Finder tab(int i) => find.byKey(ValueKey('tab$i'), skipOffstage: false);

    testWidgets('Asosiy so\'rovlari ketayotganda faqat faol tab quriladi; '
        'tarmoq bo\'shagach qolganlari', (t) async {
      final (_, api) = await host(t, 0, busy: true);
      await t.pump();
      expect(tab(0), findsOneWidget);
      expect(tab(1), findsNothing);
      expect(tab(3), findsNothing);
      api.inFlight.value = 1;
      await t.pump();
      expect(tab(1), findsNothing);
      api.inFlight.value = 0;
      await t.pump();
      for (var i = 0; i < 4; i++) {
        expect(tab(i), findsOneWidget);
      }
    });

    testWidgets('tarmoq bo\'shamasa ham ${FadingBranchContainer.warmupTimeout.inSeconds} s '
        'dan keyin quriladi', (t) async {
      await host(t, 0, busy: true);
      await t.pump(const Duration(seconds: 2));
      expect(tab(2), findsNothing);
      await t.pump(const Duration(seconds: 2));
      expect(tab(2), findsOneWidget);
    });

    testWidgets('so\'rov yo\'q (kesh/tarmoqsiz) — birinchi kadrdan keyin',
        (t) async {
      await host(t, 0);
      await t.pump();
      expect(tab(3), findsOneWidget);
    });

    testWidgets('isitishdan oldin bosilgan tab DARHOL quriladi', (t) async {
      final api = ApiClient(dio: Dio()..httpClientAdapter = _Server());
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        apiProvider.overrideWithValue(api),
      ]);
      addTearDown(c.dispose);
      api.inFlight.value = 3;
      Widget app(int current) => UncontrolledProviderScope(
            container: c,
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: FadingBranchContainer(
                currentIndex: current,
                children: [
                  for (var i = 0; i < 4; i++)
                    Text('tab$i', key: ValueKey('tab$i')),
                ],
              ),
            ),
          );
      await t.pumpWidget(app(0));
      await t.pump();
      expect(tab(3), findsNothing);
      await t.pumpWidget(app(3));
      expect(find.byKey(const ValueKey('tab3')), findsOneWidget);
      // Asosiy saqlanadi (holati yo'qolmaydi).
      expect(tab(0), findsOneWidget);
      await t.pump(const Duration(seconds: 4));
    });
  });

  test('AppError turi o\'zgarmagan (sanity)', () {
    expect(const AppError(AppErrorKind.offline).kind, AppErrorKind.offline);
    expect(const Ok(1), isA<Result<int>>());
    expect(NfcId.fromJson(const {'code': 'X'}).code, 'X');
  });
}
