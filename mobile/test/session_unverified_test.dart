// SESSIYA TEKSHIRILMAY QOLGANDA ILOVA QULFLANIB QOLMASIN.
//
// QURILMADA AYNAN SHU BO'LDI. Ilova ochilganda token bor edi,
// lekin serverga ulanib bo'lmadi (o'sha paytda API ishlamayotgan
// edi). Ilova o'zini "kirgan" deb belgiladi, `user`, `cards` va
// `companies` esa BO'SH qoldi — ya'ni `active == null`.
//
// Natijada butun ilova jimgina qulflandi:
//   • Profil tabi "Hali profil yo'q" dedi — YOLG'ON, egasining
//     VIP001 profili ham, biznes profillari ham bor edi;
//   • QR tugmasi o'chiq qoldi (`onTap: active == null ? null : ...`);
//   • o'z istoryasi ko'rinmadi;
//   • biznes, buyurtma va sozlamalarga yo'l yopildi — ular profil
//     orqali ochiladi.
// Chiqish yo'li ham yo'q edi: na "Kirish", na "Qayta urinish".
//
// Egasi buni "hech narsa ishlamayapti, 50 ta sahifa qayerda" deb
// xabar qildi. Sahifalar joyida edi — hammasi shu bitta qulf
// ortida qolgan edi.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/state/app_state.dart';

void main() {
  AppState stateWith(MockClient client, {String? token}) =>
      AppState(api: Api(client: client)..token = token);

  group('Sessiya tasdiqlanmagan holat', () {
    test('TARMOQ YO‘Q — chiqarib yuborilmaydi, LEKIN belgilanadi', () async {
      // Internet yo'qligi chiqib ketish uchun sabab emas: token
      // saqlanadi. Muhimi — bo'sh ro'yxatlar "profil yo'q" deb
      // ko'rsatilmasligi kerak, shuning uchun bayroq qo'yiladi.
      final state = stateWith(
        MockClient((_) async => throw ApiError('offline')),
        token: 'saqlangan-token',
      );

      await state.verifyStoredSession();

      expect(state.sessionUnverified, isTrue,
          reason: 'bo‘sh ro‘yxat "profil yo‘q" bilan aralashmasin');
      expect(state.active, isNull);
    });

    test('QAYTA URINISH ishlasa — bayroq tushadi va shaxs qaytadi', () async {
      var attempt = 0;
      final state = stateWith(
        MockClient((r) async {
          attempt++;
          if (attempt == 1) throw ApiError('offline');
          if (r.url.path.endsWith('/api/auth/me')) {
            return http.Response(
              jsonEncode({
                'user': {'id': 1, 'email': 'a***@gmail.com'},
                'cards': [
                  {'code': 'VIP001', 'name': 'Muhammad', 'isPrimary': true},
                ],
              }),
              200,
            );
          }
          return http.Response(jsonEncode({'companies': []}), 200);
        }),
        token: 'saqlangan-token',
      );

      await state.verifyStoredSession();
      expect(state.sessionUnverified, isTrue);

      await state.retrySession();

      expect(state.sessionUnverified, isFalse);
      expect(state.phase, AuthPhase.signedIn);
      expect(state.active?.code, 'VIP001',
          reason: 'qayta urinishdan keyin profil joyiga qaytishi kerak');
    });

    test('TOKEN HAQIQATAN ESKIRGAN bo‘lsa — kirish ekraniga', () async {
      // Bu yerda server javob BERDI va foydalanuvchi yo'q dedi.
      // Bunday holatda odamni bo'sh ekranda ushlab turish xato:
      // u qayta kirishi kerak.
      final state = stateWith(
        MockClient((_) async =>
            http.Response(jsonEncode({'user': null, 'cards': []}), 200)),
        token: 'eskirgan-token',
      );

      await state.retrySession();

      expect(state.phase, AuthPhase.signedOut);
      expect(state.sessionUnverified, isFalse);
    });

    test('TOKEN UMUMAN YO‘Q — qayta urinish kirish ekraniga olib boradi',
        () async {
      final state = stateWith(MockClient((_) async => http.Response('{}', 200)));

      await state.retrySession();

      expect(state.phase, AuthPhase.signedOut);
      expect(state.sessionUnverified, isFalse);
    });
  });
}
