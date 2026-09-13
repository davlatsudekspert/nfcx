import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';

/// Soxta server — haqiqiy tarmoqqa chiqmaydi.
MockClient mock(
  Future<http.Response> Function(http.Request req) handler, {
  List<http.Request>? log,
}) =>
    MockClient((req) async {
      log?.add(req);
      return handler(req);
    });

void main() {
  group('Sarlavhalar', () {
    test('X-Client har so‘rovda yuboriladi', () async {
      // Ro‘yxatdan o‘tish MANBASI shu sarlavhadan aniqlanadi — Android
      // ilovadan kelganlar admin "Trafik" bo‘limida ajratiladi.
      final log = <http.Request>[];
      final api = Api(client: mock((_) async => http.Response('{}', 200), log: log));
      await api.get('/api/auth/me');
      expect(log.single.headers['x-client'], 'android');
    });

    test('token bo‘lsa Bearer qo‘shiladi, bo‘lmasa yo‘q', () async {
      final log = <http.Request>[];
      final api = Api(client: mock((_) async => http.Response('{}', 200), log: log));
      await api.get('/api/auth/me');
      expect(log.last.headers.containsKey('authorization'), isFalse);

      api.token = 'abc123';
      await api.get('/api/auth/me');
      expect(log.last.headers['authorization'], 'Bearer abc123');
    });

    test('bo‘sh token o‘rnatilsa yo‘q hisoblanadi', () {
      final api = Api(client: mock((_) async => http.Response('{}', 200)));
      api.token = '';
      expect(api.token, isNull);
    });
  });

  group('Xatolar', () {
    test('server kaliti saqlanadi', () async {
      final api = Api(client: mock(
        (_) async => http.Response(jsonEncode({'error': 'bad_credentials'}), 401),
      ));
      await expectLater(
        api.post('/api/auth/login'),
        throwsA(isA<ApiError>()
            .having((e) => e.key, 'key', 'bad_credentials')
            .having((e) => e.status, 'status', 401)
            .having((e) => e.isAuth, 'isAuth', isTrue)),
      );
    });

    test('kalitsiz javob http_<kod> beradi', () async {
      final api = Api(client: mock((_) async => http.Response('<html>', 500)));
      await expectLater(
        api.get('/x'),
        throwsA(isA<ApiError>().having((e) => e.key, 'key', 'http_500')),
      );
    });

    test('tarmoq uzilishi offline deb belgilanadi', () async {
      final api = Api(client: mock((_) async => throw http.ClientException('yo‘q')));
      await expectLater(
        api.get('/x'),
        throwsA(isA<ApiError>().having((e) => e.isOffline, 'isOffline', isTrue)),
      );
    });

    test('buzuq JSON yiqitmaydi', () async {
      final api = Api(client: mock((_) async => http.Response('{buzuq', 200)));
      expect(await api.get('/x'), isNull);
    });
  });

  group('Repo', () {
    test('login tokenni saqlaydi', () async {
      final api = Api(client: mock(
        (_) async => http.Response(jsonEncode({'user': {'id': 1}, 'token': 'tok-1'}), 200),
      ));
      final token = await Repo(api).login(login: 'a@b.uz', password: 'x1234567');
      expect(token, 'tok-1');
      expect(api.token, 'tok-1');
    });

    test('tokensiz javob xato beradi', () async {
      // Bu jimgina o‘tib ketsa, odam "kirdim" deb o‘ylab, keyingi har
      // bir so‘rovda 401 olardi.
      final api = Api(client: mock(
        (_) async => http.Response(jsonEncode({'user': {'id': 1}}), 200),
      ));
      await expectLater(
        Repo(api).login(login: 'a@b.uz', password: 'x1234567'),
        throwsA(isA<ApiError>().having((e) => e.key, 'key', 'no_token')),
      );
    });

    test('/me foydalanuvchi va kartalarni ajratadi', () async {
      final api = Api(client: mock((_) async => http.Response(
            jsonEncode({
              'user': {'id': 7, 'email': 'a@b.uz'},
              'cards': [
                {'code': 'vip001', 'name': 'Aziz', 'isPrimary': true},
                {'code': 'aaa111', 'name': 'Ikkinchi'},
              ],
            }),
            200,
          )));
      final res = await Repo(api).me();
      expect(res.user!.id, 7);
      expect(res.cards.map((c) => c.code), ['VIP001', 'AAA111']);
    });

    test('kirmagan holatda /me bo‘sh qaytadi', () async {
      final api = Api(client: mock(
        (_) async => http.Response(jsonEncode({'user': null, 'cards': []}), 200),
      ));
      final res = await Repo(api).me();
      expect(res.user, isNull);
      expect(res.cards, isEmpty);
    });

    test('ko‘rish hisobining xatosi yutiladi', () async {
      // Statistika yozuvi tushmagani uchun profil ko‘rsatmaslik
      // mantiqsiz bo‘lardi.
      final api = Api(client: mock((_) async => http.Response('{"error":"boom"}', 500)));
      await Repo(api).markView('VIP001');
    });

    test('band qilish narxni SERVERDAN oladi', () async {
      // Mijoz yuborgan summaga ishonilmaydi — javobdagi narx ishlatiladi.
      late http.Request seen;
      final api = Api(client: mock((r) async {
        seen = r;
        return http.Response(
          jsonEncode({'pending': true, 'orderId': 42, 'code': 'GLD100', 'price': 149000, 'payLink': 'https://pay'}),
          202,
        );
      }));
      final order = await Repo(api).reserveRecord('GLD100');
      expect(order.id, 42);
      expect(order.price, 149000);
      expect(order.payLink, 'https://pay');
      expect(order.isPending, isTrue);
      // So‘rov tanasida narx umuman yuborilmaydi.
      expect(jsonDecode(seen.body) as Map, isNot(contains('price')));
    });
  });
}
