// REKLAMA ROLIGI UCHUN — ILOVANI ODAM KABI ISHLATISH (ekran yozib olinadi).
//
// Egasi (2026-10-12): "ilovani ekranda to'liq ishlatib rolik qil, rasm
// emas". Haqiqiy `main()`, haqiqiy https://nfcstore.uz, sinov hisobi.
// Faqat KO'RISH: like, obuna, izoh, xarid, post — hech biri BOSILMAYDI.
//
// Kirishdan KEYIN host yozishni boshlaydi (`promo_rec_req` -> `promo_rec_ack`),
// shuning uchun kirish ekrani (login) videoga tushmaydi. Har sahna boshi
// `PROMO_MARK:<nom>:<ms>`, har bosish `PROMO_TAP:<x>:<y>:<ms>` (mantiqiy
// nuqta, yozuv boshidan) qatori bo'lib chiqadi — montajda kesish va
// bosish halqasini chizish uchun.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/main.dart' as app;

import 'showcase_support/creds.dart';

void _log(String s) {
  // ignore: avoid_print
  print(redact(s));
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;
  testWidgets('Reklama: ilova sayohati', (t) async {
    final prev = FlutterError.onError;
    FlutterError.onError = (_) {};
    try {
      await _Tour(t).run();
    } finally {
      FlutterError.onError = prev;
    }
  }, timeout: const Timeout(Duration(minutes: 20)));
}

class _Tour {
  _Tour(this.t);
  final WidgetTester t;
  final rec = Stopwatch();
  late final String tmp;

  Future<void> wait(Duration d) async {
    final sw = Stopwatch()..start();
    while (sw.elapsed < d) {
      await t.pump(const Duration(milliseconds: 33));
    }
  }

  Future<void> secs(double s) => wait(Duration(milliseconds: (s * 1000).round()));

  Future<bool> waitFor(bool Function() c, {double timeout = 15}) async {
    final sw = Stopwatch()..start();
    while (sw.elapsed.inMilliseconds < timeout * 1000) {
      if (c()) return true;
      await t.pump(const Duration(milliseconds: 100));
    }
    return c();
  }

  bool has(Finder f) => f.evaluate().isNotEmpty;

  void mark(String name) => _log('PROMO_MARK:$name:${rec.elapsedMilliseconds}');

  Future<void> tap(Finder f, {String why = ''}) async {
    final c = t.getCenter(f.first);
    _log('PROMO_TAP:${c.dx.toStringAsFixed(1)}:${c.dy.toStringAsFixed(1)}:${rec.elapsedMilliseconds}');
    await secs(0.25);
    await t.tap(f.first, warnIfMissed: false);
  }

  Future<void> drag(Finder f, double dy, {double ms = 900}) async {
    if (!has(f)) return;
    final c = t.getCenter(f.first);
    _log('PROMO_DRAG:${c.dx.toStringAsFixed(1)}:${c.dy.toStringAsFixed(1)}:$dy:${rec.elapsedMilliseconds}');
    await t.timedDrag(f.first, Offset(0, dy), Duration(milliseconds: ms.round()),
        warnIfMissed: false);
  }

  Finder tab(IconData a, IconData b) {
    final nav = find.byType(NovaBottomNav);
    final f = find.descendant(of: nav, matching: find.byIcon(a));
    return has(f) ? f : find.descendant(of: nav, matching: find.byIcon(b));
  }

  Finder get scroller => find.byType(Scrollable);

  Future<void> type(Finder field, String text) async {
    for (var i = 1; i <= text.length; i++) {
      await t.enterText(field.first, text.substring(0, i));
      await secs(0.16);
    }
  }

  Future<void> back() async {
    final b = find.byType(BackButton);
    if (has(b)) {
      await tap(b);
    } else {
      final arrows = find.byIcon(Icons.arrow_back_rounded);
      if (has(arrows)) {
        await tap(arrows);
      } else {
        await t.binding.handlePopRoute();
      }
    }
    await secs(1.0);
  }

  Future<bool> login() async {
    if (!hasCreds) return false;
    await SecureStore().clear();
    await app.main();
    await secs(3);
    final sheet = find.byKey(const ValueKey('language-sheet'));
    await waitFor(() => has(sheet) || has(find.byType(NovaButton)), timeout: 30);
    await secs(1.2);
    if (has(sheet)) {
      await t.tap(find.byKey(const ValueKey('lang-uz')));
      await secs(0.5);
      await t.tap(find.byKey(const ValueKey('lang-continue')));
      await waitFor(() => !has(sheet), timeout: 5);
      await secs(0.6);
    }
    if (!has(find.byType(TextField))) {
      await t.tap(find.byType(NovaButton).last);
      await waitFor(() => find.byType(TextField).evaluate().length >= 2, timeout: 10);
    }
    final fields = find.byType(TextField);
    if (fields.evaluate().length < 2) return false;
    await t.enterText(fields.at(0), kTestLogin);
    await t.enterText(fields.at(1), kTestPassword);
    await secs(0.4);
    FocusManager.instance.primaryFocus?.unfocus();
    await secs(0.8);
    final submit = find.descendant(
        of: find.byType(LoginScreen), matching: find.byType(NovaButton));
    if (has(submit)) await t.tap(submit.first, warnIfMissed: false);
    final ok = await waitFor(() => has(find.byType(NovaBottomNav)), timeout: 45);
    if (!ok) {
      await t.showKeyboard(fields.at(1));
      await t.testTextInput.receiveAction(TextInputAction.done);
      return waitFor(() => has(find.byType(NovaBottomNav)), timeout: 45);
    }
    return true;
  }

  /// Host yozishni boshlaydi; boshlanganini fayl orqali bildiradi.
  Future<void> startRecording() async {
    final ack = File('$tmp/promo_rec_ack');
    try {
      if (ack.existsSync()) ack.deleteSync();
    } catch (_) {}
    File('$tmp/promo_rec_req').writeAsStringSync('1');
    _log('PROMO_REC_REQ');
    await waitFor(() => ack.existsSync(), timeout: 30);
    rec.start();
    _log('PROMO_REC_START');
  }

  Future<void> run() async {
    tmp = Directory.systemTemp.path;
    _log('E2E_TMP:$tmp');
    final ok = await login();
    _log('PROMO_LOGIN:${ok ? 'OK' : 'FAIL'}');
    if (!ok) return;
    // Asosiy to'liq yuklansin (rasmlar, istoriyalar) — keyin yozuv.
    await secs(6);
    await startRecording();
    await secs(1.5);

    // 1. ASOSIY — tepadan pastga, yana tepaga.
    mark('home');
    await secs(2.5);
    await drag(scroller, -520, ms: 1400);
    await secs(2.0);
    await drag(scroller, -480, ms: 1300);
    await secs(2.0);
    await drag(scroller, 1100, ms: 1200);
    await secs(1.5);

    // 2. NFC MARKAZI.
    final nfcTab = find.descendant(
        of: find.byType(NovaBottomNav), matching: find.byIcon(Icons.nfc_rounded));
    final capsule = find.byKey(const ValueKey('nav-capsule'));
    mark('nfc');
    if (has(nfcTab)) {
      await tap(nfcTab);
    } else if (has(capsule)) {
      await tap(capsule);
    }
    await secs(3.5);
    final qr = find.textContaining('QR kod');
    if (has(qr)) {
      mark('qr');
      await tap(qr);
      await secs(4.0);
      await back();
    }
    await drag(scroller, -400, ms: 1100);
    await secs(2.0);

    // 3. TANLOV — qidiruv: odam, biznes.
    mark('tanlov');
    await tap(tab(Icons.explore_outlined, Icons.explore_rounded));
    await secs(2.5);
    final search = find.byType(TextField);
    if (has(search)) {
      await tap(search);
      await secs(0.6);
      mark('qidiruv');
      await type(search, 'Kofe');
      await secs(3.0);
      FocusManager.instance.primaryFocus?.unfocus();
      await secs(1.0);
      final res = find.textContaining('Kofe Burchak');
      if (has(res)) {
        mark('biznes');
        await tap(res);
        await secs(3.5);
        await drag(scroller, -500, ms: 1300);
        await secs(2.5);
        await drag(scroller, -500, ms: 1300);
        await secs(2.0);
        await back();
      }
      await t.enterText(search.first, '');
      await secs(1.0);
    }
    final biz = find.text('Bizneslar');
    if (has(biz)) {
      mark('bizneslar');
      await tap(biz);
      await secs(3.0);
      await drag(scroller, -450, ms: 1200);
      await secs(2.0);
    }
    final cat = find.text('Katalog');
    if (has(cat)) {
      mark('katalog');
      await tap(cat);
      await secs(3.5);
      await drag(scroller, -500, ms: 1300);
      await secs(2.5);
    }

    // 4. KO'RGAZMA — sahifalarni surib.
    mark('korgazma');
    await tap(tab(Icons.collections_outlined, Icons.collections_rounded));
    await secs(5.0);
    for (var i = 0; i < 2; i++) {
      final size = t.view.physicalSize / t.view.devicePixelRatio;
      _log('PROMO_DRAG:${size.width / 2}:${size.height * .7}:-600:${rec.elapsedMilliseconds}');
      await t.flingFrom(Offset(size.width / 2, size.height * .7),
          const Offset(0, -600), 1400);
      await secs(4.5);
    }

    // 5. PROFIL.
    mark('profil');
    await tap(tab(Icons.person_outline_rounded, Icons.person_rounded));
    await secs(3.5);
    await drag(scroller, -500, ms: 1300);
    await secs(2.5);
    await drag(scroller, 600, ms: 1100);
    await secs(2.0);

    mark('end');
    await secs(1.0);
    File('$tmp/promo_rec_stop').writeAsStringSync('1');
    _log('PROMO_REC_STOP:${rec.elapsedMilliseconds}');
    await secs(3);
    _log('PROMO_DONE');
  }
}
