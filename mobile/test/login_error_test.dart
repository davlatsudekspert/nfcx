// KIRISH XATOSI HAQIQIY SABABNI AYTADIMI.
//
// NIMA UCHUN BU TEST BOR: qurilmada kirish ishlamadi va ekranda
// "Nimadir noto'g'ri ketdi. Qayta urinib ko'ring" turardi. Bu jumla
// HAR QANDAY nosozlikda chiqardi — sertifikat xatosi ham, himoya
// qatlami bloklagani ham, serverning tokensiz javobi ham bir xil
// ko'rinardi. Natijada egasi ham, tuzatuvchi ham taxmin qilishga
// majbur edi.
//
// Endi har bir holat O'Z jumlasini beradi, tanilmagani esa kalitning
// o'zini ko'rsatadi.
import 'dart:convert';
import 'dart:io' show HandshakeException;

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/design/components/states.dart';

void main() {
  Repo repoWith(MockClient client) => Repo(Api(client: client));

  group('Kirish xatolari', () {
    test('parol xato bo‘lsa — aynan shu aytiladi', () async {
      final repo = repoWith(MockClient((_) async =>
          http.Response(jsonEncode({'error': 'bad_credentials'}), 401)));

      await expectLater(
        repo.login(login: 'a@b.uz', password: 'xxxxxx'),
        throwsA(isA<ApiError>()),
      );
      try {
        await repo.login(login: 'a@b.uz', password: 'xxxxxx');
      } catch (e) {
        expect(humanError(e), 'Login yoki parol noto‘g‘ri.');
      }
    });

    test('TANA TOKENSIZ BO‘LSA — COOKIE\'DAN OLINADI', () async {
      // QURILMADA AYNAN SHU BO‘LDI: server 200 qaytardi, tanada esa
      // token yo‘q edi va kirish "Server sessiya ochmadi" bilan
      // to‘xtardi. Holbuki `Set-Cookie` da o‘sha tokenning O‘ZI
      // turadi — server uni bitta jadvalda saqlaydi va
      // `Authorization: Bearer` orqali ham qabul qiladi.
      final repo = repoWith(MockClient((_) async => http.Response(
            jsonEncode({
              'user': {'id': 1, 'email': 'a***@gmail.com'},
            }),
            200,
            headers: {
              'content-type': 'application/json',
              'set-cookie':
                  'nfc_session=cookie-token-123; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
            },
          )));

      expect(
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx'),
        'cookie-token-123',
      );
    });

    test('TANADAGI TOKEN USTUN — cookie bo‘lsa ham', () async {
      final repo = repoWith(MockClient((_) async => http.Response(
            jsonEncode({'token': 'body-token'}),
            200,
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'nfc_session=cookie-token; Path=/',
            },
          )));

      expect(
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx'),
        'body-token',
      );
    });

    test('IKKALASI HAM BO‘LMASA — javob boshi xabarda ko‘rinadi', () async {
      // Na tanada, na cookie'da token bor — bu haqiqatan xato holat.
      // Muhimi: xabar KO'R bo'lmasin, javobning boshi ko'rinsin.
      final repo = repoWith(MockClient((_) async => http.Response(
            jsonEncode({
              'user': {'id': 1, 'email': 'a***@gmail.com'},
            }),
            200,
          )));

      try {
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');
        fail('token kelmasa xato bo‘lishi kerak');
      } catch (e) {
        expect('$e', 'no_token');
        expect(humanError(e), contains('sessiya ochmadi'));
        expect(errorDetail(e), contains('HTTP 200'));
        expect(errorDetail(e), contains('user'));
      }
    });

    test('HIMOYA QATLAMI BLOKLASA — HTML javob yo‘qolmaydi', () async {
      // Cloudflare va shunga o'xshash qatlamlar JSON emas, HTML
      // qaytaradi. Uni tashlab yuborsak, ekranda faqat "HTTP 403"
      // qolardi va sabab noma'lum bo'lardi.
      final repo = repoWith(MockClient((_) async => http.Response(
            '<!DOCTYPE html><html><head><title>Attention Required! '
            '| Cloudflare</title></head><body>Blocked</body></html>',
            403,
          )));

      try {
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');
        fail('403 xato bo‘lishi kerak');
      } catch (e) {
        expect(humanError(e), contains('rad etildi'));
        // Texnik qatorda javobning boshi turadi — aynan shu qator
        // ekranda ko'rsatiladi va surat qilib yuboriladi.
        expect(errorDetail(e), contains('Cloudflare'));
        expect(errorDetail(e), contains('403'));
      }
    });

    test('SERTIFIKAT xatosi "internet yo‘q" DEB ko‘rsatilmaydi', () async {
      // Eski Android'da tizimdagi ildiz sertifikatlar ro'yxati
      // eskirgan bo'ladi: brauzer o'zinikini ishlatgani uchun sayt
      // ochiladi, ilova esa aynan shu yerda to'xtaydi. Xabar boshqa
      // bo'lishi kerak — aks holda odam internetini qidiradi.
      final repo = repoWith(MockClient((_) async =>
          throw const HandshakeException('CERTIFICATE_VERIFY_FAILED')));

      try {
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');
        fail('sertifikat xatosi bo‘lishi kerak');
      } catch (e) {
        expect('$e', 'tls');
        expect(humanError(e), contains('Xavfsiz ulanish'));
      }
    });

    test('tanilmagan kalit YASHIRILMAYDI', () async {
      final repo = repoWith(MockClient((_) async =>
          http.Response(jsonEncode({'error': 'zang_zung'}), 418)));

      try {
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');
        fail('xato bo‘lishi kerak');
      } catch (e) {
        expect(humanError(e), contains('zang_zung'));
      }
    });

    test('server 500 — "urinib ko‘ring" deyiladi', () async {
      final repo = repoWith(
          MockClient((_) async => http.Response('gateway error', 502)));

      try {
        await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');
        fail('xato bo‘lishi kerak');
      } catch (e) {
        expect(humanError(e), contains('Serverda xatolik'));
      }
    });
  });

  group('So‘rovning o‘zi', () {
    test('MANZIL VA SARLAVHALAR — server kutgandek', () async {
      http.Request? sent;
      final repo = repoWith(MockClient((r) async {
        sent = r;
        return http.Response(jsonEncode({'token': 't0ken'}), 200);
      }));

      final token = await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');

      expect(token, 't0ken');
      expect(sent!.url.toString(), 'https://nfcstore.uz/api/auth/login');
      expect(sent!.method, 'POST');
      // `X-Client` — server aynan shu sarlavhaga qarab tokenni javob
      // TANASIDA yuboradi (worker.js, `MOBILE_CLIENTS_D1` =
      // mobile | android | ios). Sarlavha yo'qolsa ham kirish
      // ishlaydi — token `Set-Cookie` dan olinadi (yuqoridagi test) —
      // lekin bu ZAXIRA yo'l, asosiysi shu sarlavha.
      expect(sent!.headers['x-client'], 'android');
      expect(
        jsonDecode(sent!.body),
        {'login': 'a@b.uz', 'password': 'xxxxxxxx'},
      );
    });

    test('token kelgach keyingi so‘rovda Bearer bilan ketadi', () async {
      final calls = <String?>[];
      final api = Api(client: MockClient((r) async {
        calls.add(r.headers['authorization']);
        return http.Response(jsonEncode({'token': 'abc', 'user': null}), 200);
      }));
      final repo = Repo(api);

      await repo.login(login: 'a@b.uz', password: 'xxxxxxxx');
      await repo.me();

      expect(calls.first, isNull);
      expect(calls.last, 'Bearer abc');
    });
  });
}
