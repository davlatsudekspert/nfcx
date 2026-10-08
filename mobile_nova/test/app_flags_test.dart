import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app_flags.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/data/repositories/app_config_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

/// SERVER KALITLARI (`GET /api/app/config`, shartnoma §1).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<(ProviderContainer, FakeAppConfigRepository, Prefs)> make({
    Map<String, Object> stored = const {},
    AppFlags flags = const AppFlags(showcase: true),
    bool fail = false,
  }) async {
    SharedPreferences.setMockInitialValues(stored);
    final prefs = await Prefs.open();
    final repo = FakeAppConfigRepository(flags: flags, fail: fail);
    final c = ProviderContainer(overrides: [
      prefsProvider.overrideWithValue(prefs),
      appConfigRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(c.dispose);
    return (c, repo, prefs);
  }

  group('AppFlags.fromJson', () {
    test('shartnomadagi shakl o‘qiladi', () {
      final f = AppFlags.fromJson({
        'flags': {
          'reelsHidden': true,
          'videoUploadsBlocked': false,
          'videosHidden': true,
          'showcase': true,
        }
      });
      expect(f.reelsHidden, isTrue);
      expect(f.videoUploadsBlocked, isFalse);
      expect(f.videosHidden, isTrue);
      expect(f.showcase, isTrue);
    });

    test('yo‘q, null yoki buzuq qiymat — o‘chiq', () {
      final f = AppFlags.fromJson({
        'flags': {'reelsHidden': null, 'videosHidden': 'yes'}
      });
      expect(f, AppFlags.off);
      expect(AppFlags.fromJson(const {}), AppFlags.off);
      expect(AppFlags.tryDecode('{buzuq'), isNull);
    });
  });

  test('sukut bo‘yicha (kesh yo‘q) hammasi o‘chiq', () async {
    final (c, _, _) = await make();
    expect(c.read(appFlagsProvider), AppFlags.off);
  });

  test('muvaffaqiyatli javob holatga tushadi va keshga yoziladi', () async {
    const on = AppFlags(reelsHidden: true, videosHidden: true, showcase: true);
    final (c, repo, prefs) = await make(flags: on);
    await c.read(appFlagsProvider.notifier).refresh();
    expect(c.read(appFlagsProvider), on);
    expect(repo.calls, 1);
    expect(AppFlags.tryDecode(prefs.appFlagsJson), on);
  });

  test('keyingi ochilish keshdan boshlanadi', () async {
    const on = AppFlags(videoUploadsBlocked: true, showcase: true);
    final (c, _, _) = await make(
      stored: {'nova.appFlags': on.encode()},
      fail: true,
    );
    expect(c.read(appFlagsProvider), on);
    // Xato keshni buzmaydi.
    await c.read(appFlagsProvider.notifier).refresh();
    expect(c.read(appFlagsProvider), on);
  });

  test('xato va kesh yo‘q — hammasi o‘chiq', () async {
    final (c, repo, _) = await make(fail: true);
    await c.read(appFlagsProvider.notifier).refresh();
    expect(repo.calls, 1);
    expect(c.read(appFlagsProvider), AppFlags.off);
  });

  test('ochilishda va fondan qaytganda (≥60 s) so‘raladi', () async {
    var now = DateTime(2026, 10, 8, 12);
    appFlagsResumeClock = () => now;
    addTearDown(() => appFlagsResumeClock = DateTime.now);
    final (c, repo, _) = await make();
    c.listen(appFlagsWatcherProvider, (_, __) {});
    await Future<void>.delayed(Duration.zero);
    expect(repo.calls, 1, reason: 'ilova ochilganda');

    final binding = TestWidgetsFlutterBinding.instance;
    now = now.add(const Duration(seconds: 10));
    binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await Future<void>.delayed(Duration.zero);
    expect(repo.calls, 1, reason: '60 s o‘tmagan');

    now = now.add(const Duration(seconds: 61));
    binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await Future<void>.delayed(Duration.zero);
    expect(repo.calls, 2, reason: 'fondan qaytdi');
  });
}
