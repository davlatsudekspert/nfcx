import 'dart:convert';

import 'package:flutter/widgets.dart' show Size;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/deep_link.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'package:nfcstore/state/app_state.dart';

import 'widget_test.dart' show FakeStore;

/// TASHQI HAVOLA (APP LINK) OQIMI.
///
/// Jismoniy kartani tegizganda Android `https://nfcstore.uz/<kod>`
/// ni ilovaga beradi. Bu testlar shu havola PROFILNI OCHISHINI va —
/// bundan ham muhimi — QULFDAN O'TIB KETMASLIGINI tekshiradi.
void main() {
  // TELEFON KADRI. Standart test yuzasi 800×600 — ilova hech qachon
  // bunday nisbatda ishlamaydi va ekranlar shu sababli "to'lib
  // ketadi". Bu haqiqiy xato emas, test muhitining artefakti.
  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.physicalSize = const Size(390, 844) * 3;
    view.devicePixelRatio = 3;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher.views.first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  /// Har qanday so'rovga mos javob beradigan soxta server.
  MockClient server({List<String> hits = const []}) => MockClient((r) async {
        hits.add('${r.method} ${r.url.path}');
        if (r.url.path == '/api/auth/me') {
          return http.Response(
            jsonEncode({
              'user': {'id': 1, 'email': 'a@b.uz', 'name': 'Ega'},
              'cards': [
                {'code': 'AAA111', 'name': 'Ega', 'tier': 'silver'},
              ],
            }),
            200,
          );
        }
        if (r.url.path.startsWith('/api/records/')) {
          return http.Response(
            jsonEncode({'code': 'VIP001', 'name': 'Muhammad', 'tier': 'exclusive'}),
            200,
          );
        }
        return http.Response('{}', 200);
      });

  testWidgets('kelgan havola profilni ochadi va tap serverga yoziladi',
      (tester) async {
    final hits = <String>[];
    final state = AppState(
      api: Api(client: server(hits: hits)),
      storage: FakeStore({'nfc_session_token': 't'}),
    );
    final lock = AppLock(storage: FakeStore());

    await tester.pumpWidget(NfcstoreApp(
      state: state,
      lock: lock,
      links: DeepLinks(initial: Future.value(Uri.parse('https://nfcstore.uz/vip001'))),
    ));
    await tester.pumpAndSettle();

    // Statistika SERVERDA hisoblanadi: ilova `/api/tap/...` ni
    // chaqirishi shart, o'zi sanamasligi kerak.
    expect(hits.where((h) => h.contains('/api/tap/VIP001')), isNotEmpty);
    expect(find.text('VIP001'), findsWidgets);
  });

  testWidgets('QULF YOPIQ bo‘lsa havola profilni OCHMAYDI', (tester) async {
    final hits = <String>[];
    final state = AppState(
      api: Api(client: server(hits: hits)),
      storage: FakeStore({'nfc_session_token': 't'}),
    );
    // Qulf yoqilgan va hali ochilmagan.
    final lock = AppLock(storage: FakeStore());
    await lock.setPin('1234');
    lock.lock();

    await tester.pumpWidget(NfcstoreApp(
      state: state,
      lock: lock,
      links: DeepLinks(initial: Future.value(Uri.parse('https://nfcstore.uz/vip001'))),
    ));
    await tester.pumpAndSettle();

    // Hisobga kirilgan VA qulf yopiq — profil ochilmasligi shart.
    expect(state.phase, AuthPhase.signedIn);
    expect(lock.locked, isTrue);
    expect(hits.where((h) => h.contains('/api/tap/')), isEmpty);

    // Qulf ochilishi bilan kutib turgan havola ochiladi — havola
    // yo'qolmasligi kerak, aks holda karta "ishlamadi" bo'lardi.
    await lock.verifyPin('1234');
    await tester.pumpAndSettle();
    expect(hits.where((h) => h.contains('/api/tap/VIP001')), isNotEmpty);
  });

  testWidgets('begona havola e’tiborsiz qoldiriladi', (tester) async {
    final hits = <String>[];
    final state = AppState(
      api: Api(client: server(hits: hits)),
      storage: FakeStore({'nfc_session_token': 't'}),
    );

    await tester.pumpWidget(NfcstoreApp(
      state: state,
      lock: AppLock(storage: FakeStore()),
      links: DeepLinks(initial: Future.value(Uri.parse('https://example.com/vip001'))),
    ));
    // `pumpAndSettle` EMAS: bosh ekranda uzluksiz "shimmer"
    // animatsiyasi bor va u hech qachon tinchimaydi.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 120));
    }

    expect(hits.where((h) => h.contains('VIP001')), isEmpty);
    expect(hits.where((h) => h.contains('/api/tap/')), isEmpty);
  });

  test('plagin yo‘q bo‘lsa ham oqim yiqilmaydi', () async {
    // Testda platforma kanali yo'q: `DeepLinks` jimgina bo'sh natija
    // bermasa, BUTUN ilova ishga tushmasdan yiqilardi.
    final links = DeepLinks();
    expect(await links.initial(), isNull);
    // Oqim tugamasligi mumkin (platforma hodisalari cheksiz), shuning
    // uchun faqat OBUNA BO'LISH yiqilmasligi tekshiriladi.
    final sub = links.stream().listen((_) {});
    await sub.cancel();
  });
}
