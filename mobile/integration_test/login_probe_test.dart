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
import 'package:nfcstore/design/components/buttons.dart';
import 'package:nfcstore/design/components/icons.dart';
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

    /// HARF KATTA-KICHIGIGA QARAMAYDIGAN MATN QIDIRUVI.
    ///
    /// NIMA UCHUN KERAK: dizaynda ba'zi sarlavhalar ekranga KATTA
    /// HARFDA chiziladi (`Eyebrow`, `.toUpperCase()`). Aniq
    /// solishtirish esa "Mening profilim" ni topa olmaydi —
    /// ekranda "MENING PROFILIM" turadi. Bir marta shu sabab
    /// OCHILGAN ekran "ochilmadi" deb belgilandi: ya'ni finder
    /// xatosi ilova nuqsoni bo'lib ko'rindi.
    Finder textLike(String needle) {
      final want = needle.toUpperCase();
      return find.byWidgetPredicate(
        (w) => w is Text && (w.data ?? '').toUpperCase().trim() == want,
      );
    }

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

      final hit = expectAny.where((s) => textLike(s).evaluate().isNotEmpty);
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

    // ── PERSONAL ─────────────────────────────────────────────
    //
    // PERSONA VA HISOB — BOSHQA NARSA. Bitta email ostida bir
    // nechta shaxs bo'ladi: shaxsiy kartalar va kompaniyalar.
    // Ilova ularni ARALASHTIRMAYDI — har biri alohida "faol
    // shaxs" bo'lib turadi va butun ilova o'shanga qarab
    // ko'rinadi.
    expect(state.active, isNotNull, reason: 'PERSONAL: faol shaxs yo‘q');
    expect(state.active!.isBusiness, isFalse,
        reason: 'PERSONAL: boshida shaxsiy profil faol bo‘lishi kerak');
    say('PERSONAL: ${state.active!.code} · biznes emas');

    /// Profil muqovasidagi tishli g'ildirak — menyu shundan ochiladi.
    Future<void> openMenu() async {
      final gear = find.byWidgetPredicate(
        (w) => w is RoundButton && w.icon == Ico.settings,
      );
      expect(gear, findsWidgets, reason: 'menyu tugmasi TOPILMADI');
      await t.tap(gear.last);
      await settleFor(t, const Duration(seconds: 2));
    }

    /// Menyu → "Shaxsni almashtirish" → ro'yxatdan tanlash.
    Future<void> switchTo(String label, {required String nom}) async {
      await openMenu();
      final sw = textLike('Shaxsni almashtirish');
      expect(sw, findsWidgets, reason: '$nom: almashtirish yo‘li TOPILMADI');
      await t.tap(sw.last);
      await settleFor(t, const Duration(seconds: 2));

      final row = textLike(label);
      if (row.evaluate().isEmpty) {
        final seen = find
            .byType(Text)
            .evaluate()
            .map((e) => (e.widget as Text).data ?? '')
            .where((s) => s.trim().isNotEmpty)
            .take(16)
            .join(' | ');
        say('$nom RO‘YXATDAGI SHAXSLAR: $seen');
      }
      expect(row, findsWidgets, reason: '$nom: "$label" ro‘yxatda YO‘Q');
      await t.tap(row.last);
      await settleFor(t, const Duration(seconds: 3));
    }

    // ── ID RO'YXATI ──────────────────────────────────────────
    //
    // BITTA HISOB — BIR NECHTA NFC ID. Ularning ayrimlari
    // shaxsiy, ayrimlari biznes. Ro'yxat ikkalasini ham BIR
    // JOYDA ko'rsatadi va qaysi biri tanlansa, aynan o'sha ID
    // ning profili ochiladi. Bu yerda avvalo ro'yxatning o'zi
    // tekshiriladi: ikkala tur ham bormi.
    await openMenu();
    final toSwitch = textLike('Shaxsni almashtirish');
    expect(toSwitch, findsWidgets, reason: 'ID LIST: almashtirish yo‘li yo‘q');
    await t.tap(toSwitch.last);
    await settleFor(t, const Duration(seconds: 2));

    final ids = find
        .byType(Text)
        .evaluate()
        .map((e) => (e.widget as Text).data ?? '')
        .where((x) => x.trim().isNotEmpty)
        .toList();
    say('ID LIST: ${ids.take(20).join(" | ")}');

    expect(textLike('VIP001'), findsWidgets,
        reason: 'ID LIST: shaxsiy ID ro‘yxatda yo‘q');
    expect(textLike('NFCSTORE'), findsWidgets,
        reason: 'ID LIST: biznes ID ro‘yxatda yo‘q');

    // ── PERSONAL ID OCHILADI ─────────────────────────────────
    await t.tap(textLike('VIP001').last);
    await settleFor(t, const Duration(seconds: 3));
    expect(state.active!.isBusiness, isFalse,
        reason: 'PERSONAL ID OPEN: shaxsiy ID biznes bo‘lib ochildi');
    expect(state.active!.code.toUpperCase(), 'VIP001',
        reason: 'PERSONAL ID OPEN: boshqa ID ochildi');
    say('PERSONAL ID OPEN: ${state.active!.code}');

    // ── SWITCH TO BUSINESS ───────────────────────────────────
    await switchTo('NFCSTORE', nom: 'SWITCH TO BUSINESS');
    expect(state.active!.isBusiness, isTrue,
        reason: 'SWITCH TO BUSINESS: faol shaxs biznes bo‘lmadi');
    expect(state.active!.code.toUpperCase(), 'NFCSTOREUZ',
        reason: 'SWITCH TO BUSINESS: boshqa kompaniya tanlandi');
    say('SWITCH TO BUSINESS: ${state.active!.code} · biznes');

    // ── BUSINESS PROFILE ─────────────────────────────────────
    //
    // Biznes amallari menyu ICHIDA va faqat faol shaxs biznes
    // bo'lgandagina chiziladi. Ilgari sinov menyuni umuman
    // ochmagan va "kompaniya yo'q" degan xulosa chiqargan edi —
    // holbuki kompaniya bor, bog'langan va API uni qaytaradi.
    await openMenu();
    for (final item in const [
      'Biznesni tahrirlash',
      'Buyurtmalar',
      'Biznes statistikasi',
    ]) {
      expect(textLike(item), findsWidgets,
          reason: 'BUSINESS PROFILE: "$item" yo‘q');
    }
    say('BUSINESS PROFILE: uchala biznes amali ham bor');

    // ── SWITCH BACK TO PERSONAL ──────────────────────────────
    // Menyu hali ochiq — almashtirishga o'tamiz va shaxsiy
    // kartani tanlaymiz. Tanlash KOD bo'yicha: ism takrorlanishi
    // mumkin, kod esa yagona.
    final sw = textLike('Shaxsni almashtirish');
    expect(sw, findsWidgets, reason: 'SWITCH BACK: almashtirish yo‘li yo‘q');
    await t.tap(sw.last);
    await settleFor(t, const Duration(seconds: 2));
    final back = textLike('VIP001');
    expect(back, findsWidgets,
        reason: 'SWITCH BACK: shaxsiy karta ro‘yxatda YO‘Q');
    await t.tap(back.last);
    await settleFor(t, const Duration(seconds: 3));
    expect(state.active!.isBusiness, isFalse,
        reason: 'SWITCH BACK: shaxsiy profilga qaytmadi');
    say('SWITCH BACK TO PERSONAL: ${state.active!.code}');

    // ── SETTINGS ─────────────────────────────────────────────
    //
    // "Sozlamalar" profil ro'yxatining PASTIDA turadi va ekranga
    // sig'maydi. Aylantirmasdan qidirish uni topmaydi — bu
    // ilovaning nuqsoni emas, ro'yxatning oddiy uzunligi.
    //
    // SURISH WIDGET BO'YICHA EMAS, EKRAN KOORDINATASI BO'YICHA.
    //
    // Profil sahifasida bir nechta aylanadigan qism bor va
    // ularning biri — kartalar karuseli — GORIZONTAL. Uni vertikal
    // surish hech narsa qilmaydi: bir marta aynan shu sabab
    // ro'yxat joyidan qimirlamadi va "Sozlamalar topilmadi"
    // deyildi. Ekranning o'rtasidan surish esa qaysi ro'yxat
    // ustida turganimizga bog'liq emas.
    Future<void> scrollTo(Finder f) async {
      if (f.evaluate().isNotEmpty) return;
      final size = t.view.physicalSize / t.view.devicePixelRatio;
      final from = Offset(size.width / 2, size.height * .72);
      for (var i = 0; i < 14 && f.evaluate().isEmpty; i++) {
        await t.dragFrom(from, const Offset(0, -280));
        await settleFor(t, const Duration(milliseconds: 450));
      }
    }

    final settings = textLike('Sozlamalar');
    await scrollTo(settings);
    if (settings.evaluate().isEmpty) {
      final seen = find
          .byType(Text)
          .evaluate()
          .map((e) => (e.widget as Text).data ?? '')
          .where((s) => s.trim().isNotEmpty)
          .take(16)
          .join(' | ');
      say('SETTINGS EKRANDAGI MATN: $seen');
    }
    expect(settings, findsWidgets, reason: 'SETTINGS: yo‘l TOPILMADI');
    await t.tap(settings.last);
    await settleFor(t, const Duration(seconds: 3));
    final inSettings = textLike('Ko‘rinish').evaluate().isNotEmpty ||
        textLike('Hisob').evaluate().isNotEmpty ||
        textLike('Xavfsizlik').evaluate().isNotEmpty ||
        textLike('Sozlamalar').evaluate().isNotEmpty;
    expect(inSettings, isTrue, reason: 'SETTINGS: ekran ochilmadi');
    say('SETTINGS: ochildi');

    // ── LOGOUT ───────────────────────────────────────────────
    var out = textLike('Chiqish');
    await scrollTo(out);
    out = textLike('Chiqish');
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
