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

  // ── 3-QATLAM: EKRANMA-EKRAN, QAT'IY TEKSHIRUV ───────────────
  //
  // OLDINGI VARIANTDA bu qadamlar faqat YOZIB qo'yilardi: ekran
  // ochilmasa ham sinov yashil bo'lardi. Ya'ni u hech narsani
  // isbotlamasdi. Endi har bir qadam qat'iy: element topilmasa
  // yoki ekran ochilmasa — sinov YIQILADI.
  //
  // FINDER XATOSI ILOVA BUGI DEB HISOBLANMASLIGI UCHUN: har bir
  // element bir nechta yo'l bilan qidiriladi va topilmagani
  // ALOHIDA xabar bilan aytiladi ("tugma topilmadi" va "ekran
  // ochilmadi" — ikki xil nosozlik).
  testWidgets('3. EKRANLAR — Home · Profil · Biznes · NFC · Sozlamalar · Chiqish',
      (t) async {
    final state = AppState(api: Api(baseUrl: base));
    await t.pumpWidget(NfcstoreApp(state: state));
    await waitFor(
      t,
      find.byWidgetPredicate((w) =>
          w is Text &&
          (w.data == 'O‘tkazib yuborish' ||
              w.data == 'Xush kelibsiz' ||
              w.data == 'Bosh sahifa')),
    );
    await settleFor(t);
    final skip = find.text('O‘tkazib yuborish');
    if (skip.evaluate().isNotEmpty) {
      await t.tap(skip);
      await settleFor(t);
    }

    // ILOVA ALLAQACHON KIRGAN BO'LISHI MUMKIN.
    //
    // Oldingi sinov kirgan va sessiya QURILMADA saqlangan —
    // ilova qayta ochilganda uni tiklaydi va to'g'ridan-to'g'ri
    // qobiqni ko'rsatadi. Bu ilovaning nuqsoni emas, aksincha
    // to'g'ri xatti-harakat; lekin bu yerda kirish ekrani
    // kutilgani uchun sinov "maydon topilmadi" bilan yiqilardi.
    //
    // Shuning uchun avval HOLAT tekshiriladi: kirish kerakmi yoki
    // yo'q.
    if (find.text('Bosh sahifa').evaluate().isEmpty) {
      final fields = find.byType(TextField);
      expect(fields, findsWidgets, reason: 'LOGIN: maydonlar topilmadi');
      await t.enterText(fields.at(0), email);
      await t.enterText(fields.at(1), password);
      var btn = find.widgetWithText(GestureDetector, 'Kirish');
      if (btn.evaluate().isEmpty) btn = find.text('Kirish');
      expect(btn, findsWidgets, reason: 'LOGIN: tugma topilmadi');
      await t.tap(btn.last);
    } else {
      say('SESSIYA TIKLANDI — qaytadan kirish shart emas');
    }

    // ── HOME ─────────────────────────────────────────────────
    final home = await waitFor(t, find.text('Bosh sahifa'));
    await settleFor(t, const Duration(seconds: 3));
    say('HOME: $home');
    expect(home, isTrue, reason: 'HOME: kirgandan keyin qobiq ochilmadi');

    /// Pastki paneldagi tabni bosadi va ekran ochilganini
    /// tekshiradi.
    ///
    /// `expectAny` — o'sha ekranda ALBATTA bo'ladigan matnlar.
    /// Bittasi topilsa yetarli: ekran tarkibi hisobga qarab
    /// o'zgaradi (masalan ID'lari yo'q odamda bo'sh holat
    /// chiqadi), lekin ekranning O'ZI baribir ochilishi shart.
    Future<void> openTab(
      String tab,
      List<String> expectAny, {
      required String nom,
    }) async {
      final f = find.text(tab);
      expect(f, findsWidgets, reason: '$nom: "$tab" tabi TOPILMADI');
      await t.tap(f.last);
      await settleFor(t, const Duration(seconds: 3));

      final hit = expectAny.where((s) => find.text(s).evaluate().isNotEmpty);
      if (hit.isEmpty) {
        final seen = find
            .byType(Text)
            .evaluate()
            .map((e) => (e.widget as Text).data ?? '')
            .where((s) => s.trim().isNotEmpty)
            .take(12)
            .join(' | ');
        say('$nom EKRANDAGI MATN: $seen');
      }
      expect(hit, isNotEmpty, reason: '$nom: ekran ochilmadi');
      say('$nom: ochildi');
    }

    // ── NFC IDS ──────────────────────────────────────────────
    await openTab(
      'NFC',
      ['NFC Tools', 'Mening ID’larim', 'Hali ID yo‘q'],
      nom: 'NFC IDS',
    );

    // ── PROFILE ──────────────────────────────────────────────
    await openTab(
      'Profil',
      ['Mening profilim', 'Sozlamalar', 'Mening kontentim'],
      nom: 'PROFILE',
    );

    // ── BUSINESS ─────────────────────────────────────────────
    //
    // Biznes bo'limi FAQAT kompaniyasi bor hisobda ko'rinadi.
    // Yo'qligi ilovaning nuqsoni EMAS — shuning uchun ikki holat
    // ajratiladi: bo'lsa ochiladi va tekshiriladi, bo'lmasa
    // shunday deb yoziladi.
    final bizEntry = find.text('Biznesni tahrirlash');
    final bizStats = find.text('Biznes statistikasi');
    if (bizEntry.evaluate().isNotEmpty || bizStats.evaluate().isNotEmpty) {
      final target =
          bizEntry.evaluate().isNotEmpty ? bizEntry : bizStats;
      await t.tap(target.last);
      await settleFor(t, const Duration(seconds: 3));
      final opened = find.byType(TextField).evaluate().isNotEmpty ||
          find.textContaining('Biznes').evaluate().isNotEmpty;
      expect(opened, isTrue, reason: 'BUSINESS: bo‘lim ochilmadi');
      say('BUSINESS: ochildi');
      final nav = t.state<NavigatorState>(find.byType(Navigator).first);
      if (nav.canPop()) {
        nav.pop();
        await settleFor(t, const Duration(seconds: 2));
      }
    } else {
      say('BUSINESS: bu hisobda kompaniya yo‘q');
    }

    // ── SETTINGS ─────────────────────────────────────────────
    final settings = find.text('Sozlamalar');
    expect(settings, findsWidgets, reason: 'SETTINGS: yo‘l TOPILMADI');
    await t.tap(settings.last);
    await settleFor(t, const Duration(seconds: 3));
    final inSettings = find.text('Ko‘rinish').evaluate().isNotEmpty ||
        find.text('Hisob').evaluate().isNotEmpty ||
        find.text('Xavfsizlik').evaluate().isNotEmpty;
    expect(inSettings, isTrue, reason: 'SETTINGS: ekran ochilmadi');
    say('SETTINGS: ochildi');

    // ── LOGOUT ───────────────────────────────────────────────
    var out = find.text('Chiqish');
    if (out.evaluate().isEmpty) {
      await t.dragUntilVisible(
        find.text('Chiqish'),
        find.byType(Scrollable).first,
        const Offset(0, -320),
      );
      await settleFor(t);
      out = find.text('Chiqish');
    }
    expect(out, findsWidgets, reason: 'LOGOUT: "Chiqish" tugmasi TOPILMADI');
    await t.tap(out.last);

    final backToLogin = await waitFor(t, find.text('Xush kelibsiz'));
    await settleFor(t, const Duration(seconds: 2));

    // IKKI TOMONLAMA TASDIQ: ekran ham qaytdi, holat ham tozalandi.
    // Faqat ekranga qarash yetmaydi — token qolib ketsa, ilova
    // keyingi ochilishda o'zini kirgan deb hisoblardi.
    say('LOGOUT ekran: $backToLogin · token: ${state.api.token == null} '
        '· hisob: ${state.user == null}');
    expect(backToLogin, isTrue, reason: 'LOGOUT: kirish ekraniga qaytmadi');
    expect(state.api.token, isNull, reason: 'LOGOUT: token tozalanmadi');
    expect(state.user, isNull, reason: 'LOGOUT: hisob keshda qoldi');
    say('LOGOUT: tasdiqlandi');
  });
}
