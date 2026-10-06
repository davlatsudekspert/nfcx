import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/media/image_prep.dart';
import 'package:nfcstore_nova/core/media/video_prep.dart' show videoPrepChannel;
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/premium/premium_iap_screen.dart'
    show kAppleManageSubscriptionsUrl;
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// AUDIT 2026-10-06 (4-qism): kichik tuzatishlar.

class _Auth extends FakeAuthRepository {
  _Auth(this.user, {super.ids});
  User user;
  int meCalls = 0;

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      Ok((user: user, ids: ids));

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async {
    meCalls++;
    return restore();
  }
}

/// `post` natijasini qo'lda beradigan ApiClient.
class _Api extends ApiClient {
  _Api(this.result);
  final Result<Object?> result;
  final paths = <String>[];

  @override
  Future<Result<T>> post<T>(String path, [Object? body]) async {
    paths.add(path);
    return switch (result) {
      Ok() => Ok(null as T),
      Err(:final error) => Err(error),
    };
  }
}

final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void main() {
  group('6. iPhone: hisob o‘chirishda Apple obunasi ogohlantirishi', () {
    Future<void> openDialog(WidgetTester tester, User user) async {
      tester.view.physicalSize = const Size(390, 2400) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(_Auth(user)),
      ]);
      addTearDown(c.dispose);
      c.read(sessionProvider);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child:
            wrapScreen(const SecuritySettingsScreen(), tokens: NfcTokens.ivory),
      ));
      await settle(tester, frames: 8);
      final l = await _uz();
      await tester.scrollUntilVisible(
          find.text(l.settingsDeleteAccount).last, 300,
          scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text(l.settingsDeleteAccount).last);
      await settle(tester, frames: 8);
    }

    final sub = User(
        id: 1,
        email: 'a@b.uz',
        premium: true,
        premiumUntil: DateTime.now().add(const Duration(days: 20)));

    testWidgets('faol obuna — matn va boshqarish tugmasi', (tester) async {
      final opened = <Uri>[];
      openLinkOverride = (u) async {
        opened.add(u);
        return true;
      };
      addTearDown(() => openLinkOverride = null);
      await openDialog(tester, sub);
      final l = await _uz();
      expect(find.text(l.deleteAccountAppleSub), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('delete-manage-sub')));
      await settle(tester, frames: 4);
      expect(opened.single.toString(), kAppleManageSubscriptionsUrl);
    }, variant: _ios);

    testWidgets('obunasiz / muddatsiz Premium — yo‘q', (tester) async {
      await openDialog(
          tester, const User(id: 1, email: 'a@b.uz', premium: true));
      expect(find.byKey(const ValueKey('delete-apple-sub')), findsNothing);
    }, variant: _ios);

    testWidgets('Android — yo‘q', (tester) async {
      await openDialog(tester, sub);
      expect(find.byKey(const ValueKey('delete-apple-sub')), findsNothing);
    });
  });

  group('8. fondan qaytganda sessiya yangilanadi (≥60 s)', () {
    testWidgets('60 s dan tez — yo‘q, keyin — bir marta', (tester) async {
      var now = DateTime(2026, 10, 6, 12);
      sessionResumeClock = () => now;
      addTearDown(() => sessionResumeClock = DateTime.now);
      final auth = _Auth(testUser);
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(auth),
      ]);
      addTearDown(c.dispose);
      c.listen(sessionResumeRefreshProvider, (_, __) {});
      c.read(sessionProvider);
      await tester.pump(const Duration(milliseconds: 20));
      expect(c.read(sessionProvider), isA<SessionActive>());

      now = now.add(const Duration(seconds: 30));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(milliseconds: 20));
      expect(auth.meCalls, 0);

      now = now.add(const Duration(seconds: 61));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(milliseconds: 20));
      expect(auth.meCalls, 1);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(milliseconds: 20));
      expect(auth.meCalls, 1, reason: 'darhol qayta — so‘ralmaydi');
    });

    test('NFC ekranlarida pastga tortib yangilash bor', () {
      final ids = File('lib/features/nfc/nfc_ids_screen.dart').readAsStringSync();
      expect(ids, contains("ValueKey('nfc-ids-refresh')"));
      final center =
          File('lib/features/nfc/nfc_center_screen.dart').readAsStringSync();
      expect(center, contains("ValueKey('nfc-center-refresh')"));
    });
  });

  test('9. bildirishnoma sozlamasi Android’da ham yo‘q (push yo‘q)', () {
    expect(showNotificationSettings, isFalse);
  });

  group('10. obuna 409', () {
    test('ALREADY_FOLLOWING — muvaffaqiyat', () async {
      final api = _Api(const Err(AppError(AppErrorKind.conflict,
          code: 'ALREADY_FOLLOWING', status: 409)));
      final r = await ProfileRepository(api).follow('ABC123');
      expect(r.isOk, isTrue);
    });

    test('CANNOT_FOLLOW_SELF — o‘z matni', () async {
      final api = _Api(const Err(AppError(AppErrorKind.conflict,
          code: 'CANNOT_FOLLOW_SELF', status: 409)));
      final r = await ProfileRepository(api).follow('ABC123');
      final l = await _uz();
      expect(describeError(l, r.errorOrNull!), l.errFollowSelf);
    });
  });

  group('11. yangi xato kalitlari', () {
    test('describeError', () async {
      for (final code in ['uz', 'ru', 'en']) {
        final l = await L.delegate.load(Locale(code));
        String d(String c, [Map<String, dynamic>? data]) => describeError(
            l, AppError(AppErrorKind.conflict, code: c, data: data));
        expect(d('limit_reached', {'limit': 30}), l.errLimitReachedN(30));
        expect(d('limit_reached'), l.errLimitReached);
        expect(d('bad_promotion_price'), l.errPromotionPrice);
        expect(d('demo_business'), l.errDemoBusiness);
        expect(d('required_fields'), l.errRequiredFields);
        expect(l.errLimitReachedN(30), contains('30'));
      }
    });

    test('chegirma narxi asosiy narxdan past — ilovada tekshiriladi', () {
      final src =
          File('lib/features/business/business_forms.dart').readAsStringSync();
      expect(src, contains('sale > 0 && sale >= price'));
      expect(src, contains('l.errPromotionPrice'));
    });
  });

  group('13. Android orqaga: avval Asosiy tab', () {
    testWidgets('Profil tabida orqaga — Asosiy, ilova yopilmaydi',
        (tester) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(c.dispose);
      await tester.pumpWidget(
          UncontrolledProviderScope(container: c, child: const NovaApp()));
      for (var i = 0; i < 30; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      final router = c.read(routerProvider);
      router.go(Routes.profile);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(router.routerDelegate.currentConfiguration.uri.path,
          Routes.profile);

      var exited = false;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform, (call) async {
        if (call.method == 'SystemNavigator.pop') exited = true;
        return null;
      });
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      await tester.binding.handlePopRoute();
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(router.routerDelegate.currentConfiguration.uri.path, Routes.home);
      expect(exited, isFalse);
    });
  });

  group('14. rasm: ikkinchi o‘tish va shaffof PNG', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    late Directory dir;
    setUp(() => dir = Directory.systemTemp.createTempSync('img_prep2'));
    tearDown(() {
      messenger.setMockMethodCallHandler(videoPrepChannel, null);
      dir.deleteSync(recursive: true);
    });
    String file(String name, int bytes) {
      final f = File('${dir.path}/$name')
        ..writeAsBytesSync(List.filled(bytes, 1));
      return f.path;
    }

    test('JPEG hali 700 KB dan katta — kichikroq qayta urinadi', () async {
      final calls = <Map>[];
      messenger.setMockMethodCallHandler(videoPrepChannel, (c) async {
        final a = c.arguments as Map;
        calls.add({'m': c.method, ...a});
        // 1-o'tish 900 KB, 2-o'tish 500 KB.
        final size = calls.length == 1 ? 900 * 1024 : 500 * 1024;
        File(a['out'] as String).writeAsBytesSync(List.filled(size, 2));
        return a['out'];
      });
      final out = await prepareImageForUpload(file('photo.jpg', 3 << 20));
      expect(calls.map((c) => c['m']), ['toJpeg', 'toJpeg']);
      expect(calls[1]['maxSide'], 1280);
      expect(calls[1]['quality'], 70);
      expect(File(out).lengthSync(), 500 * 1024);
      expect(File(calls[0]['out'] as String).existsSync(), isFalse,
          reason: 'oraliq fayl o‘chirildi');
    });

    test('shaffof PNG > 700 KB — PNG holida kichraytiriladi', () async {
      final calls = <String>[];
      messenger.setMockMethodCallHandler(videoPrepChannel, (c) async {
        calls.add(c.method);
        if (c.method == 'toJpeg') return null; // shaffof
        final a = c.arguments as Map;
        File(a['out'] as String).writeAsBytesSync(List.filled(300 * 1024, 3));
        return a['out'];
      });
      final out = await prepareImageForUpload(file('logo.png', 1200 * 1024));
      expect(calls, ['toJpeg', 'toPng']);
      expect(out, endsWith('.png'));
    });

    test('shaffof PNG, lekin 700 KB dan kichik — tegilmaydi', () async {
      final calls = <String>[];
      messenger.setMockMethodCallHandler(videoPrepChannel, (c) async {
        calls.add(c.method);
        return null;
      });
      final p = file('logo.png', 600 * 1024);
      expect(await prepareImageForUpload(p), p);
      expect(calls, ['toJpeg']);
    });

    test('muqova — chegara 20 MB, ikkinchi o‘tish yo‘q', () async {
      final calls = <String>[];
      messenger.setMockMethodCallHandler(videoPrepChannel, (c) async {
        calls.add(c.method);
        final a = c.arguments as Map;
        File(a['out'] as String).writeAsBytesSync(List.filled(900 * 1024, 2));
        return a['out'];
      });
      await prepareImageForUpload(file('cover.jpg', 3 << 20),
          maxSide: 2048, limitBytes: 20 * 1024 * 1024);
      expect(calls, ['toJpeg']);
    });
  });

  group('15. qo‘shiqlar chegaradan ortiq — ogohlantirish', () {
    testWidgets('6 ta qo‘shiq, chegara 5', (tester) async {
      tester.view.physicalSize = const Size(393 * 3, 2400 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final music = [for (var i = 0; i < 6; i++) '/uploads/m$i.mp3'];
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          authRepositoryProvider.overrideWithValue(_Auth(testUser, ids: [
            NfcId(code: '48210377', name: 'T', primary: true, musicUrls: music),
          ])),
        ],
        child: wrapScreen(const ProfileEditScreen()),
      ));
      await settle(tester, frames: 20);
      final section = find.byKey(const ValueKey('edit-section-music'));
      await tester.scrollUntilVisible(section, 300,
          scrollable: find.byType(Scrollable).first);
      await settle(tester, frames: 4);
      final l = await _uz();
      expect(find.text('6/5'), findsOneWidget);
      expect(find.text(l.profileMusicOverLimit(5)), findsOneWidget);
    });
  });
}
