import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// NFC apparati YO'Q qurilmani taqlid qiladi.
class _NoNfc extends NfcService {
  @override
  Future<NfcAvailability> check() async => NfcAvailability.unsupported;
}

void main() {
  group('sessiya', () {
    test('saqlangan token bilan tiklanadi', () async {
      final container = ProviderContainer(overrides: await testOverrides());
      addTearDown(container.dispose);

      // Tiklash asinxron — birinchi holat "tekshirilmoqda".
      expect(container.read(sessionProvider), isA<SessionRestoring>());
      await container.read(sessionProvider.notifier).restore();
      expect(container.read(sessionProvider), isA<SessionActive>());
      expect(container.read(currentUserProvider)?.email, testUser.email);
      expect(container.read(myIdsProvider), hasLength(1));
    });

    test('token bo‘lmasa anonim holatda qoladi', () async {
      final container = ProviderContainer(
        overrides: await testOverrides(signedIn: false),
      );
      addTearDown(container.dispose);

      await container.read(sessionProvider.notifier).restore();
      expect(container.read(sessionProvider), isA<SessionAnonymous>());
      expect(container.read(currentUserProvider), isNull);
    });

    test('chiqqanda foydalanuvchi tozalanadi', () async {
      final container = ProviderContainer(overrides: await testOverrides());
      addTearDown(container.dispose);

      await container.read(sessionProvider.notifier).restore();
      expect(container.read(currentUserProvider), isNotNull);

      await container.read(sessionProvider.notifier).logout();
      expect(container.read(sessionProvider), isA<SessionAnonymous>());
      expect(container.read(currentUserProvider), isNull);
    });
  });

  group('mavzu almashtirish', () {
    test('tanlov saqlanadi va qayta o‘qiladi', () async {
      final overrides = await testOverrides();
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);

      // Saqlangan tanlov yo'q — standart mavzu ko'rinadi.
      // Standart: `ivory` (soft editorial, egasining 2026-09 qarori).
      // `noir` va `ocean` o'chirilmadi — Sozlamalarda muqobil.
      expect(container.read(themeProvider).id, 'ivory');
      await container
          .read(themeProvider.notifier)
          .select(NfcTokens.mono);
      expect(container.read(themeProvider).id, 'mono');

      // Yangi konteyner — ya'ni "ilova qayta ochildi". Xotira emas,
      // SAQLANGAN qiymat o'qilishi kerak.
      final reopened = ProviderContainer(overrides: overrides);
      addTearDown(reopened.dispose);
      expect(reopened.read(themeProvider).id, 'mono');
    });
  });

  group('til almashtirish', () {
    test('tanlov saqlanadi va qayta o‘qiladi', () async {
      final overrides = await testOverrides();
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);

      expect(container.read(localeProvider).languageCode, 'uz');
      await container
          .read(localeProvider.notifier)
          .select(const Locale('ru'));
      expect(container.read(localeProvider).languageCode, 'ru');

      final reopened = ProviderContainer(overrides: overrides);
      addTearDown(reopened.dispose);
      expect(reopened.read(localeProvider).languageCode, 'ru');
    });
  });

  group('Shaxsiy ↔ Biznes', () {
    test('rejim saqlanadi', () async {
      final overrides = await testOverrides();
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);

      expect(container.read(modeProvider), AppMode.personal);
      await container.read(modeProvider.notifier).toggle();
      expect(container.read(modeProvider), AppMode.business);

      final reopened = ProviderContainer(overrides: overrides);
      addTearDown(reopened.dispose);
      expect(reopened.read(modeProvider), AppMode.business);
    });

    test('faol ID — TANLANGAN ID (rejimdan qat’i nazar)', () async {
      // Ilgari biznes rejimida `kind == business` yozuvi olinardi va
      // tanlangan ID e'tiborsiz qolardi (egasi, 2026-09: "ID
      // almashmayapti"). Endi yagona manba — `activePersonalProvider`.
      final container = ProviderContainer(overrides: [
        ...await testOverrides(),
        myIdsProvider.overrideWithValue(const [
          NfcId(code: 'PERSONAL', primary: true),
          NfcId(code: 'IKKINCHI'),
        ]),
      ]);
      addTearDown(container.dispose);

      expect(container.read(activeIdProvider)?.code, 'PERSONAL');
      container.read(selectedPersonalCodeProvider.notifier).state = 'IKKINCHI';
      expect(container.read(activeIdProvider)?.code, 'IKKINCHI');
      await container.read(modeProvider.notifier).set(AppMode.business);
      expect(container.read(activeIdProvider)?.code, 'IKKINCHI');
    });

    test('mos ID bo‘lmasa asosiy ID qaytadi', () async {
      final container = ProviderContainer(overrides: [
        ...await testOverrides(),
        // Faqat shaxsiy ID bor.
        myIdsProvider.overrideWithValue(const [
          NfcId(code: 'PERSONAL', primary: true),
        ]),
      ]);
      addTearDown(container.dispose);

      await container.read(modeProvider.notifier).set(AppMode.business);
      expect(container.read(activeIdProvider)?.code, 'PERSONAL');
    });
  });

  group('Home ekrani', () {
    testWidgets('foydalanuvchi ismi va NFC kodini ko‘rsatadi', (tester) async {
      final overrides = await testOverrides();
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);
      await container.read(sessionProvider.notifier).restore();

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapScreen(const HomeScreen()),
      ));
      await settle(tester);

      // Ism ikki joyda: salomlashuv sarlavhasida va identity kartada.
      expect(find.text(testUser.displayName), findsWidgets);
      expect(find.text(testIds.first.code), findsOneWidget);
    });

    testWidgets('rejim almashtirgich ikkala yorliqni ko‘rsatadi',
        (tester) async {
      final container = ProviderContainer(overrides: await testOverrides());
      addTearDown(container.dispose);
      await container.read(sessionProvider.notifier).restore();

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapScreen(const HomeScreen()),
      ));
      await settle(tester);

      final l = LUz();
      expect(find.text(l.modePersonal), findsWidgets);
      expect(find.text(l.modeBusiness), findsWidgets);
    });
  });

  group('NFC qo‘llab-quvvatlanmaydigan qurilma', () {
    testWidgets('holatni ochiq ko‘rsatadi, soxta skanerlash yo‘q',
        (tester) async {
      final container = ProviderContainer(overrides: [
        ...await testOverrides(),
        nfcServiceProvider.overrideWithValue(_NoNfc()),
      ]);
      addTearDown(container.dispose);
      await container.read(sessionProvider.notifier).restore();

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapScreen(const NfcCenterScreen()),
      ));
      await settle(tester);

      expect(find.text(LUz().nfcUnsupported), findsOneWidget);
    });
  });

  group('tarmoq qatlami', () {
    test('tarmoq yo‘qligida Err qaytaradi, istisno OTMAYDI', () async {
      // Mavjud bo'lmagan xost — so'rov albatta muvaffaqiyatsiz.
      final api = ApiClient(baseUrl: 'http://127.0.0.1:1');
      addTearDown(() {
        api.online.dispose();
        api.sessionExpired.dispose();
      });

      final res = await api.get<Map<String, dynamic>>('/api/health');
      expect(res, isA<Err<Map<String, dynamic>>>());
      expect(res.errorOrNull, isNotNull);
      // Ekran uchun eng muhimi: foydalanuvchiga ko'rsatish mumkin
      // bo'lgan aniq sabab.
      expect(res.errorOrNull!.technical, isNotEmpty);
    });
  });
}
