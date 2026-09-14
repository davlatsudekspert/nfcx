import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/design/components/buttons.dart';
import 'package:nfcstore/design/components/input.dart';
import 'package:nfcstore/design/components/logo.dart';
import 'package:nfcstore/design/components/nav_bar.dart';
import 'package:nfcstore/design/components/states.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/screens/entry/login.dart';
import 'package:nfcstore/screens/identity/switcher.dart';
import 'package:nfcstore/state/app_state.dart';
import 'settle.dart';

/// Xotiradagi soxta saqlagich — testda haqiqiy Keystore yo'q.
class FakeStore extends FlutterSecureStorage {
  /// DIQQAT: standart qiymat `const {}` EMAS — u o'zgartirib
  /// bo'lmaydigan xarita va unga yozishga urinish "Cannot modify
  /// unmodifiable map" bilan yiqiladi.
  FakeStore([Map<String, String>? data]) : _data = data ?? <String, String>{};
  final Map<String, String> _data;

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async =>
      _data[key];

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
  }) async {
    if (value != null) _data[key] = value;
  }

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async =>
      _data.remove(key);
}

Widget wrap(Widget child, AppState state) => AppScope(
      state: state,
      child: MaterialApp(theme: buildTheme(), home: child),
    );

void main() {
  group('NavBar', () {
    testWidgets('besh tab: Activity YO‘Q', (tester) async {
      // ACTIVITY HALI HAM YO‘Q va bu qoida o‘zgarmadi: uning ortida
      // real backend feed bo‘lmaguncha soxta tab yasalmaydi.
      //
      // REELS esa qo‘shildi, chunki uning ortida HAQIQIY manba bor —
      // `GET /api/feed` (postlar va faol istoryalar). Ya‘ni tab soni
      // 4 dan 5 ga chiqqani "handoffga qaytish" emas: har bir tab
      // faqat ishlaydigan ma‘lumot ustiga qo‘yiladi.
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(),
        home: Scaffold(body: NavBar(active: 0, onSelect: (_) {})),
      ));
      expect(NavBar.tabs.length, 5);
      // YORLIQLAR O‘ZBEKCHA: interfeys tili o‘zbekcha, shuning
      // uchun tab nomlari ham tarjima qilinadi. "Reels" tarjima
      // qilinmaydi — u mahsulot atamasi va uch tilda ham shunday
      // yoziladi.
      expect(find.text('Bosh sahifa'), findsOneWidget);
      expect(find.text('Qidiruv'), findsOneWidget);
      expect(find.text('Reels'), findsOneWidget);
      expect(find.text('Profil'), findsOneWidget);
      expect(find.text('Activity'), findsNothing);

      // MARKAZIY TAB YORLIQSIZ: u brend medalyoni bilan
      // ko‘rsatiladi va "NFC" so‘zi ekranga chizilmaydi. Tabning
      // ma‘nosi `NavBar.tabs` da saqlanadi.
      expect(find.text('NFC'), findsNothing);
      expect(find.byType(BrandMark), findsOneWidget);
    });

    testWidgets('NFC markazda turadi', (tester) async {
      // Markaziy joy mahsulotning o‘zagini bildiradi — chekkaga
      // ko‘chirilsa dizayn mantig‘i buziladi.
      expect(NavBar.tabs[NavBar.nfcIndex].label, 'NFC');
      expect(NavBar.nfcIndex, 2);
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: NavBar(active: NavBar.nfcIndex, onSelect: (_) {})),
      ));
      // Markazda — brend medalyoni, boshqa tablarda bunday
      // element yo‘q.
      expect(find.byType(BrandMark), findsOneWidget);
    });

    testWidgets('bosilganda indeks uzatiladi', (tester) async {
      int? picked;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: NavBar(active: 0, onSelect: (i) => picked = i)),
      ));
      await tester.tap(find.byType(BrandMark));
      expect(picked, 2);
    });
  });

  group('Kirish ekrani', () {
    testWidgets('SMS kodi haqida hech narsa yo‘q', (tester) async {
      // NFCSTORE da SMS shlyuzi yo‘q. Odam SMS kod ekranini hech
      // qachon ko‘rmasligi kerak.
      final state = AppState(
        api: Api(client: MockClient((_) async => http.Response('{}', 200))),
        storage: FakeStore(),
      );
      await tester.pumpWidget(wrap(const LoginScreen(), state));
      await tester.pump();

      expect(find.textContaining('SMS'), findsNothing);
      // Yorliq "Email", izohda esa telefon ham ishlashi aytiladi —
      // server ikkalasini ham qabul qiladi.
      expect(find.textContaining('Email yoki telefon'), findsWidgets);
      // "Kirish" ekranda IKKI MARTA uchraydi va bu to‘g‘ri: biri —
      // yuqoridagi almashtirgichning faol bo‘limi, ikkinchisi —
      // formani yuboradigan tugma. Shuning uchun tugmaning o‘zi
      // qidiriladi, matn emas.
      expect(find.widgetWithText(PrimaryButton, 'Kirish'), findsOneWidget);
    });

    testWidgets('bo‘sh maydonda server chaqirilmaydi', (tester) async {
      var calls = 0;
      final state = AppState(
        api: Api(client: MockClient((_) async {
          calls++;
          return http.Response('{}', 200);
        })),
        storage: FakeStore(),
      );
      await tester.pumpWidget(wrap(const LoginScreen(), state));
      await tester.tap(find.widgetWithText(PrimaryButton, 'Kirish'));
      await tester.pump();

      expect(calls, 0);
      expect(find.textContaining('to‘liq kiriting'), findsOneWidget);
    });
  });

  group('Shaxs konteksti', () {
    test('asosiy ID avtomatik faol bo‘ladi', () async {
      final state = AppState(
        api: Api(client: MockClient((r) async {
          if (r.url.path == '/api/auth/me') {
            return http.Response(
              jsonEncode({
                'user': {'id': 1, 'email': 'a@b.uz'},
                'cards': [
                  {'code': 'aaa111', 'name': 'Ikkinchi'},
                  {'code': 'vip001', 'name': 'Aziz', 'isPrimary': true},
                ],
              }),
              200,
            );
          }
          return http.Response(jsonEncode({'companies': []}), 200);
        })),
        storage: FakeStore({'nfc_session_token': 'tok'}),
      );
      await state.boot();

      expect(state.phase, AuthPhase.signedIn);
      // Birinchisi emas — `isPrimary` belgilangani.
      expect(state.active?.code, 'VIP001');
      expect(state.ownsRecord('vip001'), isTrue);
      expect(state.ownsRecord('OTH999'), isFalse);
    });

    test('offline bo‘lsa sessiya SAQLANADI', () async {
      // Internet yo‘qligi chiqib ketish uchun sabab emas.
      final state = AppState(
        api: Api(client: MockClient((_) async => throw http.ClientException('yo‘q'))),
        storage: FakeStore({'nfc_session_token': 'tok'}),
      );
      await state.boot();
      expect(state.phase, AuthPhase.signedIn);
      expect(state.api.token, 'tok');
    });

    test('token eskirsa chiqiladi', () async {
      final store = FakeStore({'nfc_session_token': 'eski'});
      final state = AppState(
        api: Api(client: MockClient((_) async => http.Response('{"error":"unauthorized"}', 401))),
        storage: store,
      );
      await state.boot();
      expect(state.phase, AuthPhase.signedOut);
      expect(state.api.token, isNull);
      expect(await store.read(key: 'nfc_session_token'), isNull);
    });

    test('kompaniya so‘rovi yiqilsa shaxsiy ID‘lar qoladi', () async {
      final state = AppState(
        api: Api(client: MockClient((r) async {
          if (r.url.path == '/api/companies/mine') {
            return http.Response('{"error":"boom"}', 500);
          }
          return http.Response(
            jsonEncode({
              'user': {'id': 1, 'email': 'a@b.uz'},
              'cards': [{'code': 'vip001', 'name': 'Aziz'}],
            }),
            200,
          );
        })),
        storage: FakeStore({'nfc_session_token': 'tok'}),
      );
      await state.boot();
      expect(state.cards.length, 1);
      expect(state.companies, isEmpty);
      expect(state.active?.code, 'VIP001');
    });

    test('shaxs almashtirish faol kontekstni o‘zgartiradi', () {
      final state = AppState(
        api: Api(client: MockClient((_) async => http.Response('{}', 200))),
        storage: FakeStore(),
      );
      final company = Company.fromJson({'companyId': 'ddd333', 'displayName': 'NFCSTORE'});
      state.switchIdentity(Identity.business(company));

      expect(state.active!.isBusiness, isTrue);
      expect(state.active!.code, 'DDD333');
      // Ommaviy havola tipiga qarab boshqacha bo‘ladi.
      expect(state.active!.publicUrl, 'https://nfcstore.uz/c/ddd333');

      final card = Record.fromJson({'code': 'vip001', 'name': 'Aziz'});
      state.switchIdentity(Identity.personal(card));
      expect(state.active!.isBusiness, isFalse);
      expect(state.active!.publicUrl, 'https://nfcstore.uz/vip001');
    });
  });

  group('Almashtirgich', () {
    testWidgets('haqiqiy shaxslarni ko‘rsatadi, maketni emas', (tester) async {
      final state = AppState(
        api: Api(client: MockClient((_) async => http.Response('{}', 200))),
        storage: FakeStore(),
      );
      state.cards = [Record.fromJson({'code': 'zzz900', 'name': 'Haqiqiy foydalanuvchi'})];
      state.companies = [Company.fromJson({'companyId': 'qqq100', 'displayName': 'Haqiqiy biznes'})];

      await tester.pumpWidget(wrap(
        Builder(
          builder: (c) => TextButton(
            onPressed: () => showIdentitySwitcher(c),
            child: const Text('och'),
          ),
        ),
        state,
      ));
      await tester.tap(find.text('och'));
      await settle(tester);

      expect(find.text('Haqiqiy foydalanuvchi'), findsOneWidget);
      expect(find.text('Haqiqiy biznes'), findsOneWidget);
      expect(find.text('ZZZ900'), findsOneWidget);
      // Dizayn maketidagi nomlar hech qayerda yozilmagan.
      expect(find.text('Aziz Karimov'), findsNothing);
      expect(find.text('VIP001'), findsNothing);
    });
  });

  group('Xato matnlari', () {
    test('server kaliti o‘zbekcha jumlaga aylanadi', () {
      // Ekranga hech qachon xato KODI chiqmaydi.
      expect(humanError(ApiError('bad_credentials')), contains('noto‘g‘ri'));
      expect(humanError(ApiError('bad_email_code')), contains('Kod xato'));
      expect(humanError(ApiError('offline')), contains('Internet'));
    });

    test('noma‘lum kalit xom holda chiqmaydi', () {
      final msg = humanError(ApiError('qandaydir_yangi_kalit'));
      expect(msg, isNot(contains('qandaydir_yangi_kalit')));
      expect(msg, contains('Nimadir'));
    });
  });

  fieldLineTests();

  group('Dizayn tokenlari', () {
    test('ranglar handoff bilan bir xil', () {
      // Bu qiymatlar dizayn hujjatidan. O‘zgartirilsa — ataylab
      // o‘zgartirilsin, tasodifan emas.
      expect(C.bg, const Color(0xFF0A0805));
      expect(C.accent, const Color(0xFFE8CFA0));
      expect(C.platinum, const Color(0xFFC9CCD2));
      expect(C.ok, const Color(0xFF63D694));
      expect(C.fail, const Color(0xFFE2685F));
    });

    test('harakat byudjeti: EKRAN O‘TISHLARI 400ms dan oshmaydi', () {
      // Foydalanuvchi KUTADIGAN harakatlar: bosish javobi, xiralik,
      // ekran o‘tishi, oyna ochilishi. Ular 400 ms dan oshsa ilova
      // sekin his qilinadi.
      for (final d in [M.press, M.fade, M.image, M.push, M.sheet]) {
        expect(d.inMilliseconds, lessThanOrEqualTo(400));
      }
    });

    test('dekorativ harakatlar dizayn qiymatlarida', () {
      // Bular kutish emas, KO‘RINISH: mavzu almashishi, kartaning
      // o‘girilishi, layk sakrashi. Qiymatlar dizayn hujjatidan.
      expect(M.theme, const Duration(milliseconds: 420));
      expect(M.flip, const Duration(milliseconds: 720));
      expect(M.like, const Duration(milliseconds: 220));
      expect(M.sweep, const Duration(milliseconds: 4200));
      expect(M.ring, const Duration(seconds: 9));
    });
  });
}

/// `Field` — qator soni chegaralari.
///
/// Bu yerda AYNAN bitta narsa qo'riqlanadi: `minLines` hech qachon
/// `maxLines` dan katta bo'lmasligi kerak. Aks holda Flutter assertion
/// bilan to'xtaydi va EKRAN YIQILADI — vizual audit buni jismoniy
/// karta ekranida topgan edi.
void fieldLineTests() {
  group('Field qatorlari', () {
    for (final max in [1, 2, 3, 5]) {
      testWidgets('maxLines: $max — yiqilmaydi', (tester) async {
        await tester.pumpWidget(MaterialApp(
          theme: buildTheme(),
          home: Scaffold(
            body: Field(label: 'Sinov', maxLines: max, controller: TextEditingController()),
          ),
        ));
        await tester.pump();
        expect(tester.takeException(), isNull);
      });
    }
  });
}
