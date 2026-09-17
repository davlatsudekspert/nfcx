// 401 SESSIYA OQIMI — MARKAZIY, HAR EKRANDA EMAS.
//
// AUDITDA TOPILGAN NUQSON: `ApiError.isAuth` yozilgan edi, lekin
// hech qayerda O'QILMASDI. Token muddati tugasa ilova buni
// sezmasdi: eski token har so'rovga qo'shilaverardi, har ekran
// "Sessiya tugagan" deb turardi, kirish ekraniga chiqish yo'li esa
// yo'q edi.
//
// REFRESH-TOKEN MEXANIZMI LOYIHADA YO'Q. Server bitta shaffof
// sessiya tokeni beradi (`sessions` jadvali, `expires_at`),
// yangilash yo'li umuman mavjud emas. Shuning uchun bu yerda
// "refresh" TO'QIB CHIQARILMAYDI — uni faqat mijozda yasab
// bo'lmaydi va bor deb ko'rsatish yolg'on bo'lardi. 401 kelganda
// yagona to'g'ri yo'l — xavfsiz chiqish.
//
// QUYIDAGI SINOVLAR AYNAN SHUNI QULFLAYDI: qaysi holatda chiqish
// BO'LADI va — bundan ham muhimi — qaysi holatda BO'LMAYDI.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/state/app_state.dart';

import 'widget_test.dart' show FakeStore;

http.Response _json(Object o, [int status = 200]) => http.Response(
      jsonEncode(o),
      status,
      headers: {'content-type': 'application/json'},
    );

/// Kirgan holatdagi ilova — tokeni bor, hisobi bor.
Future<AppState> signedIn(MockClient client) async {
  final s = AppState(api: Api(client: client), storage: FakeStore());
  s.api.token = 't0ken';
  s.user = AppUser(id: 1, email: 'a@b.uz');
  s.phase = AuthPhase.signedIn;
  return s;
}

void main() {
  test('refresh mexanizmi YO‘Q deb ochiq belgilangan', () {
    // Bu shunchaki bayroq emas: u "nega refresh yozilmagan?" degan
    // savolga kodning o'zida javob beradi va kelajakda kimdir
    // mijozda soxta refresh yasashining oldini oladi.
    expect(Api.hasRefreshToken, isFalse);
  });

  group('401 sessiya oqimi', () {
    test('B/G — sessiya tugadi: token tozalanadi, kirish ekraniga qaytadi',
        () async {
      // Refresh yo'q, demak 401 = xavfsiz chiqish. Bu ham
      // "expired access + expired refresh" (B), ham "refresh
      // endpoint 401" (G) holatining yagona mumkin bo'lgan
      // natijasi: yangilaydigan narsaning o'zi yo'q.
      final s = await signedIn(
        MockClient((_) async => _json({'error': 'unauthorized'}, 401)),
      );
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      await s.repo.feed().then<void>((_) {}, onError: (_) {});
      await Future<void>.delayed(Duration.zero);

      expect(s.phase, AuthPhase.signedOut);
      expect(s.api.token, isNull, reason: 'yaroqsiz token saqlanmaydi');
      expect(s.user, isNull, reason: 'kesh tozalanadi');
      expect(uiCalls, 1, reason: 'xabar va navigatsiya BIR MARTA');
    });

    test('C — 5 ta parallel 401 bitta chiqish oqimini beradi', () async {
      // Ekran ochilganda o'nlab so'rov birga ketadi. Token eskirgan
      // bo'lsa hammasi 401 qaytaradi — qulfsiz bu o'nta chiqish,
      // o'nta navigatsiya va o'nta bir xil xabar bo'lardi.
      final s = await signedIn(
        MockClient((_) async => _json({'error': 'unauthorized'}, 401)),
      );
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      await Future.wait([
        for (var i = 0; i < 5; i++)
          s.repo.feed().then<void>((_) {}, onError: (_) {}),
      ]);
      await Future<void>.delayed(Duration.zero);

      expect(uiCalls, 1, reason: '5 ta 401 — bitta chiqish oqimi');
      expect(s.phase, AuthPhase.signedOut);
    });

    test('D — 403 sessiyani YOPMAYDI', () async {
      // 403 "ruxsat yetarli emas" degani: sessiya tirik, faqat shu
      // amalga haqing yo'q. Uni chiqish deb hisoblash odamni bitta
      // rad javob uchun butun sessiyasidan ayirardi.
      final s = await signedIn(
        MockClient((_) async => _json({'error': 'forbidden'}, 403)),
      );
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      await s.repo.feed().then<void>((_) {}, onError: (_) {});
      await Future<void>.delayed(Duration.zero);

      expect(s.phase, AuthPhase.signedIn, reason: 'sessiya saqlanadi');
      expect(s.api.token, 't0ken', reason: 'token o‘chirilmaydi');
      expect(uiCalls, 0);
    });

    test('E — kirishdagi 401 chiqish oqimini ISHGA TUSHIRMAYDI', () async {
      // Kirgan odam boshqa hisobga kirmoqchi bo'lib parolni xato
      // tersa, global oqim uni JORIY sessiyasidan ham chiqarib
      // yuborardi.
      final s = await signedIn(
        MockClient((req) async => req.url.path == '/api/auth/login'
            ? _json({'error': 'bad_credentials'}, 401)
            : _json({'ok': true})),
      );
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      await s.repo
          .login(login: 'boshqa@nfcstore.uz', password: 'xato')
          .then<void>((_) {}, onError: (_) {});
      await Future<void>.delayed(Duration.zero);

      expect(uiCalls, 0, reason: 'kirish xatosi — sessiya tugashi emas');
      expect(s.phase, AuthPhase.signedIn);
      expect(s.api.token, 't0ken');
    });

    test('F — internet uzilishi chiqish emas', () async {
      final s = await signedIn(
        MockClient((_) async => throw const SocketException('down')),
      );
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      await s.repo.feed().then<void>((_) {}, onError: (_) {});
      await Future<void>.delayed(Duration.zero);

      expect(uiCalls, 0, reason: 'tarmoq xatosi auth xatosi emas');
      expect(s.phase, AuthPhase.signedIn);
      expect(s.api.token, 't0ken', reason: 'offline bo‘lganda token saqlanadi');
    });

    test('H — 401 dan keyin cheksiz aylanish YO‘Q', () async {
      // Har 401 qayta-qayta chiqish chaqirsa, ekran yopilib-ochilib
      // turardi. Chiqish BIR MARTA bo'ladi, keyingi 401 lar esa
      // oddiy xato bo'lib qaytadi.
      var requests = 0;
      final s = await signedIn(MockClient((_) async {
        requests++;
        return _json({'error': 'unauthorized'}, 401);
      }));
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      for (var i = 0; i < 4; i++) {
        await s.repo.feed().then<void>((_) {}, onError: (_) {});
        await Future<void>.delayed(Duration.zero);
      }

      expect(uiCalls, 1, reason: 'takroriy 401 yangi chiqish bermaydi');
      expect(requests, 4, reason: 'so‘rovlar ketaveradi, lekin oqim bitta');
    });

    test('I — yangi kirish sessiya oqifini QAYTA YOQADI', () async {
      // Chiqqandan keyin odam qaytadan kiradi. Agar qulf tiklanmasa,
      // keyingi safar token eskirganda ilova buni umuman sezmasdi.
      final s = await signedIn(
        MockClient((_) async => _json({'error': 'unauthorized'}, 401)),
      );
      var uiCalls = 0;
      s.onSessionExpired = () => uiCalls++;

      await s.repo.feed().then<void>((_) {}, onError: (_) {});
      await Future<void>.delayed(Duration.zero);
      expect(uiCalls, 1);

      // Qaytadan kirish — yangi token.
      s.api.token = 'yangi';
      s.phase = AuthPhase.signedIn;

      await s.repo.feed().then<void>((_) {}, onError: (_) {});
      await Future<void>.delayed(Duration.zero);

      expect(uiCalls, 2, reason: 'yangi sessiya uchun oqim yana ishlaydi');
    });

    test('mehmonda 401 — chiqish oqimi ishlamaydi', () async {
      // Kirmagan odam himoyalangan yo'lga tegsa 401 keladi. Buni
      // "sessiya tugadi" deb hisoblash uni bekordan-bekor kirish
      // ekraniga uloqtirardi.
      var uiCalls = 0;
      final api = Api(
        client: MockClient((_) async => _json({'error': 'unauthorized'}, 401)),
      );
      api.onUnauthorized = () => uiCalls++;

      await api.get('/api/orders').then<void>((_) {}, onError: (_) {});

      expect(uiCalls, 0);
    });
  });
}
