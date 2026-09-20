import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/my_ids_strip.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// BOSH SAHIFA TARTIBI VA KO'CHIRILGAN BO'LIMLAR.
///
/// Yangi tartib:
///   faol NFC ID karta → tezkor amallar → storylar → NFC Mobile.
///
/// "NFC ID'larim" va "So'nggi harakatlar" bosh sahifadan OLIB
/// TASHLANDI — lekin O'CHIRILMADI. Bu testlarning asosiy vazifasi
/// shuni isbotlash: hech bir imkoniyat yo'qolmadi.
void main() {
  final home = File('lib/features/home/home_screen.dart').readAsStringSync();
  final profile =
      File('lib/features/profile/profile_screen.dart').readAsStringSync();

  /// Izohsiz kod — tekshiruv KOD haqida, matn haqida emas.
  String codeOnly(String s) => s
      .split('\n')
      .where((l) {
        final t = l.trimLeft();
        return !t.startsWith('//') && !t.startsWith('///');
      })
      .join('\n');

  final homeCode = codeOnly(home);
  final profileCode = codeOnly(profile);

  group('Bosh sahifa tartibi', () {
    test('ketma-ketlik: tezkor amallar → storylar → NFC Mobile', () {
      final quick = homeCode.indexOf('_QuickActions(mode: mode)');
      final stories = homeCode.indexOf('_StoriesRow(user: user)');
      final demo = homeCode.indexOf('NfcMobileSection()');
      expect(quick, greaterThan(0));
      expect(quick, lessThan(stories), reason: 'tezkor amallar storylardan keyin');
      expect(stories, lessThan(demo), reason: 'NFC Mobile storylardan oldin');
    });

    test('"NFC ID’larim" va "So‘nggi harakatlar" bosh sahifada YO‘Q',
        () {
      expect(homeCode, isNot(contains('MyIdsStrip')),
          reason: 'ID lentasi hali ham bosh sahifada');
      expect(homeCode, isNot(contains('l.homeActivity')),
          reason: 'harakatlar bo‘limi hali ham bosh sahifada');
      expect(homeCode, isNot(contains('_ActivityPreview')));
    });

    testWidgets('ekranda ham ko\u2018rinmaydi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(const HomeScreen()),
      ));
      await settle(tester, frames: 20);
      final l = await L.delegate.load(const Locale('uz'));

      // RO'YXAT DANGASA: ekrandan pastdagi elementlar UMUMAN
      // qurilmaydi. Shuning uchun oxirigacha aylantirib, yo'lda
      // uchraganini yig'amiz — aks holda "topilmadi" degan
      // tekshiruv hech narsa isbotlamasdi.
      final seen = <String>{};
      var sawDemo = false;
      final scrollable = find.byType(Scrollable).first;
      for (var i = 0; i < 16; i++) {
        seen.addAll(tester
            .widgetList<Text>(find.byType(Text))
            .map((e) => e.data ?? ''));
        if (find.byType(NfcMobileSection).evaluate().isNotEmpty) {
          sawDemo = true;
        }
        await tester.drag(scrollable, const Offset(0, -300));
        await tester.pump(const Duration(milliseconds: 60));
      }

      expect(sawDemo, isTrue, reason: 'tanishtiruv bo\u2018limi chizilmadi');
      expect(seen, isNot(contains(l.nfcMyIds.toUpperCase())),
          reason: 'ID lentasi hali ham bosh sahifada');
      expect(seen, isNot(contains(l.homeActivity.toUpperCase())),
          reason: 'harakatlar bo\u2018limi hali ham bosh sahifada');
    });
  });

  group('HECH BIR IMKONIYAT YO‘QOLMADI', () {
    test('ID boshqaruvi PROFIL ichidan ochiladi', () {
      expect(profileCode, contains('MyIdsStrip'));
      expect(profileCode, contains('Routes.nfcIds'),
          reason: '"Hammasi" boshqaruv ekraniga olib bormayapti');
    });

    test('ID lentasi FAQAT o‘z profilida', () {
      // Begona odamning profilida sizning ID'laringiz ko'rinishi
      // mantiqsiz — va bu maxfiylik masalasi ham.
      expect(profileCode, contains('code == null && ref.watch(myIdsProvider)'));
    });

    test('ID ro‘yxatiga boshqa yo‘llar ham joyida', () {
      // Bitta joydan olib tashlash boshqalarini buzmasligi kerak.
      for (final f in [
        'lib/features/nfc/nfc_center_screen.dart',
        'lib/features/settings/settings_screen.dart',
      ]) {
        expect(File(f).readAsStringSync(), contains('Routes.nfcIds'),
            reason: '$f dagi yo‘l yo‘qolgan');
      }
    });

    test('harakatlar ekrani qo‘ng‘iroq tugmasidan ochiladi', () {
      // Bo'lim olib tashlandi, lekin ekranning O'ZI qoldi va unga
      // yo'l ochiq: aks holda `ActivityScreen` yetib bo'lmas
      // bo'lib qolardi.
      expect(homeCode, contains('Routes.activity'),
          reason: 'harakatlar ekraniga birorta yo‘l qolmagan');
      expect(homeCode, contains('Icons.notifications_none_rounded'));
    });

    test('marshrutlar o‘zgarmadi', () {
      final router = buildTestRouter();
      expect(routeExists(router, Routes.nfcIds), isTrue);
      expect(routeExists(router, Routes.activity), isTrue);
      disposeTestContainers();
    });
  });

  test('ID lentasi BITTA nusxada', () {
    // Ko'chirishda nusxalash eng oson yo'l bo'lardi — va eng
    // yomoni: ikki nusxa vaqt o'tib bir-biridan uzoqlashadi.
    expect(File('lib/features/home/widgets/my_ids_strip.dart').existsSync(),
        isTrue);
    expect(homeCode, isNot(contains('class _MyIdsStrip')));
    expect(MyIdsStrip, isNotNull);
    expect(ProfileScreen, isNotNull);
  });
}
