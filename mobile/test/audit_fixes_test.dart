import 'dart:convert';

import 'package:flutter/widgets.dart' show Size;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/screens/nfc/gift_offers.dart';
import 'package:nfcstore/state/app_state.dart';

import 'widget_test.dart' show FakeStore, wrap;
import 'settle.dart';

/// AUDIT TOPGAN KAMCHILIKLAR UCHUN TESTLAR.
///
/// Har biri AYNAN bitta buzilgan xulqni qo'riqlaydi — ular qaytib
/// kelmasin.
void main() {
  setUp(() {
    final view =
        TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.physicalSize = const Size(390, 844) * 3;
    view.devicePixelRatio = 3;
  });

  tearDown(() {
    final view =
        TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  group('Story lentasi', () {
    test('SERVERDAN keladi, o‘z ID‘laridan yasalmaydi', () async {
      final hits = <String>[];
      final repo = Repo(Api(client: MockClient((r) async {
        hits.add(r.url.path);
        return http.Response(
          jsonEncode({
            'feed': [
              {
                'code': 'aaa512',
                'name': 'Jasur',
                'stories': [
                  {'id': 1},
                  {'id': 2},
                ],
              },
            ],
          }),
          200,
        );
      })));

      final feed = await repo.storyFeed();
      expect(hits, contains('/api/stories/feed'));
      expect(feed.length, 1);
      expect(feed.first.code, 'AAA512');
      // Segmentlar soni — nechta istorya borligi.
      expect(feed.first.count, 2);
    });

    test('server yiqilsa BO‘SH lenta, xato emas', () async {
      final repo = Repo(Api(client: MockClient((_) async => http.Response('{}', 500))));
      // Bosh ekran lenta uchun butunlay xato holatiga o'tmasligi kerak.
      expect(await repo.storyFeed(), isEmpty);
    });
  });

  group('Sovg‘a takliflari', () {
    test('kiruvchi va chiquvchi ajratiladi', () async {
      final repo = Repo(Api(client: MockClient((_) async => http.Response(
            jsonEncode({
              'incoming': [
                {'id': 7, 'code': 'vip001', 'fromEmail': 'a@b.uz'},
              ],
              'outgoing': [
                {'id': 9, 'code': 'aaa111', 'toEmail': 'c@d.uz'},
              ],
            }),
            200,
          ))));

      final res = await repo.giftOffers();
      expect(res.incoming.single.incoming, isTrue);
      expect(res.incoming.single.code, 'VIP001');
      // Kiruvchida YUBORUVCHI, chiquvchida OLUVCHI ko'rsatiladi.
      expect(res.incoming.single.email, 'a@b.uz');
      expect(res.outgoing.single.incoming, isFalse);
      expect(res.outgoing.single.email, 'c@d.uz');
    });

    testWidgets('qabul qilish SERVERGA yoziladi va egalik yangilanadi',
        (tester) async {
      final hits = <String>[];
      final state = AppState(
        api: Api(client: MockClient((r) async {
          hits.add('${r.method} ${r.url.path}');
          if (r.url.path == '/api/auth/me') {
            return http.Response(
              jsonEncode({
                'user': {'id': 1, 'email': 'a@b.uz'},
                'cards': [
                  {'code': 'AAA111', 'name': 'Men'},
                ],
              }),
              200,
            );
          }
          if (r.url.path == '/api/gift-offers') {
            return http.Response(
              jsonEncode({
                'incoming': [
                  {'id': 7, 'code': 'VIP001', 'fromEmail': 'a@b.uz'},
                ],
                'outgoing': const [],
              }),
              200,
            );
          }
          return http.Response('{"ok":true}', 200);
        })),
        storage: FakeStore({'nfc_session_token': 't'}),
      );

      await tester.pumpWidget(wrap(const GiftOffersScreen(), state));
      await settle(tester);

      expect(find.text('VIP001'), findsOneWidget);
      await tester.tap(find.text('Qabul qilish'));
      await settle(tester);

      expect(hits, contains('POST /api/gift-offers/7/accept'));
      // Qabul qilingandan keyin ID ro'yxati qayta so'ralishi SHART:
      // aks holda yangi ID ilovada umuman ko'rinmasdi.
      expect(hits.where((h) => h == 'GET /api/auth/me').length,
          greaterThanOrEqualTo(1));
    });

    testWidgets('bo‘sh bo‘lsa tushunarli yozuv', (tester) async {
      final state = AppState(
        api: Api(client: MockClient((_) async =>
            http.Response('{"incoming":[],"outgoing":[]}', 200))),
        storage: FakeStore(),
      );

      await tester.pumpWidget(wrap(const GiftOffersScreen(), state));
      await settle(tester);
      expect(find.text('Sovg‘a taklifi yo‘q'), findsOneWidget);
    });
  });

  group('Kontent yaratish', () {
    test('media XOM BINAR yuboriladi, base64 emas', () async {
      String? contentType;
      List<int>? body;
      final repo = Repo(Api(client: MockClient((r) async {
        contentType = r.headers['content-type'];
        body = r.bodyBytes;
        return http.Response('{"url":"/uploads/story_abc.jpg"}', 200);
      })));

      final url = await repo.uploadMedia(const [1, 2, 3], contentType: 'image/png');
      expect(url, '/uploads/story_abc.jpg');
      expect(contentType, 'image/png');
      expect(body, [1, 2, 3]);
    });

    test('istoryada rozilik SERVERGA uzatiladi', () async {
      Map<String, dynamic>? sent;
      final repo = Repo(Api(client: MockClient((r) async {
        sent = jsonDecode(r.body) as Map<String, dynamic>;
        return http.Response('{"ok":true}', 200);
      })));

      await repo.addStory('VIP001', imageUrl: '/uploads/s.jpg', agreed: true);
      // Server maydoni AYNAN `agreed` — boshqa nom bilan yuborilsa
      // so'rov 422 bilan qaytardi va sabab ko'rinmasdi.
      expect(sent!['agreed'], isTrue);
      expect(sent!['imageUrl'], '/uploads/s.jpg');
    });

    test('server manzil bermasa xato ko‘tariladi', () async {
      final repo = Repo(Api(client: MockClient((_) async => http.Response('{}', 200))));
      await expectLater(
        repo.uploadMedia(const [1]),
        throwsA(isA<ApiError>()),
      );
    });
  });

  group('ID boshqaruvi', () {
    test('o‘chirish DELETE bilan boradi', () async {
      final hits = <String>[];
      final repo = Repo(Api(client: MockClient((r) async {
        hits.add('${r.method} ${r.url.path}');
        return http.Response('{"ok":true}', 200);
      })));

      await repo.deleteRecord('AAA111');
      expect(hits.single, 'DELETE /api/records/AAA111');
    });

    test('parol o‘zgartirish joriy parolni yuboradi', () async {
      Map<String, dynamic>? sent;
      final repo = Repo(Api(client: MockClient((r) async {
        sent = jsonDecode(r.body) as Map<String, dynamic>;
        return http.Response('{"ok":true}', 200);
      })));

      await repo.changePassword(currentPassword: 'eski', newPassword: 'yangi1');
      expect(sent!['currentPassword'], 'eski');
      expect(sent!['newPassword'], 'yangi1');
    });
  });

  test('StoryFeedEntry — bo‘sh javob yiqilmaydi', () {
    final e = StoryFeedEntry.fromJson(const {});
    expect(e.code, '');
    expect(e.count, 0);
  });
}
