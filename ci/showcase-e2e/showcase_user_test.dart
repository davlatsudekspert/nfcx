// KO'RGAZMA — FOYDALANUVCHI MISOLIDA (haqiqiy qurilma, haqiqiy server).
//
// Egasi: "o'zing kirib test qilib ko'r, aniq qil, keyin chiqar,
// foydalanuvchi misolida kirib tekshir".
//
// Ilovaning O'ZI ishga tushadi (`main()` — haqiqiy ProviderScope,
// router, repozitoriylar, https://nfcstore.uz). Hech narsa soxtalashtirilmaydi:
// kirish ekrani orqali BITTA marta kiriladi, keyin odam kabi bosiladi
// va suriladi. Musiqa/video holati `support/video_spy.dart` orqali
// HAQIQIY pleerdan o'qiladi (pozitsiya platformadan).
//
// XAVFSIZLIK: hech qanday yozuvchi amal yo'q — like, saqlash, obuna,
// izoh, xarid, post BOSILMAYDI. Faqat: til tanlash, kirish, tab, surish,
// 🔇, media ustiga bosish, "Videoni ko'rish"/"Instagram" va "×".
//
// Har qadam natijasi `E2E_STEP:{json}` qatori bo'lib chiqadi; ekran
// surati uchun `E2E_SHOT:<nom>` — host (adb screencap / simctl) suratga
// olib, `E2E_TMP` papkasiga `e2e_ack_<nom>` faylini yozadi.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show DartPluginRegistrant;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/icons/nova_icons.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/showcase_ad_card.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/features/showcase/showcase_common.dart';
import 'package:nfcstore_nova/features/showcase/showcase_instagram.dart';
import 'package:nfcstore_nova/features/showcase/showcase_screen.dart';
import 'package:nfcstore_nova/features/showcase/showcase_sound.dart';
import 'package:nfcstore_nova/features/showcase/showcase_video.dart';
import 'package:nfcstore_nova/features/social/engagement.dart' show likeKey;
import 'package:nfcstore_nova/features/social/reels_screen.dart'
    show ReelsChrome;
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/main.dart' as app;
import 'package:nfcstore_nova/routing/shell.dart';

import 'showcase_support/creds.dart';
import 'showcase_support/video_spy.dart';

// ── NATIJALAR ────────────────────────────────────────────────────────

class StepResult {
  StepResult(this.id, this.name);
  final String id;
  final String name;
  String status = 'PASS';
  final List<String> problems = [];
  final Map<String, Object?> values = {};
  int ms = 0;

  void check(bool ok, String what) {
    if (!ok) {
      status = 'FAIL';
      problems.add(what);
    }
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'status': status,
        'ms': ms,
        if (problems.isNotEmpty) 'problems': problems,
        'values': values,
      };
}

final _results = <StepResult>[];
final _flutterErrors = <String>[];

void _log(String s) {
  // ignore: avoid_print
  print(redact(s));
}

void _emit(StepResult r) {
  var line = jsonEncode(r.toJson());
  if (line.length > 3500) {
    r.values.removeWhere((k, _) => k.startsWith('players'));
    line = jsonEncode(r.toJson());
    if (line.length > 3500) line = line.substring(0, 3500);
  }
  _log('E2E_STEP:$line');
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  // Haqiqiy kadrlar: animatsiya, video teksturasi, WebView — odatdagidek.
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('Ko\'rgazma — foydalanuvchi misolida', (t) async {
    // FlutterError'lar yig'iladi (rasm yuklanmasa va h.k.) — hisobotga.
    final prevOnError = FlutterError.onError;
    FlutterError.onError = (d) {
      if (_flutterErrors.length < 30) {
        _flutterErrors.add(redact(d.exceptionAsString()).split('\n').first);
      }
    };
    try {
      await _Run(t).all();
    } finally {
      FlutterError.onError = prevOnError;
    }
  }, timeout: const Timeout(Duration(minutes: 30)));
}

class _Run {
  _Run(this.t);
  final WidgetTester t;
  late final SpyVideoPlatform spy;
  late ProviderContainer c;
  late final String tmp;

  Size get screen {
    final v = t.view;
    return v.physicalSize / v.devicePixelRatio;
  }

  // ── VAQT ───────────────────────────────────────────────────────────

  Future<void> wait(Duration d) async {
    final sw = Stopwatch()..start();
    while (sw.elapsed < d) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  Future<bool> waitFor(bool Function() cond,
      {Duration timeout = const Duration(seconds: 15)}) async {
    final sw = Stopwatch()..start();
    while (sw.elapsed < timeout) {
      if (cond()) return true;
      await t.pump(const Duration(milliseconds: 150));
    }
    return cond();
  }

  Future<T?> waitForAsync<T>(Future<T?> Function() probe,
      {Duration timeout = const Duration(seconds: 15),
      Duration every = const Duration(milliseconds: 500)}) async {
    final sw = Stopwatch()..start();
    while (true) {
      final v = await probe();
      if (v != null) return v;
      if (sw.elapsed >= timeout) return null;
      await wait(every);
    }
  }

  bool has(Finder f) => f.evaluate().isNotEmpty;

  // ── QADAM ──────────────────────────────────────────────────────────

  Future<StepResult> step(
      String id, String name, Future<void> Function(StepResult r) body,
      {String? shot}) async {
    final r = StepResult(id, name);
    _log('[SHOWCASE] >> $id $name');
    final sw = Stopwatch()..start();
    try {
      await body(r);
    } catch (e, st) {
      r.status = 'FAIL';
      r.problems.add('exception: ${redact('$e')}'.split('\n').first);
      _log('[SHOWCASE] exception in $id: ${redact('$e')}\n$st');
    }
    if (swipeLog.isNotEmpty) {
      r.values['swipes'] = List.of(swipeLog);
      swipeLog.clear();
    }
    if (shot != null) {
      r.values['screenshot'] = await screenshot(shot);
    }
    r.ms = sw.elapsedMilliseconds;
    _results.add(r);
    _emit(r);
    _log('[SHOWCASE] << $id ${r.status} ${r.problems.join('; ')}');
    return r;
  }

  /// Host ekranni QURILMADA suratga oladi (WebView ham ko'rinadi).
  Future<String> screenshot(String name) async {
    final ack = File('$tmp/e2e_ack_$name');
    try {
      if (ack.existsSync()) ack.deleteSync();
    } catch (_) {}
    await wait(const Duration(milliseconds: 400));
    // So'rov fayl orqali ham (iOS: host konteyner papkasini ko'radi —
    // log kechiksa ham surat aynan shu lahzada).
    try {
      File('$tmp/e2e_req_$name').writeAsStringSync(name);
    } catch (_) {}
    _log('E2E_SHOT:$name');
    final sw = Stopwatch()..start();
    while (sw.elapsed < const Duration(seconds: 25)) {
      if (ack.existsSync()) return '$name.png';
      await t.pump(const Duration(milliseconds: 200));
    }
    return '$name.png (ack-timeout)';
  }

  // ── PLEERLAR ───────────────────────────────────────────────────────

  /// Video emulyatorda dasturiy dekoder bilan sekin o'ynashi mumkin —
  /// shuning uchun "o'ynayapti" chegarasi videoda pastroq ([minAdvance]),
  /// tezlik (`rate`) esa alohida yoziladi.
  Future<Map<String, Object?>> playerState(PlayerRec? r,
      {Duration window = const Duration(seconds: 3),
      Duration minAdvance = const Duration(milliseconds: 800)}) async {
    if (r == null) return {'player': null};
    final a = await measure(spy, r, window: window);
    return {
      ...r.toJson(),
      ...a.toJson(),
      'rate': (a.delta.inMilliseconds / a.window.inMilliseconds)
          .toStringAsFixed(2),
      'moving': a.moving(minAdvance: minAdvance),
      'still': a.still,
    };
  }

  /// [uri] pleeri paydo bo'lib, pozitsiyasi oldinga ketguncha kutadi.
  Future<Map<String, Object?>> waitPlaying(String uri,
      {Duration timeout = const Duration(seconds: 15),
      Duration minAdvance = const Duration(milliseconds: 800)}) async {
    Map<String, Object?> last = {'player': null};
    final sw = Stopwatch()..start();
    while (sw.elapsed < timeout) {
      final r = spy.latest(uri);
      if (r != null && r.playCalled) {
        last = await playerState(r, minAdvance: minAdvance);
        if (last['moving'] == true) {
          last['waitedMs'] = sw.elapsedMilliseconds;
          return last;
        }
      } else {
        await wait(const Duration(milliseconds: 500));
      }
    }
    final r = spy.latest(uri);
    if (r != null) last = await playerState(r, minAdvance: minAdvance);
    last['waitedMs'] = sw.elapsedMilliseconds;
    return last;
  }

  List<Map<String, Object?>> alivePlayers() => [
        for (final r in spy.alive) {...r.toJson()},
      ];

  // ── KO'RGAZMA HOLATI ───────────────────────────────────────────────

  List<Post> get items {
    final list = c.read(showcaseProvider).valueOrNull ?? const <Post>[];
    return list;
  }

  ShowcasePage? get visiblePage {
    for (final w in t.widgetList<ShowcasePage>(find.byType(ShowcasePage))) {
      if (w.visible) return w;
    }
    return null;
  }

  int get index {
    final p = visiblePage;
    if (p == null) return -1;
    return items.indexWhere((e) => likeKey(e) == likeKey(p.post));
  }

  Finder inVisible(Finder f) {
    final p = visiblePage;
    if (p == null) return find.byKey(const ValueKey('__none__'));
    return find.descendant(of: find.byWidget(p), matching: f);
  }

  State? get visibleState {
    final p = visiblePage;
    if (p == null) return null;
    return t.state(find.byWidget(p));
  }

  String get ownerType =>
      c.read(audioOwnerProvider).current?.runtimeType.toString() ?? 'null';

  bool get ownerIsVisiblePage {
    final s = visibleState;
    return s != null && identical(c.read(audioOwnerProvider).current, s);
  }

  Map<String, Object?> describe(Post p) => {
        'id': p.id,
        'code': p.code,
        'title': p.title.length > 40 ? p.title.substring(0, 40) : p.title,
        'ad': p.isAd,
        'videoAd': p.isShowcaseVideoAd,
        'music': shortUri(p.music?.playUrl ?? ''),
        'link': p.linkUrl,
      };

  /// Odam kabi yuqoriga surish (keyingi sahifa) / pastga (oldingi).
  final swipeLog = <String>[];

  double? get pagerPage {
    final f = find.byKey(const ValueKey('showcase-pager'));
    if (f.evaluate().isEmpty) return null;
    final pv = t.widget<PageView>(f.first);
    final ctl = pv.controller;
    return (ctl != null && ctl.hasClients) ? ctl.page : null;
  }

  /// Odam kabi barmoq bilan surish: real vaqtda ~300 ms, ekranning
  /// 55% i (yarmidan ko'p — tezlikdan qat'i nazar sahifa almashadi).
  Future<bool> swipe({required bool next}) async {
    final before = index;
    final pager = find.byKey(const ValueKey('showcase-pager'));
    if (!has(pager)) {
      swipeLog.add('pager yo\'q');
      return false;
    }
    final total = screen.height * .55 * (next ? -1 : 1);
    for (var attempt = 0; attempt < 3; attempt++) {
      final p0 = pagerPage;
      final start = Offset(screen.width * .5,
          next ? screen.height * .72 : screen.height * .28);
      final g = await t.startGesture(start);
      const n = 15;
      for (var i = 0; i < n; i++) {
        await g.moveBy(Offset(0, total / n));
        await t.pump(const Duration(milliseconds: 20));
      }
      await g.up();
      final ok = await waitFor(() => index != before && index >= 0,
          timeout: const Duration(seconds: 4));
      swipeLog.add('$before->$index page ${p0?.toStringAsFixed(2)}->'
          '${pagerPage?.toStringAsFixed(2)} ok=$ok');
      if (ok) {
        await settlePager();
        return true;
      }
    }
    return false;
  }

  /// Sahifa to'liq to'xtadi (butun son) — tugmalar joyida.
  Future<void> settlePager() async {
    await waitFor(() {
      final p = pagerPage;
      return p == null || (p - p.roundToDouble()).abs() < .01;
    }, timeout: const Duration(seconds: 5));
    await wait(const Duration(milliseconds: 500));
  }

  /// Odam kabi bosish: element ko'rinib, ustida hech narsa bo'lmaguncha
  /// kutadi; bo'lmasa ham markaziga bosadi (natija yoziladi).
  Future<String> tapReal(Finder f) async {
    final ok = await waitFor(() => has(f.hitTestable()),
        timeout: const Duration(seconds: 6));
    if (ok) {
      await t.tap(f.hitTestable().first);
      return 'hit';
    }
    if (!has(f)) return 'missing';
    await t.tapAt(t.getCenter(f.first, warnIfMissed: false));
    return 'tapAt(not-hittable)';
  }

  Future<bool> goTo(int target) async {
    var guard = 0;
    while (index != target && guard++ < 20) {
      if (!await swipe(next: target > index)) return false;
    }
    return index == target;
  }

  /// Joriy sahifadan eng yaqin mos sahifa.
  int nearest(bool Function(Post) ok) {
    final list = items;
    final cur = index < 0 ? 0 : index;
    for (var d = 0; d < list.length; d++) {
      for (final i in [cur + d, cur - d]) {
        if (i >= 0 && i < list.length && ok(list[i])) return i;
      }
    }
    return -1;
  }

  bool chromeHidden(String key) {
    final f = inVisible(find.byKey(ValueKey(key)));
    if (f.evaluate().isEmpty) return false;
    return t.widget<ReelsChrome>(f.first).hidden;
  }

  bool topbarHidden() {
    final f = find.byKey(const ValueKey('showcase-topbar'));
    if (f.evaluate().isEmpty) return true;
    return t.widget<ReelsChrome>(f.first).hidden;
  }

  bool muteIcon(IconData icon) => has(find.descendant(
      of: find.byKey(const ValueKey('showcase-mute')),
      matching: find.byIcon(icon)));

  Future<String> js(Finder webFinder, String code) async {
    final w = t.widget<WebViewWidget>(webFinder.first);
    try {
      final v = await w.platform.params.controller
          .runJavaScriptReturningResult(code)
          .timeout(const Duration(seconds: 5));
      var s = '$v';
      if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
        s = s.substring(1, s.length - 1);
      }
      return s;
    } catch (e) {
      return 'jsErr:${'$e'.split('\n').first}';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  Future<void> all() async {
    tmp = Directory.systemTemp.path;
    _log('E2E_TMP:$tmp');
    _log('E2E_PLATFORM:${Platform.operatingSystem}');

    // HAQIQIY pleer platformasi o'ramaga olinadi (faqat kuzatish).
    DartPluginRegistrant.ensureInitialized();
    spy = SpyVideoPlatform(VideoPlayerPlatform.instance);
    VideoPlayerPlatform.instance = spy;

    // a. ISHGA TUSHIRISH VA KIRISH ───────────────────────────────────
    final login = await step('a', 'Ishga tushirish va kirish (UI orqali)',
        (r) async {
      r.check(hasCreds, 'sinov hisobi berilmagan (NOVA_TEST_LOGIN/PASSWORD)');
      if (!hasCreds) return;
      // Toza holat: avvalgi sessiya yo'q — kirish ekrani chiqadi.
      await SecureStore().clear();
      await app.main();
      await wait(const Duration(seconds: 3));
      c = ProviderScope.containerOf(t.element(find.byType(NovaApp)));

      // Splash -> Welcome. Birinchi ochilishda Welcome ustida til varag'i.
      final sheet = find.byKey(const ValueKey('language-sheet'));
      final onWelcome = await waitFor(
          () => has(sheet) || has(find.byType(NovaButton)),
          timeout: const Duration(seconds: 30));
      r.check(onWelcome, 'Welcome ekrani chiqmadi');
      await wait(const Duration(milliseconds: 1500));
      if (has(sheet)) {
        // Odam kabi: "O'zbekcha" -> "Davom etish".
        await t.tap(find.byKey(const ValueKey('lang-uz')));
        await wait(const Duration(milliseconds: 600));
        await t.tap(find.byKey(const ValueKey('lang-continue')));
        await waitFor(() => !has(sheet), timeout: const Duration(seconds: 5));
        await wait(const Duration(milliseconds: 800));
        r.values['languageSheet'] = 'uz tanlandi';
      }
      if (!has(find.byType(TextField))) {
        final l = L.of(t.element(find.byType(NovaButton).first));
        final loginBtn = find.widgetWithText(NovaButton, l.welcomeLogin);
        await t.tap(has(loginBtn) ? loginBtn.first : find.byType(NovaButton).last);
        await waitFor(() => find.byType(TextField).evaluate().length >= 2,
            timeout: const Duration(seconds: 10));
      }
      final fields = find.byType(TextField);
      r.check(fields.evaluate().length >= 2, 'login/parol maydonlari yo\'q');
      if (fields.evaluate().length < 2) return;
      await t.enterText(fields.at(0), kTestLogin);
      await t.enterText(fields.at(1), kTestPassword);
      await wait(const Duration(milliseconds: 500));
      // Klaviatura yopiladi (iOS'da tugma uning ostida qolardi), keyin
      // BITTA kirish urinishi. Tugma — aynan LoginScreen ichidagi (pastdagi
      // Welcome marshrutining tugmalari ham daraxtda turadi).
      FocusManager.instance.primaryFocus?.unfocus();
      await wait(const Duration(milliseconds: 800));
      final submit = find.descendant(
          of: find.byType(LoginScreen), matching: find.byType(NovaButton));
      if (has(submit)) {
        await t.ensureVisible(submit.first);
        await wait(const Duration(milliseconds: 500));
      }
      Set<String> texts() => t
          .widgetList<Text>(find.byType(Text))
          .map((w) => w.data ?? '')
          .toSet();
      final before = texts();
      final how = await tapReal(submit);
      r.values['submitTap'] = how;
      bool busy() =>
          has(submit) && t.widget<NovaButton>(submit.first).busy;
      if (how != 'hit') {
        // Bosish tugmaga yetmagan bo'lsa (so'rov ketmagan: tugma band
        // emas va Asosiy ochilmagan) — odam kabi klaviaturadagi "Tayyor".
        await wait(const Duration(seconds: 3));
        // Xato matni chiqqan bo'lsa — so'rov ketgan, qayta yuborilmaydi.
        final appeared = texts().difference(before);
        r.values['afterTapNewTexts'] = appeared.map(redact).toList();
        if (!busy() && appeared.isEmpty && !has(find.byType(NovaBottomNav))) {
          await t.showKeyboard(fields.at(1));
          await t.testTextInput.receiveAction(TextInputAction.done);
          r.values['submitTap'] = '$how -> keyboard done';
        }
      }
      final home = await waitFor(() => has(find.byType(NovaBottomNav)),
          timeout: const Duration(seconds: 45));
      r.values['loginAttempts'] = 1;
      // Surat FAQAT Asosiy ochilganda: kirish ekranida login ko'rinadi.
      if (home) r.values['screenshot'] = await screenshot('00_after_login');
      r.check(home, 'kirishdan keyin Asosiy (pastki menyu) ochilmadi');
      if (!home) {
        final texts = t
            .widgetList<Text>(find.byType(Text))
            .map((w) => w.data ?? '')
            .where((s) => s.isNotEmpty)
            .take(15)
            .toList();
        r.values['screenTexts'] = texts.map(redact).toList();
      }
      // Uzbek tili (varaq chiqmagan bo'lsa ham) — egasi ko'radigan holat.
      final loc = c.read(localeProvider);
      r.values['locale'] = loc.languageCode;
      r.values['showcaseMutedPref'] = c.read(showcaseMutedProvider);
    });
    if (login.status != 'PASS' || !has(find.byType(NovaBottomNav))) {
      _finish();
      return;
    }

    // b. ASOSIY — REKLAMA KARTASI ────────────────────────────────────
    await step('b', 'Asosiy: Ko\'rgazma reklama kartasi (ovozsiz video)',
        (r) async {
      final adLoaded = await waitFor(
          () => c.read(homeShowcaseAdProvider) != null,
          timeout: const Duration(seconds: 20));
      final ad = c.read(homeShowcaseAdProvider);
      r.values['ads'] = (c.read(homeShowcaseAdsProvider).valueOrNull ?? [])
          .map((p) => p.title.split(' ').first)
          .toList();
      r.check(adLoaded && ad != null, 'reklama kartasi uchun ma\'lumot kelmadi');
      if (ad == null) return;
      r.values['ad'] = describe(ad);
      r.check(ad.title.contains('BOY777') || ad.title.contains('LOL707'),
          'karta sarlavhasi BOY777/LOL707 emas: ${ad.title}');
      final card = find.byKey(const ValueKey('home-ad-card'));
      Finder scroller() => has(card)
          ? find.ancestor(of: card, matching: find.byType(Scrollable)).first
          : find.byType(Scrollable).first;
      // Odam kabi pastga suradi, karta to'liq ko'ringuncha.
      var visible = false;
      for (var i = 0; i < 14 && !visible; i++) {
        var dy = -260.0;
        if (has(card)) {
          final rect = t.getRect(card);
          final top = MediaQuery.paddingOf(t.element(card)).top + 8;
          final bottom = screen.height - 110;
          if (rect.top >= top && rect.bottom <= bottom) {
            visible = true;
            break;
          }
          dy = rect.bottom > bottom
              ? -(rect.bottom - bottom + 20).clamp(60.0, 320.0)
              : (top - rect.top + 20).clamp(60.0, 320.0);
        }
        await t.timedDrag(scroller(), Offset(0, dy),
            const Duration(milliseconds: 700),
            warnIfMissed: false);
        await wait(const Duration(milliseconds: 700));
      }
      r.check(visible, 'reklama kartasi ekranda to\'liq ko\'rinmadi');
      r.check(has(find.byKey(const ValueKey('home-ad-badge'))),
          '"Reklama" belgisi yo\'q');
      final l = L.of(t.element(card));
      r.check(has(find.descendant(of: card, matching: find.text(l.feedSponsored))),
          '"${l.feedSponsored}" matni kartada yo\'q');
      r.check(has(find.byKey(const ValueKey('home-ad-title'))),
          'karta sarlavhasi yo\'q');
      final v = await waitPlaying(ad.videoUrl,
          timeout: const Duration(seconds: 20), minAdvance: const Duration(milliseconds: 500));
      r.values['video'] = v;
      r.check(v['initialized'] == true, 'karta videosi initialize bo\'lmadi');
      r.check(v['moving'] == true, 'karta videosi o\'ynamayapti (pozitsiya joyida)');
      r.check(v['volume'] == 0.0, 'karta videosi ovozsiz emas (volume=${v['volume']})');
      r.check(has(find.byKey(const ValueKey('home-ad-player'))),
          'VideoPlayer vidjeti kartada chizilmagan (poster turibdi)');
    }, shot: '01_home_ad_card');

    // c. KO'RGAZMA TABI ──────────────────────────────────────────────
    String? firstMusic;
    await step('c', 'Ko\'rgazma tabi: birinchi sahifa musiqasi o\'ynaydi',
        (r) async {
      final nav = find.byType(NovaBottomNav);
      var tab = find.descendant(
          of: nav, matching: find.byIcon(Icons.collections_outlined));
      if (!has(tab)) {
        final l = L.of(t.element(nav));
        tab = find.descendant(of: nav, matching: find.text(l.navShowcase));
      }
      r.check(has(tab), 'Ko\'rgazma tabi topilmadi');
      if (!has(tab)) return;
      await t.tap(tab.first);
      final opened = await waitFor(
          () => visiblePage != null && items.isNotEmpty,
          timeout: const Duration(seconds: 20));
      r.check(opened, 'Ko\'rgazma sahifalari ochilmadi');
      if (!opened) return;
      r.values['activeTab'] = c.read(activeTabProvider);
      r.values['pages'] = items.length;
      r.values['feed'] = [
        for (final p in items) '${p.title.split(' ').first}${p.isShowcaseVideoAd ? '(video)' : ''}'
      ];
      final page = visiblePage!.post;
      r.values['page'] = describe(page);
      r.check(muteIcon(NovaIcons.sound) && !muteIcon(NovaIcons.muted),
          'ovoz tugmasi oddiy karnay emas (🔇 saqlangan?)');
      r.values['mutedPref'] = c.read(showcaseMutedProvider);
      final url = page.music?.playUrl ?? '';
      if (url.isEmpty) {
        r.values['note'] = 'birinchi sahifada musiqa yo\'q';
        return;
      }
      firstMusic = url;
      final m = await waitPlaying(url, timeout: const Duration(seconds: 15));
      r.values['music'] = m;
      r.check(m['playCalled'] == true, 'musiqa pleeri play() olmadi');
      r.check(m['moving'] == true,
          'musiqa pozitsiyasi 3 s da oldinga ketmadi (o\'ynamayapti)');
      r.check((m['volume'] as num? ?? 0) > 0, 'musiqa ovozi 0');
      r.values['audioOwner'] = ownerType;
      r.check(ownerIsVisiblePage, 'audio egasi joriy sahifa emas ($ownerType)');
    }, shot: '02_showcase_first');

    // d. KEYINGI SAHIFA ──────────────────────────────────────────────
    await step('d', 'Keyingi sahifaga surish: yangi sahifa musiqasi', (r) async {
      final from = index;
      final moved = await swipe(next: true);
      r.check(moved, 'surish sahifani almashtirmadi');
      if (!moved) return;
      var page = visiblePage!.post;
      r.values['page'] = describe(page);
      r.values['index'] = '$from -> $index';
      if (firstMusic != null) {
        final old = spy.latest(firstMusic!, alive: false);
        final s = await playerState(old, window: const Duration(seconds: 2));
        r.values['previousMusic'] = s;
        final same = firstMusic == page.music?.playUrl;
        if (!same) {
          r.check(s['disposed'] == true || s['still'] == true || s['player'] == null,
              'oldingi sahifa musiqasi hali o\'ynayapti');
        }
      }
      if ((page.music?.playUrl ?? '').isEmpty) {
        r.values['silentPage'] = 'bu sahifada musiqa yo\'q — jim bo\'lishi kerak';
        final moving = <String>[];
        for (final p in spy.alive) {
          final a = await measure(spy, p, window: const Duration(seconds: 2));
          if (a.moving(minAdvance: const Duration(milliseconds: 800))) {
            moving.add(shortUri(p.uri));
          }
        }
        r.values['silentPageMoving'] = moving;
        // Musiqali keyingi sahifagacha suriladi.
        final target = () {
          final list = items;
          for (var i = index + 1; i < list.length; i++) {
            if ((list[i].music?.playUrl ?? '').isNotEmpty &&
                list[i].music!.playUrl != firstMusic) {
              return i;
            }
          }
          return -1;
        }();
        if (target < 0) return;
        r.check(await goTo(target), 'musiqali sahifaga surib bo\'lmadi');
        page = visiblePage!.post;
        r.values['pageWithMusic'] = describe(page);
      }
      final url = page.music?.playUrl ?? '';
      if (url.isEmpty) return;
      r.values['differentTrack'] = url != firstMusic;
      final m = await waitPlaying(url, timeout: const Duration(seconds: 15));
      r.values['music'] = m;
      r.check(m['moving'] == true, 'yangi sahifa musiqasi o\'ynamayapti');
      r.check(ownerIsVisiblePage, 'audio egasi joriy sahifa emas ($ownerType)');
    }, shot: '03_showcase_next');

    // e. BOY777 VIDEO REKLAMA ────────────────────────────────────────
    await step('e', 'BOY777 video reklama: video ovozsiz + musiqa', (r) async {
      var target = nearest((p) => p.isShowcaseVideoAd && p.title.contains('BOY777'));
      if (target < 0) {
        r.values['note'] = 'BOY777 lentada yo\'q — boshqa video reklama';
        target = nearest((p) => p.isShowcaseVideoAd);
      }
      r.check(target >= 0, 'lentada video reklama yo\'q');
      if (target < 0) return;
      r.values['targetIndex'] = target;
      final ok = await goTo(target);
      r.check(ok, 'reklama sahifasiga surib bo\'lmadi');
      if (!ok) return;
      final p = visiblePage!.post;
      r.values['page'] = describe(p);
      final v = await waitPlaying(p.videoUrl,
          timeout: const Duration(seconds: 20), minAdvance: const Duration(milliseconds: 500));
      r.values['video'] = v;
      r.check(v['moving'] == true, 'reklama videosi o\'ynamayapti');
      r.check(v['volume'] == 0.0, 'reklama videosi ovozsiz emas (volume=${v['volume']})');
      r.check(has(inVisible(find.byKey(const ValueKey('showcase-ad-player')))),
          'video kadr chizilmagan (poster)');
      final mu = p.music?.playUrl ?? '';
      r.check(mu.isNotEmpty, 'reklamada musiqa yo\'q');
      if (mu.isEmpty) return;
      final m = await waitPlaying(mu, timeout: const Duration(seconds: 15));
      r.values['music'] = m;
      r.check(m['moving'] == true, 'reklama musiqasi o\'ynamayapti');
      r.check((m['volume'] as num? ?? 0) > 0, 'musiqa ovozi 0');
      r.values['audioOwner'] = ownerType;
      r.values['mixWithOthersCalls'] = spy.mixCalls.length > 12
          ? spy.mixCalls.sublist(spy.mixCalls.length - 12)
          : spy.mixCalls;
    }, shot: '04_ad_video_music');

    // f. 🔇 TUGMASI ──────────────────────────────────────────────────
    await step('f', 'Burchakdagi 🔇: o\'chirish va qayta yoqish', (r) async {
      final page = visiblePage?.post;
      final mu = page?.music?.playUrl ?? '';
      final btn = find.byKey(const ValueKey('showcase-mute'));
      r.check(has(btn), 'ovoz tugmasi yo\'q');
      if (!has(btn) || mu.isEmpty) return;
      await t.tap(btn);
      await wait(const Duration(milliseconds: 1200));
      r.values['mutedPref'] = c.read(showcaseMutedProvider);
      r.check(c.read(showcaseMutedProvider), 'holat 🔇 ga o\'tmadi');
      r.check(muteIcon(NovaIcons.muted), 'ikonka ustidan chizilgan karnay emas');
      final s = await playerState(spy.latest(mu, alive: false),
          window: const Duration(seconds: 2));
      r.values['musicMuted'] = s;
      r.check(s['still'] == true || s['disposed'] == true ||
              s['volume'] == 0.0 || s['playCalled'] == false,
          '🔇 dan keyin musiqa hali o\'ynayapti');
      if (page!.isShowcaseVideoAd) {
        final v = await playerState(spy.latest(page.videoUrl),
            window: const Duration(seconds: 2), minAdvance: const Duration(milliseconds: 500));
        r.values['videoWhileMuted'] = v;
        r.check(v['moving'] == true, '🔇 da video to\'xtab qoldi');
      }
      r.values['muteShot'] = await screenshot('05_muted');
      await t.tap(btn);
      await wait(const Duration(milliseconds: 800));
      r.check(!c.read(showcaseMutedProvider), 'qayta bosilganda ovoz yoqilmadi');
      r.check(muteIcon(NovaIcons.sound), 'ikonka oddiy karnayga qaytmadi');
      final m = await waitPlaying(mu, timeout: const Duration(seconds: 12));
      r.values['musicUnmuted'] = m;
      r.check(m['moving'] == true, 'qayta yoqilganda musiqa davom etmadi');
    }, shot: '06_unmuted');

    // g. TOZA REJIM ──────────────────────────────────────────────────
    await step('g', 'Media ustiga bosish: toza rejim va qaytish', (r) async {
      final page = visiblePage;
      r.check(page != null, 'sahifa yo\'q');
      if (page == null) return;
      final media = page.post.isShowcaseVideoAd
          ? inVisible(find.byKey(const ValueKey('showcase-ad-video')))
          : inVisible(find.byKey(const ValueKey('showcase-carousel')));
      r.check(has(media), 'media maydoni topilmadi');
      if (!has(media)) return;
      final center = t.getCenter(media.first);
      await t.tapAt(Offset(center.dx, screen.height * .42));
      await wait(const Duration(milliseconds: 1200));
      final clean = c.read(reelsCleanProvider);
      r.values['clean'] = clean;
      r.values['railHidden'] = chromeHidden('showcase-rail');
      r.values['infoHidden'] = chromeHidden('showcase-info');
      r.values['topbarHidden'] = topbarHidden();
      r.values['bottomNav'] = has(find.byType(NovaBottomNav));
      r.check(clean, 'toza rejim yoqilmadi');
      r.check(chromeHidden('showcase-rail'), 'amallar ustuni ko\'rinib turibdi');
      r.check(chromeHidden('showcase-info'), 'sarlavha/izoh ko\'rinib turibdi');
      r.check(topbarHidden(), 'tepa panel (sarlavha, +, 🔇) ko\'rinib turibdi');
      r.check(!has(find.byType(NovaBottomNav)), 'pastki menyu ko\'rinib turibdi');
      r.values['cleanShot'] = await screenshot('07_clean');
      await t.tapAt(Offset(center.dx, screen.height * .42));
      await wait(const Duration(milliseconds: 1200));
      r.check(!c.read(reelsCleanProvider), 'qayta bosilganda belgilar qaytmadi');
      r.check(!chromeHidden('showcase-rail'), 'amallar ustuni qaytmadi');
      r.check(has(find.byType(NovaBottomNav)), 'pastki menyu qaytmadi');
      final mu = page.post.music?.playUrl ?? '';
      if (mu.isNotEmpty) {
        final m = await playerState(spy.latest(mu));
        r.values['musicAfter'] = m;
        r.check(m['moving'] == true, 'toza rejimdan keyin musiqa to\'xtagan');
      }
    }, shot: '07b_restored');

    // h0. TASHXIS (h dan OLDIN — WebKit/WebView ham isitiladi): YouTube nazorat videosi ─────────────────────────────
    // Ilovaning AYNAN o'sha pleeri (`ShowcaseYoutubePlayer`, o'sha HTML,
    // o'sha WebView sozlamasi), lekin YouTube'ning o'zining namunaviy
    // videosi (IFrame API hujjatidagi `M7lc1UVf-VE`, joylashtirishga doim
    // ruxsat). U ham xato bersa — muhit (CI IP / WebView) sababi, ilova
    // emas. Faqat ma'lumot uchun (INFO), ilova kodi o'zgarmaydi.
    await step('h0', 'Tashxis: YouTube nazorat videosi shu pleerda', (r) async {
      final states = <String>[];
      final anchor = find.byType(ShowcasePage);
      if (!has(anchor)) {
        r.status = 'INFO';
        r.values['note'] = 'sahifa yo\'q';
        return;
      }
      final nav = Navigator.of(t.element(anchor.first), rootNavigator: true);
      unawaited(nav.push(MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          body: Center(
            child: SizedBox(
              width: 360,
              height: 640,
              child: ShowcaseYoutubePlayer(
                videoId: 'M7lc1UVf-VE',
                controller: ShowcaseYoutubeController(),
                onState: states.add,
              ),
            ),
          ),
        ),
      )));
      await waitFor(
          () => states.any((s) => s == 'playing' || s.startsWith('error')),
          timeout: const Duration(seconds: 25));
      await wait(const Duration(seconds: 2));
      r.values['controlStates'] = List.of(states);
      r.values['controlShot'] = await screenshot('08c_youtube_control');
      nav.pop();
      await wait(const Duration(seconds: 2));
      r.status = 'INFO';
    });

    // h. YOUTUBE ─────────────────────────────────────────────────────
    await step('h', 'YouTube "Videoni ko\'rish": butun ekran va o\'ynaydi',
        (r) async {
      final target = nearest((p) => youtubeVideoId(p.linkUrl) != null);
      r.check(target >= 0, 'lentada YouTube havolali sahifa yo\'q');
      if (target < 0) return;
      r.check(await goTo(target), 'YouTube sahifasiga surib bo\'lmadi');
      final page = visiblePage!.post;
      r.values['page'] = describe(page);
      final mu = page.music?.playUrl ?? '';
      if (mu.isNotEmpty) {
        r.values['musicBefore'] = await waitPlaying(mu,
            timeout: const Duration(seconds: 12));
      }
      final btn = inVisible(find.byKey(const ValueKey('showcase-video')));
      r.check(has(btn), '"Videoni ko\'rish" tugmasi yo\'q');
      if (!has(btn)) return;
      r.values['tap'] = await tapReal(btn);
      final opened = await waitFor(() => has(find.byType(ShowcaseVideoPage)),
          timeout: const Duration(seconds: 6));
      r.check(opened, 'ShowcaseVideoPage ochilmadi');
      if (!opened) return;
      await wait(const Duration(milliseconds: 800));
      final route = ModalRoute.of(t.element(find.byType(ShowcaseVideoPage)));
      r.values['route'] = route.runtimeType.toString();
      r.values['fullscreenDialog'] =
          route is PageRoute ? route.fullscreenDialog : null;
      r.check(route is PageRoute && route.opaque,
          'butun ekranli sahifa emas (${route.runtimeType})');
      r.check(route is! PopupRoute, 'bottom sheet / popup ochildi');
      final page0 = t.getRect(find.byType(ShowcaseVideoPage));
      r.values['pageRect'] =
          '${page0.width.toStringAsFixed(0)}x${page0.height.toStringAsFixed(0)} / '
          '${screen.width.toStringAsFixed(0)}x${screen.height.toStringAsFixed(0)}';
      r.check(page0.height >= screen.height - 1 && page0.width >= screen.width - 1,
          'sahifa butun ekranni egallamagan');
      final web = find.descendant(
          of: find.byType(ShowcaseVideoPage),
          matching: find.byType(WebViewWidget));
      // KUZATUV: sahifaning `post()` xabarlari (ready/playing/error:<kod>)
      // nusxasi `window.__e2e` ga ham yoziladi — ilovaga o'zgarishsiz
      // boradi. Zaxira panel chiqsa, sababini (xato kodini) bilish uchun.
      const hook = '(function(){if(window.__e2eHooked)return "already";'
          'window.__e2e=window.__e2e||[];var o=window.post;'
          'window.post=function(m){window.__e2e.push(m);'
          'try{console.log("E2E_YT:"+m)}catch(e){}return o(m)};'
          'window.__e2eHooked=1;return "hooked"})()';
      const probe = '(function(){try{return (window.__e2e||[]).join(",")+'
          '" | YT="+(typeof YT)+" st="+(window.player&&player.getPlayerState?'
          'player.getPlayerState():"-")}catch(e){return "x:"+e}})()';
      final ytLog = <String>[];
      if (await waitFor(() => has(web), timeout: const Duration(seconds: 5))) {
        ytLog.add('hook:${await js(web, hook)}');
      }
      // 'playing' kelganda pleer audio egaligini oladi.
      final sw = Stopwatch()..start();
      var lastProbe = '';
      final playing = await waitForAsync<bool>(() async {
        if (ownerType == '_ShowcaseVideoPageState') return true;
        if (has(find.byKey(const ValueKey('showcase-video-fallback')))) {
          return false;
        }
        if (has(web)) {
          final p = await js(web, probe);
          if (p != lastProbe) {
            lastProbe = p;
            ytLog.add('${sw.elapsedMilliseconds}ms $p');
          }
        }
        return null;
      }, timeout: const Duration(seconds: 20),
          every: const Duration(milliseconds: 150)) ?? false;
      r.values['ytEvents'] = ytLog;
      r.values['playingAfterMs'] = sw.elapsedMilliseconds;
      r.values['audioOwner'] = ownerType;
      final fallback = has(find.byKey(const ValueKey('showcase-video-fallback')));
      r.values['fallbackShown'] = fallback;
      r.check(playing && !fallback,
          'YouTube pleeri 20 s ichida "playing" bermadi'
          '${fallback ? ' (zaxira panel: video ochilmadi)' : ''}');
      if (has(web)) {
        const q = '(function(){try{return player.getPlayerState()+"|"+'
            'player.getCurrentTime().toFixed(2)}catch(e){return "x:"+e}})()';
        final a = await js(web, q);
        await wait(const Duration(seconds: 3));
        final b = await js(web, q);
        r.values['ytState'] = '$a -> $b';
        double tAt(String s) =>
            double.tryParse(s.split('|').length > 1 ? s.split('|')[1] : '') ?? -1;
        r.values['ytAdvanceS'] = (tAt(b) - tAt(a)).toStringAsFixed(2);
        r.check(b.startsWith('1|') && tAt(b) > tAt(a),
            'YouTube vaqti oldinga ketmayapti ($a -> $b)');
      }
      if (mu.isNotEmpty) {
        final m = await playerState(spy.latest(mu, alive: false),
            window: const Duration(seconds: 2));
        r.values['musicWhileOpen'] = m;
        r.check(m['still'] == true || m['disposed'] == true || m['player'] == null,
            'YouTube ochiq turganda ko\'rgazma musiqasi o\'ynayapti');
      }
      r.values['ytShot'] = await screenshot('08_youtube_fullscreen');
      await t.tap(find.byKey(const ValueKey('showcase-video-close')));
      final closed = await waitFor(() => !has(find.byType(ShowcaseVideoPage)),
          timeout: const Duration(seconds: 6));
      r.check(closed, '× sahifani yopmadi');
      if (mu.isNotEmpty) {
        final m = await waitPlaying(mu, timeout: const Duration(seconds: 12));
        r.values['musicAfterClose'] = m;
        r.check(m['moving'] == true, 'yopilgandan keyin musiqa davom etmadi');
      }
    }, shot: '08b_after_youtube');

    // i. INSTAGRAM ───────────────────────────────────────────────────
    await step('i', 'Instagram reel: butun ekranli sahifa', (r) async {
      final target = nearest((p) => instagramEmbedUri(p.linkUrl) != null &&
          youtubeVideoId(p.linkUrl) == null);
      r.check(target >= 0, 'lentada Instagram post/reel havolali sahifa yo\'q');
      if (target < 0) return;
      r.check(await goTo(target), 'Instagram sahifasiga surib bo\'lmadi');
      final page = visiblePage!.post;
      r.values['page'] = describe(page);
      final btn = inVisible(find.byKey(const ValueKey('showcase-instagram')));
      r.check(has(btn), '"Instagram\'da ko\'rish" tugmasi yo\'q');
      if (!has(btn)) return;
      r.values['tap'] = await tapReal(btn);
      final opened = await waitFor(() => has(find.byType(ShowcaseInstagramPage)),
          timeout: const Duration(seconds: 6));
      r.check(opened, 'ShowcaseInstagramPage ochilmadi');
      if (!opened) return;
      await wait(const Duration(milliseconds: 800));
      final route = ModalRoute.of(t.element(find.byType(ShowcaseInstagramPage)));
      r.values['route'] = route.runtimeType.toString();
      r.check(route is PageRoute && route.opaque && route is! PopupRoute,
          'butun ekranli sahifa emas (${route.runtimeType})');
      final web = find.descendant(
          of: find.byType(ShowcaseInstagramPage),
          matching: find.byType(WebViewWidget));
      String last = '';
      final loaded = await waitForAsync<String>(() async {
        if (has(find.byKey(const ValueKey('showcase-ig-fallback')))) {
          return 'fallback';
        }
        if (!has(web)) return null;
        last = await js(web,
            '(function(){return document.readyState+"|"+(document.body?document.body.innerText.length:0)+"|"+document.images.length+"|"+location.host})()');
        // Boshlang'ich `about:blank` emas — Instagram sahifasining o'zi.
        return last.startsWith('complete|') && last.contains('instagram')
            ? last
            : null;
      }, timeout: const Duration(seconds: 25));
      r.values['page_state'] = loaded ?? last;
      r.check(loaded != null && loaded != 'fallback',
          'Instagram embed yuklanmadi (${loaded ?? last})');
      if (mu(page).isNotEmpty) {
        final m = await playerState(spy.latest(mu(page), alive: false),
            window: const Duration(seconds: 2));
        r.values['musicWhileOpen'] = m;
        r.check(m['still'] == true || m['disposed'] == true || m['player'] == null,
            'Instagram ochiq turganda ko\'rgazma musiqasi o\'ynayapti');
      }
      await wait(const Duration(seconds: 3));
      r.values['igShot'] = await screenshot('09_instagram_fullscreen');
      await t.tap(find.byKey(const ValueKey('showcase-ig-close')));
      final closed = await waitFor(
          () => !has(find.byType(ShowcaseInstagramPage)),
          timeout: const Duration(seconds: 6));
      r.check(closed, '× sahifani yopmadi');
      if (mu(page).isNotEmpty) {
        final m = await waitPlaying(mu(page), timeout: const Duration(seconds: 12));
        r.values['musicAfterClose'] = m;
        r.check(m['moving'] == true, 'yopilgandan keyin musiqa davom etmadi');
      }
    }, shot: '10_after_instagram');

    _finish();
  }

  String mu(Post p) => p.music?.playUrl ?? '';

  void _finish() {
    final fail = _results.where((r) => r.status == 'FAIL').length;
    _log('E2E_ERRORS:${jsonEncode(_flutterErrors)}');
    _log('E2E_DONE:${_results.length} steps, $fail failed');
  }
}
