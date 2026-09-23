// ILOVA TEZLIGI — HAQIQIY HISOB, PROFILE REJIMI.
//
// Egasi (2026-09): "telefonda qotib sekin o'tyapti", "profil
// bo'limidan asosiy bo'limga o'tganda qotib qolyapti". Taxmin
// qilish o'rniga bu sinov har bir kadrning QURISH (UI thread) va
// CHIZISH (raster) vaqtini o'lchaydi.
//
// Faqat O'QIYDI: bosish — tab almashtirish va aylantirish. Layk,
// izoh, obuna va boshqa yozuvlar YO'Q.
//
// Ishga tushirish (profile rejimi SHART — debug o'lchovi yolg'on):
//
//   flutter drive --profile \
//     --driver=test_driver/perf_driver.dart \
//     --target=integration_perf/app_perf_test.dart \
//     --dart-define=NOVA_TEST_LOGIN=... --dart-define=NOVA_TEST_PASSWORD=...

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';

import '../integration_test/support/creds.dart';
import '../integration_test/support/net.dart';

/// Bitta ssenariy davomidagi kadrlar.
class _Recorder {
  final frames = <FrameTiming>[];
  void _on(List<FrameTiming> t) => frames.addAll(t);

  void start() {
    frames.clear();
    SchedulerBinding.instance.addTimingsCallback(_on);
  }

  Map<String, dynamic> stop() {
    SchedulerBinding.instance.removeTimingsCallback(_on);
    double ms(Duration d) => d.inMicroseconds / 1000.0;
    final build = frames.map((f) => ms(f.buildDuration)).toList()..sort();
    final raster = frames.map((f) => ms(f.rasterDuration)).toList()..sort();
    final total = frames.map((f) => ms(f.totalSpan)).toList()..sort();
    double pct(List<double> v, double p) =>
        v.isEmpty ? 0 : v[((v.length - 1) * p).round()];
    double avg(List<double> v) =>
        v.isEmpty ? 0 : v.reduce((a, b) => a + b) / v.length;
    String r(double v) => v.toStringAsFixed(1);
    return {
      'frames': frames.length,
      'build_avg': r(avg(build)),
      'build_p90': r(pct(build, .9)),
      'build_worst': r(build.isEmpty ? 0 : build.last),
      'raster_avg': r(avg(raster)),
      'raster_p90': r(pct(raster, .9)),
      'raster_worst': r(raster.isEmpty ? 0 : raster.last),
      'total_worst': r(total.isEmpty ? 0 : total.last),
      // 16.7 ms dan oshgan kadr — ko'zga ko'rinadigan qotish.
      'janky_build': build.where((v) => v > 16.7).length,
      'janky_raster': raster.where((v) => v > 16.7).length,
      // 100 ms dan oshgan kadr — "qotib qoldi" hissi.
      'frozen': total.where((v) => v > 100).length,
    };
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  // Kadrlarni dvigatel o'zi chizadi — haqiqiy telefondagi kabi.
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  final results = <String, dynamic>{};
  final rec = _Recorder();

  Future<void> wait(int ms) =>
      Future<void>.delayed(Duration(milliseconds: ms));

  Future<void> measure(String name, Future<void> Function() body) async {
    rec.start();
    await body();
    final r = rec.stop();
    results[name] = r;
    // ignore: avoid_print
    print('[PERF] $name ${r.entries.map((e) => '${e.key}=${e.value}').join(' ')}');
  }

  testWidgets('ilova tezligi — haqiqiy hisob', (t) async {
    if (!hasCreds) {
      // ignore: avoid_print
      print('[PERF] SKIP: sinov hisobi berilmagan');
      return;
    }
    final built = buildClient();
    await SecureStore().clear();
    await built.api.setToken(null);
    final res = await AuthRepository(built.api).loginWithPassword(
      email: kTestLogin,
      password: kTestPassword,
    );
    expect(res is Ok, isTrue, reason: 'kirish');

    final prefs = await Prefs.open();
    final container = ProviderContainer(
      overrides: [prefsProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);

    await measure('01_launch', () async {
      await t.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: const NovaApp(),
      ));
      await wait(8000);
    });

    final size = t.view.physicalSize / t.view.devicePixelRatio;
    final mid = Offset(size.width / 2, size.height * .55);

    Finder navIcon(IconData icon) => find.descendant(
          of: find.byType(NovaBottomNav),
          matching: find.byIcon(icon),
        );
    Future<void> tab(Finder f) async {
      await t.tap(f, warnIfMissed: false);
      await wait(1500);
    }

    final home = navIcon(Icons.home_rounded);
    final discover = navIcon(Icons.explore_rounded);
    final reels = navIcon(Icons.play_circle_rounded);
    final profile = navIcon(Icons.person_rounded);
    final nfc = find.descendant(
      of: find.byType(NovaBottomNav),
      matching: find.byType(BrandSeal),
    );
    expect(home, findsOneWidget, reason: 'pastki menyu ko\'rinmadi');

    Future<void> scroll({int times = 3}) async {
      for (var i = 0; i < times; i++) {
        await t.flingFrom(mid, const Offset(0, -500), 2200);
        await wait(900);
      }
      for (var i = 0; i < times; i++) {
        await t.flingFrom(mid, const Offset(0, 500), 2200);
        await wait(900);
      }
    }

    await measure('02_home_scroll', scroll);

    // BIRINCHI ochilish — ekran noldan quriladi.
    await measure('03_tab_profile_first', () => tab(profile));
    await measure('04_profile_scroll', scroll);
    // Egasining asosiy shikoyati.
    await measure('05_profile_to_home', () => tab(home));
    await measure('06_home_to_profile', () => tab(profile));
    await measure('07_profile_to_home_again', () => tab(home));

    await measure('08_tab_discover_first', () => tab(discover));
    await wait(3000);
    await measure('09_discover_scroll', scroll);
    await measure('10_tab_nfc_first', () => tab(nfc.first));
    await measure('11_tab_reels_first', () async {
      await tab(reels);
      await wait(2500);
    });
    await measure('12_reels_swipe', () async {
      await t.flingFrom(mid, const Offset(0, -600), 2500);
      await wait(2500);
    });
    await measure('13_reels_to_home', () => tab(home));
    await measure('14_home_to_discover', () => tab(discover));
    await measure('15_discover_to_profile', () => tab(profile));
    await measure('16_profile_to_home_final', () => tab(home));

    // Hammasi qo'shilgan umumiy son — solishtirish uchun.
    binding.reportData = {'perf': results};
  });
}

