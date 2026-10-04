// NFCSTORE (mobile_nova) — STARTUP VA TAB TEZLIGI DIAGNOSTIKASI.
//
// Egasi (2026-10, build 304, iPhone): "ilova ochilganda va Asosiy <->
// Profil o'rtasida ba'zan sezilarli kechikish". Taxmin emas — o'lchov.
//
// PROFILE rejimi, haqiqiy server (nfcstore.uz), haqiqiy sinov hisobi.
// Faqat O'QIYDI: tab bosish va kutish. Layk/obuna/yozuv YO'Q.
//
// Har bosqich uchun millisekund:
//   * sovuq start (disk rasm keshi bo'sh) va iliq start (disk keshi bor,
//     xotira bo'sh — ilova yopilib qayta ochilgandek): birinchi kadr,
//     sessiya (/api/auth/me), Asosiy birinchi kadri, lenta/istorya/
//     katalog ma'lumoti, ko'rinadigan rasmlar;
//   * tab almashuvi: bosish -> yangi tab kadri (UI), o'sha kadrlar
//     qurish/chizish vaqti, ko'rinadigan rasmlar tayyor bo'lishi;
//   * har bir API so'rovi: boshlanish, davomiylik, holat, hajm,
//     takroriy so'rovlar;
//   * rasmlar: URL, ko'ringan -> dekodlangan vaqt, dekod o'lchami.
//
// Ilova kodi O'ZGARTIRILMAYDI — faqat `apiProvider` o'lchovchi Dio
// bilan almashtiriladi (xuddi o'sha `ApiClient`).

import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/media/image_cache.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';

const _login = String.fromEnvironment('NOVA_TEST_LOGIN');
const _password = String.fromEnvironment('NOVA_TEST_PASSWORD');
const _variant = String.fromEnvironment('PERF_VARIANT', defaultValue: '?');

final _clock = Stopwatch()..start();
double _now() => _clock.elapsedMicroseconds / 1000.0;
String _f(num v) => v.toStringAsFixed(0);

void _log(String s) {
  // ignore: avoid_print
  print('[DIAG][$_variant] $s');
}

/// Har bir API so'rovi — boshlanishi va davomiyligi.
class _Net extends Interceptor {
  final calls = <Map<String, dynamic>>[];
  double t0 = 0;

  @override
  void onRequest(RequestOptions o, RequestInterceptorHandler h) {
    o.extra['_t'] = _now();
    h.next(o);
  }

  void _done(RequestOptions o, int? status, Object? data) {
    final s = o.extra['_t'] as double? ?? _now();
    final q = o.queryParameters.isEmpty
        ? ''
        : '?${o.queryParameters.entries.map((e) => '${e.key}=${e.value}').join('&')}';
    calls.add({
      'path': '${o.method} ${o.path}$q',
      'start': s - t0,
      'ms': _now() - s,
      'status': status,
      'bytes': data is String ? data.length : (data?.toString().length ?? 0),
    });
  }

  @override
  void onResponse(Response r, ResponseInterceptorHandler h) {
    _done(r.requestOptions, r.statusCode, r.data);
    h.next(r);
  }

  @override
  void onError(DioException e, ErrorInterceptorHandler h) {
    _done(e.requestOptions, e.response?.statusCode ?? -1, null);
    h.next(e);
  }

  void reset(double at) {
    calls.clear();
    t0 = at;
  }

  void dump(String scene, {double until = 1e9}) {
    final list = calls.where((c) => (c['start'] as double) <= until).toList()
      ..sort((a, b) => (a['start'] as double).compareTo(b['start'] as double));
    final seen = <String, int>{};
    for (final c in list) {
      seen[c['path'] as String] = (seen[c['path'] as String] ?? 0) + 1;
    }
    for (final c in list) {
      final dup = seen[c['path']]! > 1 ? '  <-- TAKROR x${seen[c['path']]}' : '';
      _log('$scene api start=+${_f(c['start'] as double)}ms '
          'dur=${_f(c['ms'] as double)}ms st=${c['status']} '
          'size=${c['bytes']} ${c['path']}$dup');
    }
    _log('$scene api total=${list.length} '
        'unique=${seen.length}');
  }
}

/// Ekrandagi (onstage) rasmlar holati — URL, ko'ringan vaqt, dekod vaqti.
class _Images {
  final firstSeen = <String, double>{};
  final decoded = <String, double>{};
  final info = <String, String>{};

  void reset() {
    firstSeen.clear();
    decoded.clear();
    info.clear();
  }

  static String _key(ImageProvider p) {
    if (p is ResizeImage) return _key(p.imageProvider);
    if (p is CachedNetworkImageProvider) {
      return p.url.replaceFirst('https://nfcstore.uz', '');
    }
    if (p is NetworkImage) return p.url.replaceFirst('https://nfcstore.uz', '');
    if (p is AssetImage) return 'asset:${p.assetName}';
    if (p is ExactAssetImage) return 'asset:${p.assetName}';
    return p.runtimeType.toString();
  }

  /// Joriy ko'rinadigan rasmlar: (jami, tayyor).
  (int, int) scan(Size screen, double at) {
    var total = 0, ready = 0;
    final dpr = WidgetsBinding
        .instance.platformDispatcher.views.first.devicePixelRatio;
    for (final e in find.byType(RawImage).evaluate()) {
      final ro = e.renderObject;
      if (ro is! RenderBox || !ro.hasSize || !ro.attached) continue;
      final r = ro.localToGlobal(Offset.zero) & ro.size;
      if (r.bottom <= 0 || r.top >= screen.height || r.width < 4) continue;
      String? key;
      e.visitAncestorElements((a) {
        final w = a.widget;
        if (w is Image) {
          key = _key(w.image);
          return false;
        }
        return true;
      });
      if (key == null || key!.startsWith('asset:')) continue;
      total++;
      firstSeen.putIfAbsent(key!, () => at);
      final img = (e.widget as RawImage).image;
      if (img != null) {
        ready++;
        if (!decoded.containsKey(key)) {
          decoded[key!] = at;
          info[key!] = 'decoded=${img.width}x${img.height} '
              'box=${_f(r.width * dpr)}x${_f(r.height * dpr)}px';
        }
      }
    }
    return (total, ready);
  }

  void dump(String scene, double t0) {
    for (final k in firstSeen.keys) {
      final d = decoded[k];
      _log('$scene img seen=+${_f(firstSeen[k]! - t0)}ms '
          'ready=${d == null ? 'YO\'Q' : '+${_f(d - t0)}ms'} '
          '${info[k] ?? ''} $k');
    }
  }
}

/// Kadrlar (qurish/chizish) — vaqt oralig'i bo'yicha.
class _Frames {
  final list = <(double, FrameTiming)>[];
  void on(List<FrameTiming> t) {
    final at = _now();
    for (final f in t) {
      list.add((at, f));
    }
  }

  String summary(double from, double to) {
    final fs = list.where((e) => e.$1 >= from && e.$1 <= to + 250).map((e) => e.$2);
    double ms(Duration d) => d.inMicroseconds / 1000.0;
    final b = fs.map((f) => ms(f.buildDuration)).toList()..sort();
    final r = fs.map((f) => ms(f.rasterDuration)).toList()..sort();
    if (b.isEmpty) return 'frames=0';
    return 'frames=${b.length} build_max=${b.last.toStringAsFixed(1)} '
        'raster_max=${r.last.toStringAsFixed(1)} '
        'build_sum=${b.reduce((a, c) => a + c).toStringAsFixed(0)} '
        'janky(>16.7)=${fs.where((f) => ms(f.totalSpan) > 16.7).length} '
        'frozen(>100)=${fs.where((f) => ms(f.totalSpan) > 100).length}';
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  final net = _Net();
  final images = _Images();
  final frames = _Frames();
  final report = <String, dynamic>{};

  /// Birinchi kadrdan keyin shart bajarilguncha har kadrda tekshiradi.
  /// Natija — shart bajarilgan kadr tugagan vaqt (ms, `_now()`).
  Future<double?> untilFrame(bool Function() ok, {int timeoutMs = 20000}) {
    final c = Completer<double?>();
    final limit = _now() + timeoutMs;
    void check(Duration _) {
      if (c.isCompleted) return;
      if (ok()) {
        c.complete(_now());
      } else if (_now() > limit) {
        c.complete(null);
      } else {
        SchedulerBinding.instance.addPostFrameCallback(check);
        SchedulerBinding.instance.scheduleFrame();
      }
    }

    SchedulerBinding.instance.addPostFrameCallback(check);
    SchedulerBinding.instance.scheduleFrame();
    return c.future;
  }

  /// Ekrandagi rasmlar to'liq tayyor bo'lguncha (50 ms qadam).
  Future<double?> imagesReady(Size screen, {int timeoutMs = 15000}) async {
    final limit = _now() + timeoutMs;
    var stable = 0;
    double? at;
    while (_now() < limit) {
      final (total, ready) = images.scan(screen, _now());
      if (total > 0 && ready == total) {
        at ??= _now();
        // 3 ketma-ket tekshiruvda (150 ms) yangi rasm chiqmasa — tayyor.
        if (++stable >= 3) return at;
      } else {
        stable = 0;
        at = null;
      }
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
    return null;
  }

  bool onstage<T>() => find.byType(T).evaluate().isNotEmpty;

  testWidgets('startup va tab diagnostikasi', (t) async {
    if (_login.isEmpty || _password.isEmpty) {
      _log('SKIP: sinov hisobi yo\'q');
      return;
    }
    SchedulerBinding.instance.addTimingsCallback(frames.on);

    // Kirish — bir marta (server 15 daqiqada 5 kirishga ruxsat beradi).
    final loginApi = ApiClient();
    await SecureStore().clear();
    final res = await AuthRepository(loginApi)
        .loginWithPassword(email: _login, password: _password);
    expect(res is Ok, isTrue, reason: 'kirish');
    final me = (res as Ok).value;
    _log('hisob: ids? name=${me.name.isEmpty ? '(bo\'sh)' : 'bor'} '
        'avatar=${me.avatarUrl.isEmpty ? 'yo\'q' : 'bor'}');

    final screen = t.view.physicalSize / t.view.devicePixelRatio;
    final prefs = await Prefs.open();

    ProviderContainer? prev;
    Future<ProviderContainer> launch(String scene) async {
      // Yangi jarayon kabi: xotiradagi rasmlar yo'q, yangi HTTP ulanish.
      await t.pumpWidget(const SizedBox.shrink());
      prev?.dispose();
      PaintingBinding.instance.imageCache
        ..clear()
        ..clearLiveImages();
      await Future<void>.delayed(const Duration(milliseconds: 500));

      final container = ProviderContainer(overrides: [
        prefsProvider.overrideWithValue(prefs),
        apiProvider.overrideWith((ref) {
          final api = ApiClient(dio: Dio()..interceptors.add(net));
          ref.onDispose(() {
            api.online.dispose();
            api.sessionExpired.dispose();
          });
          return api;
        }),
      ]);
      double? tSession;
      container.listen<SessionState>(sessionProvider, (_, s) {
        if (s is SessionActive) tSession ??= _now();
      });
      final dataAt = <String, double>{};
      void watch(String name, ProviderListenable<AsyncValue<Object?>> p) {
        container.listen<AsyncValue<Object?>>(p, (_, v) {
          if (v.hasValue || v.hasError) {
            dataAt.putIfAbsent(name, () => _now());
          }
        });
      }

      images.reset();
      final t0 = _now();
      net.reset(t0);
      await t.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: const NovaApp(),
      ));
      final tFirst = _now();
      final tHome = await untilFrame(() => onstage<HomeScreen>());
      // Asosiy quriilgandan keyin uning provayderlari tirik — kuzatamiz.
      watch('feed', homeFeedProvider);
      watch('stories', homeStoriesProvider);
      watch('catalog', homeCatalogProvider);
      final tImg = await imagesReady(screen);
      // Ma'lumot kelishini kutamiz (16 s gacha).
      final limit = _now() + 16000;
      while (dataAt.length < 3 && _now() < limit) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
      await Future<void>.delayed(const Duration(milliseconds: 1500));

      String rel(double? v) => v == null ? 'YO\'Q' : '+${_f(v - t0)}ms';
      _log('$scene first_frame=${rel(tFirst)} session_active=${rel(tSession)} '
          'home_first_frame=${rel(tHome)} '
          'feed=${rel(dataAt['feed'])} stories=${rel(dataAt['stories'])} '
          'catalog=${rel(dataAt['catalog'])} home_images_ready=${rel(tImg)}');
      _log('$scene frames(0..home) ${frames.summary(t0, tHome ?? t0)}');
      _log('$scene frames(home..+3s) '
          '${frames.summary(tHome ?? t0, (tHome ?? t0) + 3000)}');
      net.dump(scene);
      images.dump(scene, t0);
      report[scene] = {
        'first_frame': tFirst - t0,
        'session': tSession == null ? null : tSession! - t0,
        'home': tHome == null ? null : tHome - t0,
        'feed': dataAt['feed'] == null ? null : dataAt['feed']! - t0,
        'images': tImg == null ? null : tImg - t0,
      };
      return prev = container;
    }

    // 1) SOVUQ: disk rasm keshi bo'sh (o'rnatilgandan keyingi birinchi).
    await NovaImageCache.manager.emptyCache();
    await launch('cold');
    // 2) ILIQ: disk keshi bor, xotira bo'sh — yopib qayta ochilgandek.
    await launch('warm1');
    final container = await launch('warm2');

    // 3) TAB ALMASHUVLARI (tayyor ilovada, 3 s tinch turgandan keyin).
    await Future<void>.delayed(const Duration(seconds: 3));
    Finder navIcon(IconData a, IconData? b) => find.descendant(
          of: find.byType(NovaBottomNav),
          matching: find.byWidgetPredicate(
              (w) => w is Icon && (w.icon == a || (b != null && w.icon == b))),
        );
    final tabs = {
      'home': (navIcon(Icons.home_outlined, Icons.home_rounded), () => onstage<HomeScreen>()),
      'discover': (navIcon(Icons.explore_outlined, Icons.explore_rounded), () => onstage<DiscoverScreen>()),
      'reels': (navIcon(Icons.play_circle_outline_rounded, Icons.play_circle_rounded), () => onstage<ReelsScreen>()),
      'profile': (navIcon(Icons.person_outline_rounded, Icons.person_rounded), () => onstage<ProfileScreen>()),
    };

    Future<void> go(String from, String to) async {
      final (finder, visible) = tabs[to]!;
      images.reset();
      final t0 = _now();
      net.reset(t0);
      await t.tap(finder.first, warnIfMissed: false);
      final tUi = await untilFrame(visible, timeoutMs: 5000);
      final tImg = to == 'reels' ? null : await imagesReady(screen, timeoutMs: 8000);
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      String rel(double? v) => v == null ? 'YO\'Q' : '+${_f(v - t0)}ms';
      final name = 'tab_${from}_to_$to';
      _log('$name tap->frame=${rel(tUi)} images_ready=${rel(tImg)} '
          '${frames.summary(t0, tUi ?? t0 + 500)}');
      net.dump(name, until: 3000);
      images.dump(name, t0);
      report[name] = {
        'ui': tUi == null ? null : tUi - t0,
        'images': tImg == null ? null : tImg - t0,
      };
    }

    for (final round in [1, 2]) {
      _log('--- tab round $round');
      await go('home', 'profile');
      await go('profile', 'home');
      await go('home', 'discover');
      await go('discover', 'profile');
      await go('profile', 'home');
    }
    // Reels oxirida: emulyator (swiftshader) video ochganda o'chib
    // qolishi mumkin — oldingi natijalar logda allaqachon bor.
    await go('home', 'reels');
    await go('reels', 'profile');
    await go('profile', 'home');

    container.dispose();
    binding.reportData = {'diag': report};
  });
}
