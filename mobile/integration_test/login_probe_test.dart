// REAL HISOB BILAN KIRISH — QAYERDA UZILAYOTGANINI AJRATADI.
//
// NIMA UCHUN ALOHIDA FAYL: `app_test.dart` da kirish yiqildi,
// lekin sabab NOANIQ qoldi — server rad etdimi, token
// saqlanmadimi, navigatsiya ishlamadimi yoki shunchaki sinov
// ekrandagi tugmani topolmadimi. Bu to'rt xil nosozlik va
// ularning yechimi ham butunlay boshqa.
//
// SHUNING UCHUN TEKSHIRUV IKKI QATLAMGA BO'LINGAN:
//   1. TARMOQ QATLAMI — UI umuman ishlatilmaydi. Agar shu yer
//      yiqilsa, ayb ilovaning ekranida EMAS.
//   2. EKRAN QATLAMI — birinchisi o'tgandagina yuriladi.
//
// MAXFIYLIK: login va parol HECH QAYERGA chop etilmaydi. Faqat
// "keldi/kelmadi", status kodi va uzunlik yoziladi.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore/app.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/state/app_state.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const base = String.fromEnvironment('API_BASE');
  const email = String.fromEnvironment('LOGIN_EMAIL');
  const password = String.fromEnvironment('LOGIN_PASSWORD');

  if (base.isEmpty || email.isEmpty || password.isEmpty) {
    testWidgets('API_BASE va hisob berilishi SHART', (_) async {
      fail('API_BASE / LOGIN_EMAIL / LOGIN_PASSWORD berilmagan.');
    });
    return;
  }

  void say(String s) {
    // ignore: avoid_print
    print('PROBE $s');
  }

  Future<void> settleFor(WidgetTester t,
      [Duration d = const Duration(seconds: 2)]) async {
    for (var i = 0; i < d.inMilliseconds ~/ 100; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  Future<bool> waitFor(WidgetTester t, Finder f, {int steps = 60}) async {
    for (var i = 0; i < steps; i++) {
      await t.pump(const Duration(milliseconds: 250));
      if (f.evaluate().isNotEmpty) return true;
    }
    return false;
  }

  // ── 1-QATLAM: TARMOQ ────────────────────────────────────────
  testWidgets('1. TARMOQ — so‘rov, status, token, foydalanuvchi',
      (t) async {
    final api = Api(baseUrl: base);
    final repo = Repo(api);

    String token = '';
    try {
      token = await repo.login(login: email, password: password);
      say('LOGIN: javob keldi');
    } on ApiError catch (e) {
      say('LOGIN XATO: status=${e.status} kalit=${e.key}');
      fail('kirish so‘rovi rad etildi: HTTP ${e.status} / ${e.key}');
    }

    say('TOKEN: ${token.isEmpty ? "YO‘Q" : "bor, uzunligi ${token.length}"}');
    expect(token, isNotEmpty, reason: 'server token bermadi');

    say('TOKEN SAQLANDI: ${api.token != null}');
    expect(api.token, isNotEmpty, reason: 'token mijozda saqlanmadi');

    final me = await repo.me();
    say('FOYDALANUVCHI: ${me.user == null ? "YO‘Q" : "bor"}');
    say('KARTALAR: ${me.cards.length}');
    expect(me.user, isNotNull, reason: 'kirgandan keyin hisob kelmadi');
  });

  // ── 2-QATLAM: EKRAN ─────────────────────────────────────────
  testWidgets('2. EKRAN — kirish tugmasi va bosh sahifaga o‘tish',
      (t) async {
    await t.pumpWidget(
      NfcstoreApp(state: AppState(api: Api(baseUrl: base))),
    );
    await waitFor(
      t,
      find.byWidgetPredicate((w) =>
          w is Text &&
          (w.data == 'O‘tkazib yuborish' ||
              w.data == 'Xush kelibsiz' ||
              w.data == 'Bosh sahifa')),
    );
    await settleFor(t);

    // Tanishtiruv — toza o'rnatishda birinchi ekran.
    final skip = find.text('O‘tkazib yuborish');
    if (skip.evaluate().isNotEmpty) {
      await t.tap(skip);
      await settleFor(t);
    }
    say('KIRISH EKRANI: ${find.text('Xush kelibsiz').evaluate().isNotEmpty}');

    final fields = find.byType(TextField);
    say('MAYDONLAR: ${fields.evaluate().length}');
    expect(fields, findsWidgets, reason: 'kirish maydonlari topilmadi');

    await t.enterText(fields.at(0), email);
    await t.enterText(fields.at(1), password);
    await settleFor(t, const Duration(milliseconds: 500));

    // TUGMANI IKKI YO'L BILAN QIDIRAMIZ. Birinchisi topilmasa
    // sinov "ilova buzuq" demaydi — u avval boshqa yo'lni sinaydi.
    var btn = find.widgetWithText(GestureDetector, 'Kirish');
    if (btn.evaluate().isEmpty) btn = find.text('Kirish');
    say('KIRISH TUGMASI: ${btn.evaluate().length}');
    expect(btn, findsWidgets, reason: 'kirish tugmasi topilmadi');

    await t.tap(btn.last);
    final opened = await waitFor(t, find.text('Bosh sahifa'));
    await settleFor(t, const Duration(seconds: 3));

    say('BOSH SAHIFA: $opened');
    if (!opened) {
      // Ekranda qanday xato turibdi — aynan shu jumla sababni
      // aytadi (parol emas, tarmoq emas, server emas...).
      final texts = find
          .byType(Text)
          .evaluate()
          .map((e) => (e.widget as Text).data ?? '')
          .where((s) => s.trim().isNotEmpty)
          .take(14)
          .toList();
      say('EKRANDAGI MATN: ${texts.join(" | ")}');
    }
    expect(opened, isTrue, reason: 'kirgandan keyin bosh sahifa ochilmadi');
  });

  // ── 3-QATLAM: TO'RT EKRAN ───────────────────────────────────
  testWidgets('3. EKRANLAR — Profil · Biznes · NFC · Sozlamalar',
      (t) async {
    await t.pumpWidget(
      NfcstoreApp(state: AppState(api: Api(baseUrl: base))),
    );
    await waitFor(
      t,
      find.byWidgetPredicate((w) =>
          w is Text &&
          (w.data == 'O‘tkazib yuborish' || w.data == 'Xush kelibsiz')),
    );
    await settleFor(t);
    final skip = find.text('O‘tkazib yuborish');
    if (skip.evaluate().isNotEmpty) {
      await t.tap(skip);
      await settleFor(t);
    }

    final fields = find.byType(TextField);
    await t.enterText(fields.at(0), email);
    await t.enterText(fields.at(1), password);
    var btn = find.widgetWithText(GestureDetector, 'Kirish');
    if (btn.evaluate().isEmpty) btn = find.text('Kirish');
    await t.tap(btn.last);
    final opened = await waitFor(t, find.text('Bosh sahifa'));
    await settleFor(t, const Duration(seconds: 3));
    expect(opened, isTrue, reason: 'kirish bo‘lmadi — bu qadam kirishga bog‘liq');

    for (final tab in const ['Profil', 'NFC', 'Do‘kon', 'Bosh sahifa']) {
      final f = find.text(tab);
      if (f.evaluate().isEmpty) {
        say('TAB TOPILMADI: $tab');
        continue;
      }
      await t.tap(f.last);
      await settleFor(t, const Duration(seconds: 2));
      say('TAB OCHILDI: $tab');
    }

    // PROFIL ichida biznes va sozlamalar bormi.
    await t.tap(find.text('Profil').last);
    await settleFor(t, const Duration(seconds: 2));
    say('SOZLAMALAR YO‘LI: ${find.text('Sozlamalar').evaluate().isNotEmpty}');
  });
}
