import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/screens/entry/verify_email.dart';
import 'package:nfcstore/state/app_state.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'widget_test.dart' show FakeStore;

/// JAVOB QAYTARMAYDIGAN XAVFSIZ XOTIRA.
///
/// Android'da `flutter_secure_storage` Keystore bilan ishlaydi va
/// ba'zi qurilmalarda BIRINCHI yozishda javob qaytarmay qolishi
/// mumkin. Bu stub aynan shu holatni yaratadi: `write()` hech
/// qachon tugamaydi va HECH QANDAY istisno chiqarmaydi — ya'ni
/// `try/catch` ni ham chetlab o'tadi.
class HangingStore extends FakeStore {
  @override
  Future<void> write({
    required String key,
    required String? value,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) => Completer<void>().future;
}

/// RO'YXATDAN O'TISH OQIMINING OXIRI.
///
/// NIMA UCHUN BU TEST BOR. Ilova "Email tasdiqlandi" ekranida
/// ABADIY OSILIB QOLARDI: kirish/ro'yxatdan o'tish ekranlari ildiz
/// `Navigator` iga PUSH qilinadi, ya'ni ular ilova ildizining
/// USTIDA turadi. Sessiya ochilgach ildiz `Shell` ga almashadi —
/// lekin u stekning TAGIDA qoladi va odam ustidagi eski ekranga
/// qarab o'tiraveradi.
///
/// Xato ekranni ochib ko'rgandagina sezilardi: kod to'g'ri
/// ishlardi, hech qanday istisno chiqmasdi, faqat NAVIGATSIYA
/// yozilmagan edi.
void main() {
  /// Ro'yxatdan o'tish muvaffaqiyatli — server token qaytaradi.
  MockClient okClient() => MockClient((req) async {
        final p = req.url.path;
        if (p == '/api/auth/register') {
          return http.Response(jsonEncode({'token': 'yangi-token'}), 200,
              headers: {'content-type': 'application/json'});
        }
        if (p == '/api/me') {
          return http.Response(
              jsonEncode({
                'user': {'id': 7, 'email': 'a@b.uz'},
                'cards': [],
              }),
              200,
              headers: {'content-type': 'application/json'});
        }
        return http.Response(jsonEncode({}), 200,
            headers: {'content-type': 'application/json'});
      });

  /// Haqiqiy tuzilma: ildiz ekran + uning USTIGA push qilingan
  /// tasdiqlash ekrani. Aynan shu joyda xato bor edi.
  Future<void> pumpFlow(WidgetTester tester, AppState state) async {
    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: buildTheme(),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const VerifyEmailScreen(
                    email: 'a@b.uz',
                    phone: '+998901112233',
                    password: 'Parol12345',
                    name: 'Ali',
                  ),
                )),
                child: const Text('ILDIZ'),
              ),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('ILDIZ'));
    await tester.pumpAndSettle();
  }

  testWidgets('tasdiqlangach ekran yopiladi va ildizga qaytadi', (tester) async {
    final state = AppState(api: Api(client: okClient()), storage: FakeStore());
    await pumpFlow(tester, state);
    expect(find.byType(VerifyEmailScreen), findsOneWidget);

    await tester.enterText(find.byType(EditableText).first, '123456');
    await tester.pump();
    // Muvaffaqiyat ekrani 900ms ko'rsatiladi, keyin sessiya ochiladi.
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    // ENG MUHIMI: tasdiqlash ekrani stekda QOLMASLIGI kerak.
    expect(find.byType(VerifyEmailScreen), findsNothing);
    expect(find.text('ILDIZ'), findsOneWidget);
    expect(state.phase, AuthPhase.signedIn);
  });

  testWidgets('xavfsiz xotira javob bermasa ham oqim TO‘XTAMAYDI',
      (tester) async {
    // QURILMADA KO'RILGAN XATO: "Email tasdiqlandi" chiqadi va
    // pastidagi belgi abadiy aylanaveradi.
    //
    // Sabab `completeRegistration()` ichida edi: u tokenni
    // saqlashni MUDDATSIZ kutardi. Keystore javob bermasa, u
    // `await` hech qachon tugamasdi — istisno ham chiqmasdi, ya'ni
    // xato ekrani ham ko'rinmasdi.
    //
    // Bu test tuzatishsiz YIQILADI: ekran stekda qolib ketadi.
    final state = AppState(api: Api(client: okClient()), storage: HangingStore());
    await pumpFlow(tester, state);

    await tester.enterText(find.byType(EditableText).first, '123456');
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    // Saqlash muddati (6s) tugashini kutamiz.
    await tester.pump(const Duration(seconds: 8));
    await tester.pumpAndSettle();

    expect(find.byType(VerifyEmailScreen), findsNothing,
        reason: 'Tasdiqlash ekrani yopilishi kerak edi');
    expect(state.phase, AuthPhase.signedIn);
    // Token xotirada — joriy sessiya to'liq ishlaydi.
    expect(state.api.token, 'yangi-token');
  });

  testWidgets('sessiya ochilmasa xato ko‘rinadi, belgi aylanavermaydi',
      (tester) async {
    // `/api/me` yiqiladi — hisob yaratilgan, lekin sessiya ochilmadi.
    final client = MockClient((req) async {
      if (req.url.path == '/api/auth/register') {
        return http.Response(jsonEncode({'token': 't'}), 200,
            headers: {'content-type': 'application/json'});
      }
      return http.Response(jsonEncode({'error': 'server_error'}), 500,
          headers: {'content-type': 'application/json'});
    });
    final state = AppState(api: Api(client: client), storage: FakeStore());
    await pumpFlow(tester, state);

    await tester.enterText(find.byType(EditableText).first, '123456');
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    // Ekran hali turibdi, lekin XATO bilan va davom etish tugmasi
    // bilan — abadiy aylanuvchi belgi bilan emas.
    expect(find.text('Davom etish'), findsOneWidget);
  });
}
