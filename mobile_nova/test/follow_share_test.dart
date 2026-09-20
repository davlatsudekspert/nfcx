import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/core/utils/sharing.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/engagement.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// TELEFON TESTIDAGI IKKI XATO.
///
///   1. "Kuzatish bosilmayabdi ishlamayabdi"
///   2. "har qandey profilga kirib ulashishni bosa qotib qolybdi"
///
/// Ikkalasi ham ildiz sababi bilan yopilgan. Bu testlar ESKI KOD
/// BILAN YIQILADI — pastda har birida qanday yiqilishi yozilgan.

/// Obuna chaqiruvlarini sanaydigan repozitoriy.
class _FollowRepo extends ProfileRepository {
  _FollowRepo({this.fail = false}) : super(ApiClient());

  final bool fail;
  final calls = <String>[];

  @override
  Future<Result<void>> follow(String code) async {
    calls.add('follow:$code');
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return const Ok(null);
  }

  @override
  Future<Result<void>> unfollow(String code) async {
    calls.add('unfollow:$code');
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return const Ok(null);
  }

  @override
  Future<Result<NfcId>> byCode(String code) async => Ok(
        NfcId(code: code, name: 'Begona Odam', primary: false),
      );
}

void main() {
  group('Ulashish — QOTIB QOLMAYDI', () {
    tearDown(() {
      shareInvokerOverride = null;
      shareTimeout = const Duration(seconds: 5);
    });

    test('platforma JAVOB BERMASA kutish to‘xtaydi va havola buferga tushadi',
        () async {
      // MANA MUAMMO. BlueStacks/emulyatorda `ACTION_SEND` ni qabul
      // qiladigan ilova bo'lmasa kanal javobni umuman qaytarmaydi:
      // istisno YO'Q, natija YO'Q. Eski kodda `await` shu yerda
      // abadiy osilib qolardi va test TIMEOUT bilan yiqilardi.
      shareInvokerOverride = (_, __) => Completer<void>().future;
      shareTimeout = const Duration(milliseconds: 80);

      String? clip;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          clip = (call.arguments as Map)['text'] as String?;
        }
        return null;
      });
      addTearDown(() => TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      final ok = await shareLink('https://nfcstore.uz/48210377')
          .timeout(const Duration(seconds: 3));

      expect(ok, isFalse, reason: 'oyna ochilmadi — `false` kutilgan');
      expect(clip, 'https://nfcstore.uz/48210377',
          reason: 'odam havolasiz qoldi');
    });

    test('platforma XATO qaytarsa ham havola buferga tushadi', () async {
      shareInvokerOverride = (_, __) async => throw MissingPluginException();

      String? clip;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          clip = (call.arguments as Map)['text'] as String?;
        }
        return null;
      });
      addTearDown(() => TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      expect(await shareLink('https://nfcstore.uz/x'), isFalse);
      expect(clip, 'https://nfcstore.uz/x');
    });

    test('oyna OCHILSA bufer band qilinmaydi', () async {
      var invoked = 0;
      shareInvokerOverride = (t, s) async => invoked++;

      var clipboardTouched = false;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') clipboardTouched = true;
        return null;
      });
      addTearDown(() => TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      expect(await shareLink('https://nfcstore.uz/y', title: 'Nom'), isTrue);
      expect(invoked, 1);
      expect(clipboardTouched, isFalse,
          reason: 'oyna ochilgan bo‘lsa buferga tegish shart emas');
    });

    test('bo‘sh manzil platformaga umuman ketmaydi', () async {
      var invoked = 0;
      shareInvokerOverride = (t, s) async => invoked++;
      expect(await shareLink('   '), isFalse);
      expect(await shareText(''), isFalse);
      expect(invoked, 0);
    });
  });

  group('Kuzatish tugmasi — BITTA tizim', () {
    test('holat OBUNA RO‘YXATIDAN o‘qiladi, tugma o‘zgaradi', () async {
      final repo = _FollowRepo();
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        profileRepositoryProvider.overrideWithValue(repo),
      ]);
      addTearDown(c.dispose);

      // Boshida obuna yo'q.
      expect(c.read(followingOfProvider('99999999')), isFalse);

      final err = await c
          .read(followOverridesProvider.notifier)
          .toggle('99999999', following: false);

      expect(err, isNull);
      expect(repo.calls, ['follow:99999999']);
      // MANA MUAMMO EDI: `ProfileFollow` degan ALOHIDA tizim bor
      // edi va profil tugmasi shu yerni o'qimasdi, yorlig'i esa
      // `l.actionFollow` deb qotib qo'yilgandi. Ya'ni bosilsa ham
      // hech narsa o'zgarmasdi — "bosilmayabdi" shundan.
      expect(c.read(followingOfProvider('99999999')), isTrue,
          reason: 'tugma bosildi, lekin holat o‘zgarmadi');
    });

    test('server XATO bersa holat ESKISIGA qaytadi', () async {
      final repo = _FollowRepo(fail: true);
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        profileRepositoryProvider.overrideWithValue(repo),
      ]);
      addTearDown(c.dispose);

      final err = await c
          .read(followOverridesProvider.notifier)
          .toggle('77777777', following: false);

      expect(err, isNotNull, reason: 'ekran xabar ko‘rsata olishi kerak');
      expect(c.read(followingOfProvider('77777777')), isFalse,
          reason: 'xato bo‘lsa ham "obuna bo‘ldingiz" deb turibdi');
    });

    testWidgets('BEGONA profilda tugma "Kuzatish" deb chiqadi va bosilgach '
        'yorlig‘i o‘zgaradi', (tester) async {
      final repo = _FollowRepo();
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          profileRepositoryProvider.overrideWithValue(repo),
        ],
        child: wrapScreen(const ProfileScreen(code: '99999999')),
      ));
      await settle(tester);

      final l = await L.delegate.load(const Locale('uz'));
      expect(find.text(l.actionFollow), findsOneWidget,
          reason: 'begona profilda kuzatish tugmasi yo‘q');

      await tester.tap(find.text(l.actionFollow));
      await settle(tester);

      expect(repo.calls, ['follow:99999999'],
          reason: 'tugma bosildi, lekin serverga so‘rov ketmadi');
      expect(find.text(l.actionFollowing), findsOneWidget,
          reason: 'yorliq "Kuzatilmoqda" ga o‘zgarmadi');
    });
  });
}
