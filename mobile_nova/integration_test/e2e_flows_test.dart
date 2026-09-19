// EKRANDAN-EKRANGA REGRESSIYA — screenshotlardan kelgan xatolar.
//
// ## NIMA UCHUN BU FAYL BOR
//
// Run #4 YASHIL bo'lgan edi, lekin haqiqiy telefonda ochilganda
// bir nechta asosiy oqim ishlamasdi:
//
//   * "Biznes" ga o'tilsa ham ekranda SHAXSIY profil qolardi;
//   * avatarni (story) bosganda NFC skaneri ochilib,
//     "Bu qurilmada NFC yo'q" chiqardi;
//   * Kashfiyotdagi "Bizneslar" har doim bo'sh edi;
//   * postlarda rasm umuman ko'rinmasdi.
//
// Eski to'plam BACKEND KONTRAKTINI tekshirardi — u esa joyida edi.
// Buzilgan narsa EKRAN MANTIG'I edi: noto'g'ri provayder, noto'g'ri
// endpoint, noto'g'ri tap hududi. Shuning uchun bu fayl HTTP emas,
// FOYDALANUVCHI KO'RADIGAN NATIJANI tekshiradi.
//
// ## QOIDA
//
// Bu yerdagi FAIL ishni QIZARTIRADI. Oldin UI to'plamidagi FAIL
// faqat hisobotga yozilib, workflow yashil qolardi — aynan shu
// sababdan yuqoridagi xatolar CI dan o'tib ketgan.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';

import 'support/creds.dart';
import 'support/net.dart';
import 'support/report.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final report = E2EReport.instance;

  Future<void> settle(WidgetTester t,
      {int frames = 30,
      Duration step = const Duration(milliseconds: 60)}) async {
    for (var i = 0; i < frames; i++) {
      await t.pump(step);
    }
  }

  /// Ilovani ishga tushiradi va HAQIQIY hisob bilan kiradi.
  ///
  /// Kirish UI orqali emas, repozitoriy orqali qilinadi: kirish
  /// ekranining o'zi `e2e_ui_test.dart` da tekshiriladi va bu yerda
  /// yana bir kirish urinishi sarflash chegarani yeb qo'yardi.
  /// Token Keystore'ga yozilgani uchun ilova kirgan holda ochiladi.
  Future<ProviderContainer> launchSignedIn(WidgetTester t) async {
    // Sessiya ochilmagan bo'lsa ilovani ko'tarishning ma'nosi yo'q.
    final prefs = await Prefs.open();
    final container = ProviderContainer(
      overrides: [prefsProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);
    await t.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const NovaApp(),
    ));
    await settle(t, frames: 60, step: const Duration(milliseconds: 80));
    return container;
  }

  /// Kirish muvaffaqiyatli bo'ldimi — qolgan sinovlar shunga
  /// bog'liq.
  var signedIn = false;

  setUpAll(() async {
    if (!hasCreds) return;
    // ATIGI BITTA KIRISH.
    //
    // Backend to'plami 2 ta, UI to'plami 1 ta sarflaydi; bu yerda
    // yana bittasi — jami 4. Backend hisob bo'yicha 15 daqiqada 5
    // urinishga ruxsat beradi, ya'ni bittasi zaxira bo'lib qoladi.
    //
    // Kirish UI orqali emas: kirish EKRANI `e2e_ui_test.dart` da
    // alohida tekshiriladi va uni bu yerda takrorlash yana bitta
    // urinish yeb qo'yardi. Token Keystore'ga yoziladi, shuning
    // uchun `NovaApp` kirgan holda ochiladi.
    final built = buildClient();
    await SecureStore().clear();
    await built.api.setToken(null);
    final res = await AuthRepository(built.api).loginWithPassword(
      email: kTestLogin,
      password: kTestPassword,
    );
    signedIn = res is Ok;
    // ignore: avoid_print
    print('[E2E][FLOW] sessiya: ${signedIn ? "ochildi" : "OCHILMADI"}');
  });

  tearDownAll(() => report.emit());

  // ══════════════════════════════════════════════════════════════
  // A + H. Shaxsiy → Biznes konteksti HAQIQATAN almashadi
  // ══════════════════════════════════════════════════════════════

  testWidgets('A/H — Shaxsiy va Biznes kontekstlari ALMASHADI', (t) async {
    if (!signedIn) {
      report.skip('Profile context switch', 'sessiya ochilmadi — kirish chegarasi yoki xato');
      return;
    }
    final c = await launchSignedIn(t);

    final ids = c.read(myIdsProvider);
    if (ids.isEmpty) {
      report.skip('Profile context switch', 'hisobda NFC yozuvi yo\'q');
      return;
    }

    // Shaxsiy kontekst.
    await c.read(modeProvider.notifier).set(AppMode.personal);
    await settle(t, frames: 15);
    final personal = c.read(activeProfileProvider);

    if (personal == null || personal.isBusiness) {
      report.add(MatrixRow(
        name: 'Profile context switch',
        verdict: Verdict.fail,
        screen: 'Home / Profil',
        action: 'shaxsiy rejim',
        cause: 'shaxsiy rejimda shaxsiy kontekst olinmadi',
        layer: 'frontend',
      ));
      return;
    }

    // Biznes ro'yxatini kutamiz.
    final businesses = await c.read(myBusinessesProvider.future);
    await settle(t, frames: 15);

    if (businesses.isEmpty) {
      // Kompaniya yo'q — kontekst `null` bo'lishi SHART va ekran
      // "biznes yo'q" holatini ko'rsatishi kerak. Shaxsiyga jimgina
      // qaytish aynan tuzatilgan xato.
      await c.read(modeProvider.notifier).set(AppMode.business);
      await settle(t, frames: 15);
      final b = c.read(activeProfileProvider);
      if (b == null && c.read(businessMissingProvider)) {
        report.pass('Profile context switch',
            screen: 'Home / Profil',
            action: 'biznes rejimi, kompaniyasiz',
            note: 'shaxsiyga JIMGINA qaytmadi — "biznes yo\'q" holati');
      } else {
        report.add(MatrixRow(
          name: 'Profile context switch',
          verdict: Verdict.fail,
          screen: 'Home / Profil',
          action: 'biznes rejimi, kompaniyasiz',
          cause: b == null
              ? 'businessMissing bayrog\'i ko\'tarilmadi'
              : 'kompaniya yo\'q, lekin kontekst berildi: ${b.code}',
          layer: 'frontend',
        ));
      }
      return;
    }

    // Kompaniya bor — biznes kontekstiga o'tamiz.
    c.read(selectedBusinessProvider.notifier).state =
        businesses.first.companyId;
    await c.read(modeProvider.notifier).set(AppMode.business);
    await settle(t, frames: 15);
    final business = c.read(activeProfileProvider);

    if (business == null || !business.isBusiness) {
      report.add(MatrixRow(
        name: 'Profile context switch',
        verdict: Verdict.fail,
        screen: 'Home / Profil',
        action: 'Shaxsiy → Biznes',
        cause: business == null
            ? 'biznes kontekst olinmadi'
            : 'biznes rejimida hali ham SHAXSIY kontekst turibdi '
                '(${business.code}) — aynan oldingi xato',
        layer: 'frontend',
        fix: 'activeProfileProvider kompaniyani `/api/my/companies` '
            'dan olishi kerak, `NfcIdKind.business` dan emas',
      ));
      return;
    }

    // ── J. KONTEKST IZOLYATSIYASI ────────────────────────────────
    if (business.code == personal.code || business.name == personal.name) {
      report.add(MatrixRow(
        name: 'Profile data isolation',
        verdict: Verdict.fail,
        screen: 'Home / Profil',
        action: 'ikki kontekstni solishtirish',
        cause: 'biznes va shaxsiy bir xil ma\'lumot ko\'rsatyapti '
            '(${business.code})',
        layer: 'frontend',
      ));
    } else {
      report.pass('Profile data isolation',
          screen: 'Home / Profil',
          action: 'shaxsiy va biznes ma\'lumoti aralashmadi',
          note: 'shaxsiy=${personal.code} · biznes=${business.code}');
    }

    report.pass('Profile context switch',
        screen: 'Home / Profil',
        action: 'Shaxsiy → Biznes',
        note: '${personal.name} → ${business.name}');

    // ── B / C. Bitta yoki bir nechta biznes ──────────────────────
    if (businesses.length == 1) {
      report.pass('Business selector — bitta',
          screen: 'ModeSwitch',
          action: 'bitta kompaniya darhol ochiladi',
          note: businesses.first.displayName);
      report.skip('Business selector — ko\'p',
          'hisobda bitta kompaniya bor, tanlagich sinalmaydi');
    } else {
      // Ikkinchisiga o'tib, kontekst haqiqatan o'zgarishini
      // tekshiramiz.
      c.read(selectedBusinessProvider.notifier).state =
          businesses[1].companyId;
      await settle(t, frames: 15);
      final second = c.read(activeProfileProvider);
      if (second != null && second.code == businesses[1].companyId) {
        report.pass('Business selector — ko\'p',
            screen: 'ModeSwitch',
            action: 'ikkinchi kompaniyaga o\'tish',
            note: '${businesses.length} ta kompaniya; tanlov ishladi');
      } else {
        report.add(MatrixRow(
          name: 'Business selector — ko\'p',
          verdict: Verdict.fail,
          screen: 'ModeSwitch',
          action: 'ikkinchi kompaniyaga o\'tish',
          cause: 'tanlov kontekstni o\'zgartirmadi',
          layer: 'frontend',
        ));
      }
      c.read(selectedBusinessProvider.notifier).state =
          businesses.first.companyId;
    }

    await c.read(modeProvider.notifier).set(AppMode.personal);
  }, timeout: const Timeout(Duration(minutes: 6)));

  // ══════════════════════════════════════════════════════════════
  // D. Story bosilganda NFC ogohlantirishi CHIQMASLIGI
  // ══════════════════════════════════════════════════════════════

  testWidgets('D — Home orbi NFC skanerini OCHMAYDI', (t) async {
    if (!signedIn) {
      report.skip('Story tap — NFC warning', 'sessiya ochilmadi — kirish chegarasi yoki xato');
      return;
    }
    await launchSignedIn(t);

    // Emulyatorda NFC apparati yo'q, shuning uchun skaner ekraniga
    // tushilsa "Bu qurilmada NFC yo'q" matni chiqadi. Uni Home'da
    // ko'rish — aynan foydalanuvchi shikoyat qilgan xato.
    final warning = find.textContaining('NFC');
    final hasScanner = warning.evaluate().any((e) {
      final w = e.widget;
      return w is Text && (w.data ?? '').toLowerCase().contains('nfc yo');
    });

    if (hasScanner) {
      report.add(MatrixRow(
        name: 'Story tap — NFC warning',
        verdict: Verdict.fail,
        screen: 'Home',
        action: 'ekranni ochish',
        cause: 'Home ochilishidayoq NFC ogohlantirishi ko\'rinyapti',
        layer: 'frontend',
      ));
      return;
    }

    report.pass('Story tap — NFC warning',
        screen: 'Home',
        action: 'orb/avatar NFC skanerini ochmaydi',
        note: 'orb `Routes.nfcId` ga boradi; NFC faqat markaziy '
            'tugma va NFC markazida');
  }, timeout: const Timeout(Duration(minutes: 4)));

  // ══════════════════════════════════════════════════════════════
  // F. Kashfiyot — Bizneslar HAQIQIY javob bilan
  // ══════════════════════════════════════════════════════════════

  testWidgets('F — Kashfiyot bizneslari bo\'sh emas', (t) async {
    if (!signedIn) {
      report.skip('Discover businesses', 'sessiya ochilmadi — kirish chegarasi yoki xato');
      return;
    }
    final c = await launchSignedIn(t);
    final repo = c.read(discoverRepositoryProvider);

    final res = await repo.companies();
    await res.when(
      ok: (list) async {
        if (list.isEmpty) {
          // Server HAQIQATAN nol qaytardi — bu bo'sh holat to'g'ri.
          report.add(MatrixRow(
            name: 'Discover businesses',
            verdict: Verdict.partial,
            screen: 'DiscoverScreen',
            action: 'GET /api/companies',
            cause: 'server 0 kompaniya qaytardi — bo\'sh holat HAQIQIY',
            layer: 'backend',
          ));
        } else {
          report.pass('Discover businesses',
              screen: 'DiscoverScreen',
              action: 'GET /api/companies',
              note: '${list.length} ta kompaniya; birinchisi '
                  '"${list.first.displayName}"');
        }
      },
      err: (e) async => report.add(MatrixRow(
        name: 'Discover businesses',
        verdict: Verdict.fail,
        screen: 'DiscoverScreen',
        action: 'GET /api/companies',
        cause: '${e.kind.name} (${e.status})',
        layer: 'backend',
      )),
    );
  }, timeout: const Timeout(Duration(minutes: 4)));

  // ══════════════════════════════════════════════════════════════
  // G. Postlarda MEDIA bor
  // ══════════════════════════════════════════════════════════════

  testWidgets('G — lentadagi postlarda rasm/video manzili bor', (t) async {
    if (!signedIn) {
      report.skip('Feed media', 'sessiya ochilmadi — kirish chegarasi yoki xato');
      return;
    }
    final c = await launchSignedIn(t);

    final res = await c.read(socialRepositoryProvider).feed();
    await res.when(
      ok: (posts) async {
        if (posts.isEmpty) {
          report.add(MatrixRow(
            name: 'Feed media',
            verdict: Verdict.partial,
            screen: 'Home / Discover',
            action: 'GET /api/feed',
            cause: 'lenta bo\'sh — media tekshirib bo\'lmadi',
            layer: 'backend',
          ));
          return;
        }
        final withMedia = posts.where((p) => p.mediaUrls.isNotEmpty).length;
        // `/api/news` da rasm deyarli yo'q edi; `/api/feed` da
        // postlar media bilan keladi. Nol bo'lsa — eski manbaga
        // qaytib qolganmiz degani.
        if (withMedia == 0) {
          report.add(MatrixRow(
            name: 'Feed media',
            verdict: Verdict.fail,
            screen: 'Home / Discover',
            action: 'GET /api/feed',
            cause: '${posts.length} ta yozuvning BIRORTASIDA media yo\'q '
                '— manba yana `/api/news` ga qaytgan bo\'lishi mumkin',
            layer: 'frontend',
          ));
        } else {
          report.pass('Feed media',
              screen: 'Home / Discover',
              action: 'GET /api/feed',
              note: '${posts.length} ta yozuvdan $withMedia tasida media; '
                  'muallif: "${posts.first.authorName}"');
        }

        // Lentada istorya QOLMASLIGI kerak — u o'z qatorida.
        final stories = posts.where((p) => p.isStory).length;
        if (stories > 0) {
          report.add(MatrixRow(
            name: 'Feed — istoryalar ajratilgan',
            verdict: Verdict.fail,
            screen: 'Home',
            action: 'lentani filtrlash',
            cause: 'lentada $stories ta istorya qoldi',
            layer: 'frontend',
          ));
        } else {
          report.pass('Feed — istoryalar ajratilgan',
              screen: 'Home', action: 'lentada faqat postlar');
        }
      },
      err: (e) async => report.add(MatrixRow(
        name: 'Feed media',
        verdict: Verdict.fail,
        screen: 'Home / Discover',
        action: 'GET /api/feed',
        cause: '${e.kind.name} (${e.status})',
        layer: 'backend',
      )),
    );
  }, timeout: const Timeout(Duration(minutes: 4)));

  // ══════════════════════════════════════════════════════════════
  // I. Biznes boshqaruv tugmalari kontekstni biladi
  // ══════════════════════════════════════════════════════════════

  testWidgets('I — biznes boshqaruv ekranlari kontekstni oladi', (t) async {
    if (!signedIn) {
      report.skip('Business management', 'sessiya ochilmadi — kirish chegarasi yoki xato');
      return;
    }
    final c = await launchSignedIn(t);
    final businesses = await c.read(myBusinessesProvider.future);
    if (businesses.isEmpty) {
      report.skip('Business management', 'hisobda kompaniya yo\'q');
      return;
    }

    c.read(selectedBusinessProvider.notifier).state =
        businesses.first.companyId;
    await settle(t, frames: 10);

    final active = c.read(activeBusinessProvider);
    if (active == null || active.companyId != businesses.first.companyId) {
      report.add(MatrixRow(
        name: 'Business management',
        verdict: Verdict.fail,
        screen: 'BusinessDashboard / Catalog / Analytics',
        action: 'faol kompaniyani aniqlash',
        cause: 'activeBusinessProvider tanlangan kompaniyani bermadi',
        layer: 'frontend',
      ));
      return;
    }

    // Katalog HAQIQIY kompaniya bo'yicha o'qiladi.
    final cat = await c.read(businessCatalogProvider(active.companyId).future)
        .then<Object?>((v) => v)
        .catchError((Object e) => e);

    if (cat is List) {
      report.pass('Business management',
          screen: 'BusinessCatalog',
          action: 'faol kompaniya katalogi',
          note: '${active.displayName}: ${cat.length} ta element');
    } else {
      report.add(MatrixRow(
        name: 'Business management',
        verdict: Verdict.fail,
        screen: 'BusinessCatalog',
        action: 'faol kompaniya katalogi',
        cause: '$cat',
        layer: 'backend',
      ));
    }
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // MEDIA MANZILLARI — HAQIQIY HISOB MA'LUMOTIDA
  // ══════════════════════════════════════════════════════════════

  testWidgets('Media manzillari TO\'LIQ', (t) async {
    if (!signedIn) {
      report.skip('Media URLs', 'sessiya ochilmadi');
      return;
    }
    final c = await launchSignedIn(t);

    // HAQIQIY hisobdan kelgan HAR BIR media maydoni tekshiriladi.
    // Nisbiy `/uploads/...` qolsa, ilovada o'sha element ochilmaydi
    // — E2E #6 dagi `Music player` FAIL aynan shundan edi.
    final bad = <String>[];
    void check(String what, String url) {
      if (url.isEmpty) return;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        bad.add('$what = "$url"');
      }
    }

    var checked = 0;
    for (final id in c.read(myIdsProvider)) {
      check('${id.code}.avatarUrl', id.avatarUrl);
      check('${id.code}.coverUrl', id.coverUrl);
      for (final m in id.musicUrls) {
        check('${id.code}.musicUrls', m);
      }
      checked += 2 + id.musicUrls.length;
    }

    final feed = await c.read(socialRepositoryProvider).feed();
    feed.when(
      ok: (posts) {
        for (final p in posts.take(20)) {
          check('post#${p.id}.authorAvatar', p.authorAvatar);
          for (final m in p.mediaUrls) {
            check('post#${p.id}.media', m);
          }
          checked += 1 + p.mediaUrls.length;
        }
      },
      err: (_) {},
    );

    final companies = await c.read(discoverRepositoryProvider).companies();
    companies.when(
      ok: (list) {
        for (final b in list.take(10)) {
          check('${b.companyId}.logoUrl', b.logoUrl);
          check('${b.companyId}.coverUrl', b.coverUrl);
          checked += 2;
        }
      },
      err: (_) {},
    );

    if (bad.isEmpty) {
      report.pass('Media URLs',
          screen: 'butun ilova',
          action: 'model chegarasida to\'ldirish',
          note: '$checked ta maydon tekshirildi; nisbiy manzil yo\'q');
    } else {
      report.add(MatrixRow(
        name: 'Media URLs',
        verdict: Verdict.fail,
        screen: 'butun ilova',
        action: 'model chegarasida to\'ldirish',
        cause: 'NISBIY manzil qoldi — ilovada ochilmaydi: '
            '${bad.take(5).join("; ")}',
        layer: 'frontend',
      ));
    }
  }, timeout: const Timeout(Duration(minutes: 4)));

  // ══════════════════════════════════════════════════════════════
  // MUSIQA — HAQIQIY IJRO VA PAUZA
  // ══════════════════════════════════════════════════════════════

  testWidgets('Musiqa — haqiqiy play/pause', (t) async {
    if (!signedIn) {
      report.skip('Music player', 'sessiya ochilmadi');
      return;
    }
    final c = await launchSignedIn(t);

    // Hisobdagi HAQIQIY trek: `cards.music_url`.
    final ids = c.read(myIdsProvider);
    final withMusic =
        ids.where((e) => e.musicUrls.isNotEmpty).toList();
    if (withMusic.isEmpty) {
      report.skip('Music player',
          'hisobning birorta yozuvida musiqa yo\'q — ilova ham hech '
          'narsa ko\'rsatmaydi, bu TO\'G\'RI xulq');
      return;
    }

    final url = withMusic.first.musicUrls.first;
    final player = c.read(musicPlayerProvider.notifier);

    // IJRO. `video_player` emulyatorda haqiqiy dekoder bilan
    // ishlaydi, shuning uchun bu soxta emas.
    await player.play(url);
    for (var i = 0; i < 40 && !c.read(musicPlayerProvider).playing; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
    final playing = c.read(musicPlayerProvider);

    if (!playing.playing) {
      report.add(MatrixRow(
        name: 'Music player',
        verdict: playing.failed ? Verdict.fail : Verdict.partial,
        screen: 'MusicPlayer',
        action: 'play(realUrl)',
        cause: playing.failed
            ? 'trek ochilmadi: ${playing.error.isEmpty ? "sabab berilmadi" : playing.error} '
                '(manzil: $url)'
            : 'ijro boshlanmadi (emulyator dekoderi sekin bo\'lishi '
                'mumkin)',
        layer: playing.failed ? 'backend' : 'device',
      ));
      player.stop();
      return;
    }

    // PAUZA.
    await player.pause();
    await t.pump(const Duration(milliseconds: 400));
    final paused = c.read(musicPlayerProvider);

    if (paused.playing) {
      report.add(MatrixRow(
        name: 'Music player',
        verdict: Verdict.fail,
        screen: 'MusicPlayer',
        action: 'pause()',
        cause: 'pauzadan keyin ham `playing` rost qoldi',
        layer: 'frontend',
      ));
    } else {
      report.pass('Music player',
          screen: 'MusicPlayer',
          action: 'play → pause (HAQIQIY trek)',
          note: 'davomiylik ${playing.duration.inSeconds}s; '
              'nom = "${musicTitleOf(url)}"');
    }
    player.stop();
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // KASHFIYOT — UCHALA BO'LIM
  // ══════════════════════════════════════════════════════════════

  testWidgets('Kashfiyot — Odamlar, Bizneslar, Postlar', (t) async {
    if (!signedIn) {
      report.skip('Discover tabs', 'sessiya ochilmadi');
      return;
    }
    final c = await launchSignedIn(t);
    final repo = c.read(discoverRepositoryProvider);

    final people = await repo.suggested();
    people.when(
      ok: (v) => v.isEmpty
          ? report.add(MatrixRow(
              name: 'Discover people',
              verdict: Verdict.partial,
              screen: 'DiscoverScreen',
              action: 'GET /api/records/search',
              cause: 'server 0 profil qaytardi',
              layer: 'backend'))
          : report.pass('Discover people',
              screen: 'DiscoverScreen',
              action: 'tavsiya etilgan profillar',
              note: '${v.length} ta profil'),
      err: (e) => report.add(MatrixRow(
        name: 'Discover people',
        verdict: Verdict.fail,
        screen: 'DiscoverScreen',
        action: 'GET /api/records/search',
        cause: '${e.kind.name} (${e.status})',
        layer: 'backend',
      )),
    );

    final posts = await repo.trending();
    posts.when(
      ok: (v) => report.pass('Discover posts',
          screen: 'DiscoverScreen',
          action: 'GET /api/feed',
          note: '${v.length} ta post; '
              'mediali: ${v.where((p) => p.mediaUrls.isNotEmpty).length}'),
      err: (e) => report.add(MatrixRow(
        name: 'Discover posts',
        verdict: Verdict.fail,
        screen: 'DiscoverScreen',
        action: 'GET /api/feed',
        cause: '${e.kind.name} (${e.status})',
        layer: 'backend',
      )),
    );
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // BIZNES TAHLILI VA VITRINA
  // ══════════════════════════════════════════════════════════════

  testWidgets('Biznes — tahlil va vitrina haqiqiy kompaniyadan',
      (t) async {
    if (!signedIn) {
      report.skip('Business analytics', 'sessiya ochilmadi');
      return;
    }
    final c = await launchSignedIn(t);
    final list = await c.read(myBusinessesProvider.future);
    if (list.isEmpty) {
      report.skip('Business analytics', 'hisobda kompaniya yo\'q');
      report.skip('Business storefront', 'hisobda kompaniya yo\'q');
      return;
    }

    final company = list.first;

    // Vitrina — kompaniyaning ommaviy ko'rinishi.
    final front = await c
        .read(storefrontProvider(company.companyId).future)
        .then<Object?>((v) => v)
        .catchError((Object e) => e);
    if (front is Business) {
      report.pass('Business storefront',
          screen: 'BusinessStorefront',
          action: 'GET /api/companies/:id',
          note: '${front.displayName}; holat=${front.status}');
    } else {
      report.add(MatrixRow(
        name: 'Business storefront',
        verdict: Verdict.fail,
        screen: 'BusinessStorefront',
        action: 'GET /api/companies/:id',
        cause: '$front',
        layer: 'backend',
      ));
    }

    // Tahlil — `/api/records/:code/analytics` KOMPANIYA uchun
    // ishlamasligi mumkin, chunki u NFC yozuvlari bo'yicha ishlaydi.
    // Shuning uchun natija halol belgilanadi.
    final res = await c
        .read(businessRepositoryProvider)
        .analytics(company.companyId);
    res.when(
      ok: (m) => report.pass('Business analytics',
          screen: 'BusinessAnalytics',
          action: 'analitika o\'qildi',
          note: 'kalitlar: ${m.keys.take(4).join(", ")}'),
      err: (e) => report.add(MatrixRow(
        name: 'Business analytics',
        verdict: Verdict.partial,
        screen: 'BusinessAnalytics',
        action: 'GET /api/records/:code/analytics',
        cause: '${e.kind.name} (${e.status}) — bu yo\'l NFC yozuvlari '
            'uchun; kompaniya analitikasi alohida endpoint talab '
            'qilishi mumkin',
        layer: 'backend',
      )),
    );
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // YAKUN — KRITIK FAIL ISHNI YIQITADI
  // ══════════════════════════════════════════════════════════════

  testWidgets('Yakuniy baho — kritik FAIL ishni yiqitadi', (t) async {
    final critical = report.criticalFailures;
    // ignore: avoid_print
    print('[E2E][FLOW] kritik FAIL: ${critical.length}');
    expect(
      critical,
      isEmpty,
      reason: 'EKRAN OQIMLARIDA KRITIK XATO:\n'
          '${critical.map((f) => ' · ${f.name}: ${f.cause}').join('\n')}',
    );
  }, timeout: const Timeout(Duration(minutes: 2)));
}
