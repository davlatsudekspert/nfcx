// FUNKSIONAL AUDIT — "ko'rinishi to'g'ri" YETARLI EMAS.
//
// Golden kadr ekranning CHIROYLI ekanini ko'rsatadi, ISHLASHINI
// emas. Bu fayl aksincha: har bir ko'rinadigan boshqaruv
// BOSILADI va natija tekshiriladi — yangi ekran ochildimi,
// varaqa chiqdimi, serverga so'rov ketdimi, holat o'zgardimi.
//
// QOIDA: hech bir tekshiruv "toast chiqdi" bilan yakunlanmaydi.
// Soxta javob — funksiya emas.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/screens/discover/discover.dart';
import 'package:nfcstore/screens/home/home.dart';
import 'package:nfcstore/screens/identity/profile_screen.dart';
import 'package:nfcstore/screens/identity/profile_tab.dart';
import 'package:nfcstore/screens/identity/switcher.dart';
import 'package:nfcstore/screens/nfc/id_catalog.dart';
import 'package:nfcstore/screens/nfc/nfc_center.dart';
import 'package:nfcstore/screens/nfc/nfc_scan.dart';
import 'package:nfcstore/screens/nfc/nfc_write.dart';
import 'package:nfcstore/screens/nfc/qr_share.dart';
import 'package:nfcstore/screens/nfc/scan_history_screen.dart';
import 'package:nfcstore/screens/nfc/tag_info.dart';
import 'package:nfcstore/screens/settings/settings_screen.dart';
import 'package:nfcstore/screens/shell.dart';
import 'package:nfcstore/state/app_state.dart';

import 'audit/fixtures.dart';
import 'widget_test.dart' show FakeStore;
import 'audit/harness.dart';
import 'settle.dart';

Future<AppState> ready({AuditMode mode = AuditMode.normal}) async {
  final s = auditState(mode: mode);
  await s.boot();
  return s;
}

/// NFC EKRANLARI UCHUN QO'SHIMCHA KUTISH.
///
/// `Nfc.available()` platformadan javob kutadi va uni 3 soniyalik
/// `timeout` bilan cheklaydi — qurilmada bu bir zumda qaytadi,
/// testda esa platforma umuman javob bermaydi va o'sha 3 soniyalik
/// taymer osilib qoladi. Soat undan o'tkazilmasa, test "Timer is
/// still pending" bilan yiqiladi. Bu ILOVA XATOSI EMAS: timeout
/// ataylab qo'yilgan, u NFC moduli javob bermagan telefonda
/// ekranning abadiy kutishiga yo'l qo'ymaydi.
Future<void> settleNfc(WidgetTester t) async {
  await settle(t);
  await t.pump(const Duration(seconds: 4));
  await settle(t);
}

/// Ko'rinmayotgan boshqaruvni ko'rinadigan qilib, bosadi.
Future<void> tapText(WidgetTester t, String label) async {
  final f = find.text(label);

  // DANGASA RO'YXAT: pastdagi qator hali QURILMAGAN bo'lishi
  // mumkin, ya'ni `find.text` uni ko'rmaydi. Shuning uchun avval
  // ro'yxat suriladi — "tugma yo'q" degan yolg'on xulosa
  // chiqmasligi uchun.
  if (f.evaluate().isEmpty) {
    final list = find.byType(Scrollable);
    if (list.evaluate().isNotEmpty) {
      for (var i = 0; i < 12 && f.evaluate().isEmpty; i++) {
        await t.drag(list.first, const Offset(0, -260));
        await settle(t);
      }
    }
  }

  expect(f, findsWidgets, reason: '"$label" ekranda bo‘lishi kerak');
  await t.ensureVisible(f.first);
  await settle(t);
  await t.tap(f.first, warnIfMissed: false);
  await settle(t);
}

void main() {
  setUpAll(loadAuditFonts);
  setUp(mockImageCacheDir);

  // ═══ NAVIGATSIYA ══════════════════════════════════════════════

  group('NAVIGATSIYA', () {
    testWidgets('beshta tab ham ochiladi va O‘Z ekranini beradi', (t) async {
      final s = await ready();
      await pumpScreen(t, const Shell(), state: s);

      // Tab ekranlari `Shell._tabs` tartibida.
      final wanted = <Type>[
        HomeScreen,
        DiscoverScreen,
        NfcCenterScreen,
        IdCatalogScreen,
        ProfileTab,
      ];
      for (final type in wanted) {
        expect(find.byType(type, skipOffstage: false), findsOneWidget,
            reason: '$type qobiqda bo‘lishi kerak');
      }
    });
  });

  // ═══ BOSH SAHIFA ══════════════════════════════════════════════

  group('BOSH SAHIFA — tezkor amallar', () {
    Future<void> check(WidgetTester t, String label, Type screen) async {
      final s = await ready();
      await pumpScreen(t, const HomeScreen(), state: s);
      await tapText(t, label);
      await settleNfc(t);
      expect(find.byType(screen), findsOneWidget,
          reason: '"$label" $screen ekranini ochishi kerak');
    }

    testWidgets('Skanerlash → NFC skaneri', (t) async {
      await check(t, 'Skanerlash', NfcScanScreen);
    });

    testWidgets('QR ulashish → QR ekrani', (t) async {
      await check(t, 'QR ulashish', QrShareScreen);
    });

    testWidgets('Do‘kon → ID katalogi', (t) async {
      await check(t, 'Do‘kon', IdCatalogScreen);
    });
  });

  // ═══ NFC MARKAZI ══════════════════════════════════════════════

  group('NFC MARKAZI — oltita asbob', () {
    Future<void> check(WidgetTester t, String label, Type screen) async {
      final s = await ready();
      await pumpScreen(t, const NfcCenterScreen(), state: s);
      await tapText(t, label);
      await settleNfc(t);
      expect(find.byType(screen), findsOneWidget,
          reason: '"$label" $screen ni ochishi kerak');
    }

    testWidgets('Skanerlashni boshlash → skaner', (t) async {
      await check(t, 'Skanerlashni boshlash', NfcScanScreen);
    });

    testWidgets('Kartaga yozish → yozish ekrani', (t) async {
      await check(t, 'Kartaga yozish', NfcWriteScreen);
    });

    testWidgets('Teg ma’lumoti → teg ekrani', (t) async {
      await check(t, 'Teg ma’lumoti', TagInfoScreen);
    });

    testWidgets('Tegizishlar tarixi → tarix ekrani', (t) async {
      await check(t, 'Tegizishlar tarixi', ScanHistoryScreen);
    });

    testWidgets('QR → QR ekrani', (t) async {
      await check(t, 'QR', QrShareScreen);
    });
  });

  // ═══ QIDIRUV ══════════════════════════════════════════════════

  group('QIDIRUV', () {
    testWidgets('yozilgan matn SERVERGA so‘rov bo‘lib ketadi', (t) async {
      // Qidiruv "ishlayapti" deyish uchun ro'yxat chiqishi
      // yetarli emas: ro'yxat KESHDAN ham chiqishi mumkin.
      // Shuning uchun aynan so'rov kuzatiladi.
      final asked = <String>[];
      final s = AppState(
        api: Api(
          client: MockClient((req) async {
            if (req.url.path.contains('search')) {
              asked.add(req.url.queryParameters['q'] ?? '');
            }
            return http.Response(
              jsonEncode(const {'records': [], 'companies': [], 'categories': []}),
              200,
              headers: const {'content-type': 'application/json'},
            );
          }),
        ),
      );
      await pumpScreen(t, const DiscoverScreen(), state: s);

      await t.enterText(find.byType(EditableText).first, 'Jasur');
      // Qidiruv teruvchi to'xtaguncha kutadi (debounce).
      await t.pump(const Duration(milliseconds: 600));
      await settle(t);

      expect(asked, isNotEmpty, reason: 'qidiruv serverga bormadi');
      expect(asked.last, 'Jasur');
    });

    testWidgets('topilgan profil BOSILADI va ochiladi', (t) async {
      final s = await ready();
      await pumpScreen(t, const DiscoverScreen(), state: s);

      await tapText(t, 'Dr. Shahnoza');
      expect(find.byType(ProfileScreen), findsOneWidget,
          reason: 'qatordagi odam profili ochilishi kerak');
    });
  });

  // ═══ SHAXS ALMASHTIRISH ═══════════════════════════════════════

  group('PERSONAL ↔ BUSINESS', () {
    testWidgets('boshqa ID tanlansa FAOL shaxs o‘zgaradi', (t) async {
      final s = await ready();
      final before = s.active!.code;
      late BuildContext ctx;
      await pumpScreen(
        t,
        Builder(builder: (c) {
          ctx = c;
          return const SizedBox.shrink();
        }),
        state: s,
      );
      unawaited(showIdentitySwitcher(ctx));
      await settle(t);

      // Ro'yxatdagi ikkinchi ID — fixture'da AAA111.
      await tapText(t, 'Ikkinchi profil');

      expect(s.active!.code, isNot(before),
          reason: 'tanlangan ID faol bo‘lishi kerak');
    });

    testWidgets('KOMPANIYA tanlansa shaxs biznesga o‘tadi', (t) async {
      final s = await ready();
      late BuildContext ctx;
      await pumpScreen(
        t,
        Builder(builder: (c) {
          ctx = c;
          return const SizedBox.shrink();
        }),
        state: s,
      );
      unawaited(showIdentitySwitcher(ctx));
      await settle(t);

      await tapText(t, 'NFCSTORE');

      expect(s.active!.isBusiness, isTrue,
          reason: 'kompaniya tanlangach shaxs biznes bo‘lishi kerak');
    });
  });

  // ═══ DO'KON ═══════════════════════════════════════════════════

  group('DO‘KON', () {
    testWidgets('“Tekshirish” SERVERGA so‘rov yuboradi', (t) async {
      final asked = <String>[];
      final s = AppState(
        api: Api(
          client: MockClient((req) async {
            asked.add(req.url.path);
            return http.Response(
              jsonEncode(const {'records': []}),
              404,
              headers: const {'content-type': 'application/json'},
            );
          }),
        ),
      );
      await pumpScreen(t, const IdCatalogScreen(), state: s);

      await t.enterText(find.byType(EditableText).first, 'ABZ007');
      await settle(t);
      await tapText(t, 'Tekshirish');

      expect(asked.any((p) => p.contains('ABZ007')), isTrue,
          reason: 'kod serverda tekshirilishi kerak');
    });
  });

  // ═══ SOZLAMALAR ═══════════════════════════════════════════════

  group('SOZLAMALAR', () {
    testWidgets('CHIQISH serverga boradi va sessiya yopiladi', (t) async {
      final hits = <String>[];
      final s = AppState(
        api: Api(
          client: MockClient((req) async {
            hits.add('${req.method} ${req.url.path}');
            return http.Response(
              jsonEncode(const {
                'user': {'id': 1, 'email': 'egasi@nfcstore.uz'},
                'cards': [],
              }),
              200,
              headers: const {'content-type': 'application/json'},
            );
          }),
        ),
        storage: FakeStore({'nfc_session_token': 'audit-token'}),
      );
      await s.boot();
      expect(s.phase, AuthPhase.signedIn);

      await pumpScreen(t, const SettingsScreen(), state: s);
      await tapText(t, 'Chiqish');
      // Tasdiqlash varaqasi — ikkinchi bosish.
      if (find.text('Chiqish').evaluate().isNotEmpty) {
        await t.tap(find.text('Chiqish').last, warnIfMissed: false);
        await settle(t);
      }

      expect(hits.any((h) => h.contains('logout')), isTrue,
          reason: 'chiqish SERVERGA ham yozilishi kerak');
      expect(s.phase, AuthPhase.signedOut);
    });
  });

  // ═══ XATO VA BO'SH HOLATLAR ═══════════════════════════════════

  group('HOLATLAR', () {
    testWidgets('TARMOQ YO‘Q — xato jumlasi va “Qayta urinish” bor',
        (t) async {
      final s = await ready(mode: AuditMode.offline);
      await pumpScreen(t, const DiscoverScreen(), state: s);

      expect(find.text('Qayta urinish'), findsWidgets,
          reason: 'xato holatida qaytish yo‘li bo‘lishi kerak');
    });

    testWidgets('“Qayta urinish” HAQIQATAN qayta so‘raydi', (t) async {
      // Bu yerda "tugma bor" yetarli emas: u bosilganda yangi
      // so'rov ketishi kerak. Aks holda bu bezak.
      var calls = 0;
      var fail = true;
      final s = AppState(
        api: Api(
          client: MockClient((req) async {
            if (req.url.path.contains('records') ||
                req.url.path.contains('companies')) {
              calls++;
              if (fail) {
                return http.Response(
                  jsonEncode(const {'error': 'server_error'}),
                  500,
                  headers: const {'content-type': 'application/json'},
                );
              }
            }
            return http.Response(
              jsonEncode(const {'records': [], 'companies': [], 'categories': []}),
              200,
              headers: const {'content-type': 'application/json'},
            );
          }),
        ),
      );
      await pumpScreen(t, const DiscoverScreen(), state: s);
      final before = calls;
      expect(find.text('Qayta urinish'), findsWidgets);

      fail = false;
      await tapText(t, 'Qayta urinish');

      expect(calls, greaterThan(before),
          reason: '“Qayta urinish” yangi so‘rov yuborishi kerak');
    });
  });
}
