import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';

import 'helpers.dart';

/// Maxfiylik tugmasi HAQIQATDAN serverga boradimi va bildirishnoma
/// tanlovlari saqlanadimi.
///
/// Ilgari ikkalasi ham shunchaki `setState` edi: ekran yopilishi
/// bilan tanlov yo'qolardi, maxfiylik esa hech qachon serverga
/// yetib bormasdi.
class _SpyProfileRepository extends ProfileRepository {
  _SpyProfileRepository({this.fail = false}) : super(ApiClient());

  final bool fail;
  final calls = <Map<String, dynamic>>[];

  @override
  Future<Result<void>> updateProfile({
    required String code,
    String? name,
    String? bio,
    String? role,
    String? avatarUrl,
    String? coverUrl,
    List<String>? musicUrls,
    bool? hiddenFromDirectory,
    Map<String, dynamic>? links,
  }) async {
    calls.add({'code': code, 'hiddenFromDirectory': hiddenFromDirectory});
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return const Ok(null);
  }
}

void main() {
  Future<_SpyProfileRepository> pumpPrivacy(
    WidgetTester tester, {
    bool hidden = false,
    bool fail = false,
  }) async {
    final spy = _SpyProfileRepository(fail: fail);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(
          FakeAuthRepository(
            ids: [
              NfcId(
                code: '48210377',
                name: 'Test',
                primary: true,
                hiddenFromDirectory: hidden,
              ),
            ],
          ),
        ),
        profileRepositoryProvider.overrideWithValue(spy),
      ],
      child: wrapScreen(const PrivacySettingsScreen()),
    ));
    await settle(tester, frames: 20);
    return spy;
  }

  group('Maxfiylik — ommaviy profil tugmasi', () {
    testWidgets('server YASHIRILGAN desa, tugma o‘chiq turadi',
        (tester) async {
      await pumpPrivacy(tester, hidden: true);
      final sw = tester.widget<Switch>(find.byType(Switch));
      expect(sw.value, isFalse,
          reason: 'server hidden_from_directory=1 qaytardi, '
              'tugma esa yoqilgan ko‘rinyapti');
    });

    testWidgets('server KO‘RINADI desa, tugma yoniq turadi', (tester) async {
      await pumpPrivacy(tester, hidden: false);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
    });

    testWidgets('o‘chirilsa serverga hiddenFromDirectory=true ketadi',
        (tester) async {
      final spy = await pumpPrivacy(tester, hidden: false);
      await tester.tap(find.byType(Switch));
      await settle(tester, frames: 20);

      expect(spy.calls, hasLength(1), reason: 'serverga hech nima ketmadi');
      expect(spy.calls.single['hiddenFromDirectory'], isTrue);
      expect(spy.calls.single['code'], '48210377');
    });

    testWidgets('yoqilsa serverga hiddenFromDirectory=false ketadi',
        (tester) async {
      final spy = await pumpPrivacy(tester, hidden: true);
      await tester.tap(find.byType(Switch));
      await settle(tester, frames: 20);

      expect(spy.calls.single['hiddenFromDirectory'], isFalse);
    });

    testWidgets('xato bo‘lsa tugma JOYIGA QAYTADI va xabar chiqadi',
        (tester) async {
      await pumpPrivacy(tester, hidden: false, fail: true);
      await tester.tap(find.byType(Switch));
      await settle(tester, frames: 20);

      expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue,
          reason: 'saqlanmagan bo‘lsa-da tugma o‘chgan holda qoldi — '
              'foydalanuvchi profilim yashirindi deb o‘ylaydi');
      expect(find.byType(SnackBar), findsOneWidget);
    });

    testWidgets('bajarib bo‘lmaydigan "statistika" tugmasi OLIB TASHLANGAN',
        (tester) async {
      await pumpPrivacy(tester);
      expect(find.byType(Switch), findsOneWidget,
          reason: 'backend‘da mos ustun yo‘q tugma qaytib kelibdi');
    });
  });

  group('Bildirishnoma tanlovlari', () {
    testWidgets('o‘zgartirilsa QURILMADA saqlanadi', (tester) async {
      final overrides = await testOverrides();
      await tester.pumpWidget(ProviderScope(
        overrides: overrides,
        child: wrapScreen(const NotificationsSettingsScreen()),
      ));
      await settle(tester, frames: 20);

      final container = ProviderScope.containerOf(
          tester.element(find.byType(NotificationsSettingsScreen)));
      final prefs = container.read(prefsProvider);

      expect(prefs.notif('scan'), isTrue, reason: 'standart holat');
      await tester.tap(find.byType(Switch).first);
      await settle(tester, frames: 20);

      expect(prefs.notif('scan'), isFalse,
          reason: 'tugma bosildi, lekin hech qayerda saqlanmadi — '
              'ekrandan chiqib qaytilsa eski holatga qaytadi');
    });

    testWidgets('saqlangan qiymat bilan OCHILADI', (tester) async {
      final overrides = await testOverrides();
      final container = ProviderContainer(overrides: overrides);
      addTearDownContainer(container);
      await container.read(prefsProvider).setNotif('scan', false);

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapScreen(const NotificationsSettingsScreen()),
      ));
      await settle(tester, frames: 20);

      expect(tester.widget<Switch>(find.byType(Switch).first).value, isFalse);
    });
  });

  group('Ishlab-chiquvchi jargoni foydalanuvchiga ko‘rinmaydi', () {
    test('lib/ ichida BACKEND/CONFIG REQUIRED chaqirilmaydi', () {
      final bad = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        if (f.path.contains('l10n/gen')) continue;
        for (final line in const LineSplitter().convert(f.readAsStringSync())) {
          final code = line.trimLeft();
          if (code.startsWith('//')) continue;
          if (code.contains('devBackendRequired') ||
              code.contains('devConfigRequired')) {
            bad.add('${f.path}: $code');
          }
        }
      }
      expect(bad, isEmpty,
          reason: 'bu matnlar ekranda "BACKEND ENDPOINT REQUIRED" bo‘lib '
              'chiqadi — odam uchun bu buzuq ekran');
    });
  });

  _contractTests();
}

/// SERVER KONTRAKTI — model server YUBORADIGAN nomni o'qiydimi.
///
/// Bu sinov guruhi ayni shu loyihada bir necha bor takrorlangan
/// xato turini qo'riqlaydi: "server bir nom yuboradi, model boshqa
/// nomni qidiradi" — natijada maydon jimgina yo'qoladi.
void _contractTests() {
  group('Karta JSON kontrakti', () {
    test('profileType=business BIZNES bo‘lib o‘qiladi', () {
      final id = NfcId.fromJson(const {
        'code': 'ABC123',
        'name': 'Do‘kon',
        'profileType': 'business',
      });
      expect(id.kind, NfcIdKind.business,
          reason: 'server `profileType` yuboradi, `type` EMAS — '
              'biznes karta shaxsiy bo‘lib ko‘rinyapti');
    });

    test('profileType=expert SHAXSIY bo‘lib qoladi', () {
      final id = NfcId.fromJson(const {
        'code': 'ABC123',
        'profileType': 'expert',
      });
      expect(id.kind, NfcIdKind.personal);
    });

    test('hiddenFromDirectory o‘qiladi', () {
      expect(
        NfcId.fromJson(const {'code': 'A', 'hiddenFromDirectory': true})
            .hiddenFromDirectory,
        isTrue,
      );
      expect(
        NfcId.fromJson(const {'code': 'A'}).hiddenFromDirectory,
        isFalse,
        reason: 'maydon kelmasa profil OCHIQ deb hisoblanadi',
      );
    });
  });
}
