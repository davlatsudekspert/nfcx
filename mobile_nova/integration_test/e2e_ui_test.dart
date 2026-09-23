// HAQIQIY ILOVA UI — EMULYATORDA.
//
// Bu yerda `NovaApp` ning O'ZI ishga tushadi: haqiqiy `routerProvider`,
// haqiqiy ekranlar, haqiqiy qulf qatlami. Repozitoriy qatlami
// `e2e_backend_test.dart` da tekshiriladi — bu fayl esa foydalanuvchi
// barmog'i tegadigan joyni tekshiradi.
//
// ## `pumpAndSettle` NIMA UCHUN ISHLATILMAYDI
//
// Home'dagi orb, halqa va fon TO'XTOVSIZ animatsiyada. `pumpAndSettle`
// esa "animatsiya tugashini" kutadi — bunday ekranda u hech qachon
// tugamaydi va test muddatdan oshib yiqilardi. Shuning uchun
// [settle] belgilangan sondagi kadrni surib o'tadi.
//
// ## KIRISH URINISHLARI
//
// Backend hisob bo'yicha 15 daqiqada 5 kirishga ruxsat beradi va
// hisoblagich muvaffaqiyatli kirishda ham oshadi. Backend to'plami
// 2 ta sarflaydi, bu fayl esa ATIGI BITTA — jami 3.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/settings/app_lock.dart';

import 'support/creds.dart';
import 'support/report.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final report = E2EReport.instance;

  /// To'xtovsiz animatsiyali ekranni "tinchitadi".
  Future<void> settle(WidgetTester t,
      {int frames = 30, Duration step = const Duration(milliseconds: 60)}) async {
    for (var i = 0; i < frames; i++) {
      await t.pump(step);
    }
  }

  /// Ilovani haqiqiy holatda ishga tushiradi va konteynerni qaytaradi,
  /// shunda testdan ham UI ga, ham provayderlarga kirish mumkin.
  Future<ProviderContainer> launch(WidgetTester t) async {
    final prefs = await Prefs.open();
    final container = ProviderContainer(
      overrides: [prefsProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);
    await t.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const NovaApp(),
    ));
    await settle(t, frames: 40);
    return container;
  }

  setUpAll(() async {
    // Har ishga tushish toza holatdan boshlanadi.
    await SecureStore().clear();
  });

  tearDownAll(() => report.emit());

  // ══════════════════════════════════════════════════════════════
  // Kirish ekrani → Home
  // ══════════════════════════════════════════════════════════════

  testWidgets('UI 1 — kirish ekrani va haqiqiy kirish', (t) async {
    // ignore: avoid_print
    print("[E2E] >> UI 1 — kirish ekrani va haqiqiy kirish");
    await launch(t);

    // Kirmagan foydalanuvchi Welcome ekranida turadi va u yerda
    // matn maydoni YO'Q — "Kirish" tugmasini bosish kerak.
    //
    // DIQQAT: `NovaButton` `ElevatedButton` EMAS. U
    // `Semantics > PressableScale > AnimatedContainer` dan iborat,
    // shuning uchun `find.byType(ElevatedButton)` hech narsa
    // topmaydi — birinchi ishga tushirishda sinov aynan shu sababdan
    // "maydonlar topilmadi" deb yiqilgan edi.
    if (find.byType(TextField).evaluate().isEmpty) {
      final buttons = find.byType(NovaButton);
      // Welcome'da ikkita tugma bor: "Ro'yxatdan o'tish" va "Kirish".
      // Kirish — ikkinchisi.
      if (buttons.evaluate().length >= 2) {
        await t.tap(buttons.at(1), warnIfMissed: false);
      } else if (buttons.evaluate().isNotEmpty) {
        await t.tap(buttons.first, warnIfMissed: false);
      }
      await settle(t, frames: 40);
    }

    if (find.byType(TextField).evaluate().length < 2) {
      report.add(MatrixRow(
        name: 'Login (UI)',
        verdict: Verdict.fail,
        screen: 'LoginScreen',
        action: 'kirish ekranini ochish',
        cause: 'email va parol maydonlari topilmadi — ekran ochilmadi',
        layer: 'frontend',
      ));
      return;
    }
    report.pass('Login (UI) — ekran',
        screen: 'LoginScreen',
        action: 'email + parol maydonlari ko\'rindi');

    if (!hasCreds) {
      report.add(MatrixRow(
        name: 'Login (UI)',
        verdict: Verdict.configRequired,
        cause: 'sinov hisobi berilmagan',
        layer: 'config',
      ));
      return;
    }

    await t.enterText(find.byType(TextField).at(0), kTestLogin);
    await t.enterText(find.byType(TextField).at(1), kTestPassword);
    await settle(t, frames: 5);

    // Kirish ekranida ikkita `NovaButton`: birinchisi — yuborish,
    // ikkinchisi — "kod bilan kirish" ga o'tish.
    final submit = find.byType(NovaButton);
    if (submit.evaluate().isEmpty) {
      report.add(MatrixRow(
        name: 'Login (UI)',
        verdict: Verdict.fail,
        screen: 'LoginScreen',
        action: 'kirish tugmasini topish',
        cause: 'tugma topilmadi',
        layer: 'frontend',
      ));
      return;
    }
    await t.tap(submit.first);

    // Tarmoq javobi — sabrli kutish, lekin `pumpAndSettle` emas.
    await settle(t, frames: 120, step: const Duration(milliseconds: 100));

    // Home'ga o'tganini pastki navigatsiya borligi bilan bilamiz:
    // u faqat shell ichida chiziladi.
    final onHome = find.byType(NovaBottomNav).evaluate().isNotEmpty;
    if (onHome) {
      report.pass('Login (UI)',
          screen: 'LoginScreen → Home',
          action: 'haqiqiy hisob bilan kirish',
          note: 'pastki navigatsiya paydo bo\'ldi — shell ochildi');
    } else {
      report.add(MatrixRow(
        name: 'Login (UI)',
        verdict: Verdict.fail,
        screen: 'LoginScreen',
        action: 'haqiqiy hisob bilan kirish',
        cause: 'kirishdan keyin Home shelliga o\'tilmadi',
        layer: 'frontend',
        fix: 'sabab `e2e_backend_test.dart` dagi Login qatorida '
            'ko\'rinadi — u HTTP izini yozadi',
      ));
    }
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // Navigatsiya, yorliqlar, mavzu va til
  // ══════════════════════════════════════════════════════════════

  testWidgets('UI 2 — navigatsiya, Tanlov yorlig\'i, mavzu, til',
      (t) async {
    // ignore: avoid_print
    print("[E2E] >> UI 2 — navigatsiya, Tanlov yorlig'i, mavzu, til");
    final c = await launch(t);

    // ── Pastki navigatsiya ─────────────────────────────────────
    if (find.byType(NovaBottomNav).evaluate().isEmpty) {
      report.skip('Tanlov', 'shell ochilmadi (kirish talab qilinadi)');
      report.skip('Theme', 'shell ochilmadi');
      report.skip('Language', 'shell ochilmadi');
      return;
    }

    // ── UZ yorlig'i "Tanlov" bo'lishi SHART ────────────────────
    await c.read(localeProvider.notifier).select(const Locale('uz'));
    await settle(t, frames: 20);

    final hasTanlov = find.text('Tanlov').evaluate().isNotEmpty;
    final hasOld = find.text('Kashfiyot').evaluate().isNotEmpty;
    if (hasTanlov && !hasOld) {
      report.pass('Tanlov',
          screen: 'NovaBottomNav',
          action: 'UZ yorlig\'i',
          note: '"Tanlov" ko\'rinadi, eski "Kashfiyot" yo\'q');
    } else {
      report.add(MatrixRow(
        name: 'Tanlov',
        verdict: Verdict.fail,
        screen: 'NovaBottomNav',
        action: 'UZ yorlig\'i',
        cause: hasOld
            ? 'eski "Kashfiyot" yorlig\'i hali turibdi'
            : '"Tanlov" yorlig\'i topilmadi',
        layer: 'frontend',
      ));
    }

    // ── Til ────────────────────────────────────────────────────
    var langOk = true;
    for (final entry in {
      'ru': 'Обзор',
      'en': 'Discover',
      'uz': 'Tanlov',
    }.entries) {
      await c.read(localeProvider.notifier).select(Locale(entry.key));
      await settle(t, frames: 20);
      if (find.text(entry.value).evaluate().isEmpty) {
        langOk = false;
        report.add(MatrixRow(
          name: 'Language',
          verdict: Verdict.fail,
          screen: 'NovaBottomNav',
          action: '${entry.key} tiliga o\'tish',
          cause: '"${entry.value}" yorlig\'i ko\'rinmadi',
          layer: 'frontend',
        ));
        break;
      }
    }
    if (langOk) {
      report.pass('Language',
          screen: 'NovaBottomNav',
          action: 'uz / ru / en',
          note: 'uchala tilda ham yorliq to\'g\'ri');
    }

    // ── Mavzular ───────────────────────────────────────────────
    final broken = <String>[];
    for (final theme in NfcTokens.all) {
      await c.read(themeProvider.notifier).select(theme);
      await settle(t, frames: 25);
      if (hasFlutterException()) broken.add(theme.id);
    }
    if (broken.isEmpty) {
      report.pass('Theme',
          screen: 'butun ilova',
          action: '5 mavzu almashtirildi',
          note: NfcTokens.all.map((t) => t.id).join(', '));
    } else {
      report.add(MatrixRow(
        name: 'Theme',
        verdict: Verdict.fail,
        screen: 'butun ilova',
        action: 'mavzu almashtirish',
        cause: 'xatolik bergan mavzular: ${broken.join(', ')}',
        layer: 'frontend',
      ));
    }

    // ── Beshala tab ────────────────────────────────────────────
    // Pastki navigatsiya ham `PressableScale` ustiga qurilgan —
    // `InkWell` bu yerda ham yo'q.
    final navIcons = find.descendant(
      of: find.byType(NovaBottomNav),
      matching: find.byType(PressableScale),
    );
    final tabCount = navIcons.evaluate().length;
    if (tabCount >= 4) {
      var crashed = false;
      for (var i = 0; i < tabCount && i < 5; i++) {
        await t.tap(navIcons.at(i), warnIfMissed: false);
        await settle(t, frames: 25);
        if (hasFlutterException()) {
          crashed = true;
          break;
        }
      }
      if (!crashed) {
        report.pass('Navigation — 5 tab',
            screen: 'NovaBottomNav',
            action: 'har bir tabga o\'tish',
            note: '$tabCount ta nuqta bosildi, xatolik yo\'q');
      } else {
        report.add(MatrixRow(
          name: 'Navigation — 5 tab',
          verdict: Verdict.fail,
          screen: 'NovaBottomNav',
          action: 'tablar orasida yurish',
          cause: 'tab almashganda istisno',
          layer: 'frontend',
        ));
      }
    } else {
      report.add(MatrixRow(
        name: 'Navigation — 5 tab',
        verdict: Verdict.partial,
        screen: 'NovaBottomNav',
        action: 'tablarni topish',
        cause: 'kutilgan 5 ta emas, $tabCount ta bosiladigan nuqta',
        layer: 'frontend',
      ));
    }
    // ── "ASOSIY" QAYTA BOSILGANDA TEPAGA QAYTADI ──────────────
    //
    // Qurilmadagi shikoyat: lentani pastga silkitgandan keyin
    // "Asosiy" ni bosish hech narsa qilmasdi.
    //
    // Bu yerda HAQIQIY qurilmada o'lchanadi: birinchi tabga
    // o'tiladi, ro'yxat pastga suriladi, so'ng o'sha tab QAYTA
    // bosiladi va siljish o'rni tekshiriladi.
    if (tabCount >= 1) {
      await t.tap(navIcons.at(0), warnIfMissed: false);
      await settle(t, frames: 20);

      final scrollables = find.byType(Scrollable);
      if (scrollables.evaluate().isEmpty) {
        report.add(MatrixRow(
          name: 'Asosiy — tepaga qaytish',
          verdict: Verdict.partial,
          screen: 'HomeScreen',
          action: '"Asosiy" ni qayta bosish',
          cause: 'bosh sahifada siljiydigan ro\'yxat topilmadi',
          layer: 'frontend',
        ));
      } else {
        final pos = t.state<ScrollableState>(scrollables.first).position;
        final room = pos.maxScrollExtent;
        if (room < 80) {
          report.add(MatrixRow(
            name: 'Asosiy — tepaga qaytish',
            verdict: Verdict.partial,
            screen: 'HomeScreen',
            action: '"Asosiy" ni qayta bosish',
            cause: 'bosh sahifa siljimaydi (maxScrollExtent=$room) — '
                'sinov ma\'noga ega emas',
            layer: 'frontend',
          ));
        } else {
          pos.jumpTo(room < 400 ? room : 400);
          await settle(t, frames: 5);
          final before = pos.pixels;

          await t.tap(navIcons.at(0), warnIfMissed: false);
          await settle(t, frames: 20);

          final after = t
              .state<ScrollableState>(find.byType(Scrollable).first)
              .position
              .pixels;
          if (before > 0 && after == 0) {
            report.pass('Asosiy — tepaga qaytish',
                screen: 'HomeScreen',
                action: '"Asosiy" ni qayta bosish',
                note: '$before px dan 0 ga qaytdi');
          } else {
            report.add(MatrixRow(
              name: 'Asosiy — tepaga qaytish',
              verdict: Verdict.fail,
              screen: 'HomeScreen',
              action: '"Asosiy" ni qayta bosish',
              cause: 'siljish $before -> $after (0 bo\'lishi kerak edi)',
              layer: 'frontend',
            ));
          }
        }
      }
    }
  }, timeout: const Timeout(Duration(minutes: 6)));

  // ══════════════════════════════════════════════════════════════
  // PIN qulfi — haqiqiy ekran, haqiqiy Keystore
  // ══════════════════════════════════════════════════════════════

  testWidgets('UI 3 — PIN qulfi', (t) async {
    // ignore: avoid_print
    print("[E2E] >> UI 3 — PIN qulfi");
    final c = await launch(t);
    final lock = c.read(appLockProvider.notifier);

    // O'rnatish.
    await lock.enable('2468');
    await settle(t, frames: 10);
    if (!c.read(appLockProvider).enabled) {
      report.add(MatrixRow(
        name: 'PIN App Lock',
        verdict: Verdict.fail,
        screen: 'SettingsScreen',
        action: 'PIN o\'rnatish',
        cause: 'qulf yoqilmadi',
        layer: 'frontend',
      ));
      return;
    }

    // Qulflash — ilova fonga chiqib qaytgandagi holat.
    lock.lockNow();
    await settle(t, frames: 20);

    if (!c.read(appLockProvider).locked) {
      report.add(MatrixRow(
        name: 'PIN App Lock',
        verdict: Verdict.fail,
        screen: 'AppLockGate',
        action: 'qulflash',
        cause: 'lockNow ishlamadi',
        layer: 'frontend',
      ));
      await lock.disable();
      return;
    }

    // Noto'g'ri PIN ochmasligi kerak.
    final wrong = await lock.verify('1111');
    await settle(t, frames: 10);
    final stillLocked = c.read(appLockProvider).locked;

    // To'g'ri PIN ochishi kerak.
    final right = await lock.verify('2468');
    await settle(t, frames: 10);
    final opened = !c.read(appLockProvider).locked;

    if (!wrong && stillLocked && right && opened) {
      report.pass('PIN App Lock',
          screen: 'AppLockGate',
          action: 'o\'rnatish → qulflash → noto\'g\'ri → to\'g\'ri',
          note: 'PIN Keystore ichida; noto\'g\'ri kod ochmadi');
    } else {
      report.add(MatrixRow(
        name: 'PIN App Lock',
        verdict: Verdict.fail,
        screen: 'AppLockGate',
        action: 'PIN tekshirish',
        cause: 'noto\'g\'ri=$wrong qulflangan=$stillLocked '
            'to\'g\'ri=$right ochildi=$opened',
        layer: 'frontend',
      ));
    }

    // O'chirish — hisob o'z holiga qaytsin.
    await lock.disable();
    await settle(t, frames: 10);
    if (c.read(appLockProvider).enabled) {
      report.add(MatrixRow(
        name: 'PIN App Lock — o\'chirish',
        verdict: Verdict.fail,
        screen: 'SettingsScreen',
        action: 'qulfni o\'chirish',
        cause: 'qulf o\'chmadi',
        layer: 'frontend',
      ));
    } else {
      report.pass('PIN App Lock — o\'chirish',
          screen: 'SettingsScreen', action: 'qulf o\'chirildi va PIN tozalandi');
    }

    // Biometrika — SOXTA "DONE" YO'Q.
    report.add(MatrixRow(
      name: 'Biometric App Lock',
      // FAIL EMAS — ataylab olib qo'yilgan va bu kelishilgan.
      // `FAIL` bo'lsa ish har safar qizarib, HAQIQIY yangi
      // buzilishlar shu shovqinda ko'rinmay qolardi.
      verdict: Verdict.deferred,
      screen: 'SettingsScreen',
      action: 'biometrik ochish',
      cause: '`local_auth` Android buildini R8 bosqichida qotirgani '
          'uchun paket olib tashlangan. Sozlamalarda bunday tugma '
          'umuman yo\'q — bosilib ishlamaydigan tugma qoldirilmadi',
      layer: 'frontend',
      fix: 'FINAL_GAPS.md §7 — qaytarish qadamlari',
      retest: 'qaytarilgunga qadar FAILED bo\'lib qoladi',
    ));
  }, timeout: const Timeout(Duration(minutes: 5)));
}

/// Oxirgi kadrda Flutter istisno yozib qo'ydimi.
///
/// `tester.takeException()` istisnoni ISTE'MOL qiladi, shuning uchun
/// uni bir marta o'qiymiz va natijani qaytaramiz.
bool hasFlutterException() {
  final e = TestWidgetsFlutterBinding.instance.takeException();
  if (e == null) return false;
  // ignore: avoid_print
  print('[E2E][UI] istisno: $e');
  return true;
}
