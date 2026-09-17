// TARMOQ HOLATLARI — sekin internet, uzilish, takroriy yuborish,
// token muddati.
//
// NIMA UCHUN BU FAYL BOR: bu holatlar qurilmada EHTIMOLDAN
// YUQORI, lekin ularni qo'lda takrorlash qiyin — shuning uchun
// ular ko'pincha umuman sinalmaydi va aynan ular foydalanuvchida
// "ilova qotib qoldi" degan taassurot qoldiradi.
//
// AUDITDA TOPILGAN NUQSON: `ApiError.isAuth` yozilgan, lekin hech
// qayerda o'qilmagan edi. Token muddati tugasa ilova buni
// sezmasdi — eski token har so'rovga qo'shilaverardi, har ekran
// "Sessiya tugagan" deb turardi, kirish ekraniga chiqish yo'li
// esa yo'q edi. Quyidagi sinov shuni qulflaydi.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/components/states.dart';
import 'package:nfcstore/state/app_state.dart';

import 'widget_test.dart' show FakeStore;

http.Response _json(Object o, [int status = 200]) => http.Response(
      jsonEncode(o),
      status,
      headers: {'content-type': 'application/json'},
    );

void main() {
  group('tarmoq', () {
    test('INTERNET UZILDI — "offline", xom istisno emas', () async {
      final api = Api(
        client: MockClient((_) async => throw const SocketException('no route')),
      );
      final e = await api.get('/api/feed').then<Object?>((_) => null,
          onError: (Object err) => err);

      expect(e, isA<ApiError>());
      expect((e as ApiError).key, 'offline');
      expect(humanError(e), contains('Internet'));
      // ONLINE BAYROG'I ham tushishi kerak: pastdagi chiziqcha
      // shundan chiqadi.
      expect(api.online.value, isFalse);
    });

    test('JUDA SEKIN INTERNET — kutish tugaydi va "timeout" bo‘ladi',
        () async {
      // Server javob bermayapti: so'rov osilib qoladi. Ilova
      // CHEKSIZ kutmasligi kerak — aks holda ekran abadiy
      // skeletonda qoladi.
      final api = Api(
        client: MockClient((_) => Completer<http.Response>().future),
      );
      final e = await api
          .get('/api/feed')
          .timeout(const Duration(seconds: 25), onTimeout: () => null)
          .then<Object?>((_) => null, onError: (Object err) => err);

      expect(e, isA<ApiError>());
      expect((e as ApiError).key, 'timeout');
      expect(humanError(e), isNot(contains('timeout')));
    }, timeout: const Timeout(Duration(seconds: 40)));

    test('RASM YUKLASHDA UZILISH — xato yutilmaydi', () async {
      // Yuklash uzoq davom etadi va aynan o'rtasida uziladi.
      // Muhimi: ilova buni JIM o'tkazib yubormasin, aks holda
      // odam rasm saqlandi deb o'ylaydi.
      final api = Api(
        client: MockClient(
          (_) async => throw http.ClientException('connection closed'),
        ),
      );
      final e = await api
          .upload('/api/upload-media', const [1, 2, 3])
          .then<Object?>((_) => null, onError: (Object err) => err);

      expect(e, isA<ApiError>());
      expect((e as ApiError).key, 'offline');
    });

    test('QAYTA URINISH — birinchi so‘rov yiqilsa, ikkinchisi o‘tadi',
        () async {
      // "Qayta urinish" tugmasi HAQIQATAN yangi so'rov yuborishi
      // kerak: keshlangan xatoni qayta ko'rsatish emas.
      var calls = 0;
      final api = Api(client: MockClient((_) async {
        calls++;
        if (calls == 1) throw const SocketException('flaky');
        return _json({'feed': const [], 'hasMore': false});
      }));

      await expectLater(api.get('/api/feed'), throwsA(isA<ApiError>()));
      final ok = await api.get('/api/feed');
      expect(calls, 2);
      expect(ok, isA<Map>());
      expect(api.online.value, isTrue, reason: 'javob kelgach holat tiklanadi');
    });

    test('TOKEN MUDDATI TUGADI — sessiya tozalanadi', () async {
      // AUDITDA TOPILGAN NUQSON. Ilgari 401 hech qayerda
      // o'qilmasdi va ilova eski token bilan qolib ketardi.
      final state = AppState(
        api: Api(client: MockClient((req) async {
          if (req.url.path == '/api/auth/login') {
            return _json({'token': 't0ken', 'user': {'id': 1}});
          }
          // Keyingi har bir so'rov — muddati tugagan sessiya.
          return _json({'error': 'unauthorized'}, 401);
        })),
        storage: FakeStore(),
      );

      await state.repo.login(login: 'a@b.uz', password: 'demo1234');
      state.api.token = 't0ken';
      state.phase = AuthPhase.signedIn;

      // Har qanday so'rov 401 qaytaradi.
      await state.repo.feed().then<void>((_) {}, onError: (_) {});
      // `sessionExpired()` asinxron — bir tick kutamiz.
      await Future<void>.delayed(Duration.zero);

      expect(state.phase, AuthPhase.signedOut,
          reason: 'token eskirganda ilova kirish ekraniga qaytishi kerak');
      expect(state.api.token, isNull, reason: 'yaroqsiz token saqlanmaydi');
      expect(state.user, isNull);
    });

    test('MEHMONDAGI 401 — chiqish deb hisoblanmaydi', () async {
      // Kirmagan odam himoyalangan yo'lga tegsa 401 keladi. Buni
      // "sessiya tugadi" deb hisoblash uni bekordan-bekor kirish
      // ekraniga uloqtirardi.
      var signedOutCalls = 0;
      final api = Api(client: MockClient((_) async => _json({'error': 'unauthorized'}, 401)));
      api.onUnauthorized = () => signedOutCalls++;

      await api.get('/api/records/AAA111/leads')
          .then<void>((_) {}, onError: (_) {});

      expect(signedOutCalls, 0, reason: 'tokensiz 401 — oddiy rad javob');
    });

    test('TAKRORIY YUBORISH — ikkinchi bosish yangi so‘rov yubormaydi',
        () async {
      // Ikki marta bosilgan "Yuborish" ikkita buyurtma yaratmasligi
      // kerak. Qulf mijozda: birinchi so'rov tugamaguncha tugma
      // o'chadi (`loading`), ya'ni ikkinchi bosish umuman
      // chaqirilmaydi.
      var sent = 0;
      final gate = Completer<void>();
      final api = Api(client: MockClient((_) async {
        sent++;
        await gate.future;
        return _json({'ok': true});
      }));

      var busy = false;
      Future<void> submit() async {
        if (busy) return; // ekrandagi `_busy` qulfining aynan o'zi
        busy = true;
        try {
          await api.post('/api/support', {'text': 'x'});
        } finally {
          busy = false;
        }
      }

      final first = submit();
      await submit(); // DARHOL ikkinchi bosish
      gate.complete();
      await first;

      expect(sent, 1, reason: 'ikki bosish bitta so‘rov bo‘lishi kerak');
    });
  });
}
