import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/features/auth/session.dart';

import 'helpers.dart';

/// SESSIYA TUGAGANDA ILOVA KIRISH EKRANIGA QAYTADI.
///
/// ## NIMA UCHUN BU SINOV BOR
///
/// `ApiClient.sessionExpired` hisoblagichi BOR edi va 401 da o'sardi.
/// Lekin unga HECH KIM OBUNA BO'LMAGAN: butun `lib/` da yagona
/// boshqa chaqiruv `dispose()` edi. Izohda "router kirish ekraniga
/// oladi" deyilgan, router esa unga obuna bo'lmagan.
///
/// Ya'ni token eskirsa, ilova o'sha o'lik token bilan ishlayverardi
/// va foydalanuvchi kirish ekraniga qayta olmasdi. E2E buni
/// "PARTIAL — sessionExpired signali ishlamadi" deb ko'rsatgan edi.
void main() {
  test('401 signali sessiyani YOPADI', () async {
    final container = ProviderContainer(overrides: await testOverrides());
    addTearDown(container.dispose);

    // Kuzatuvchi tirik bo'lishi kerak — ilovada buni `NovaApp`
    // `ref.watch` bilan ushlab turadi.
    container.read(sessionExpiryWatcherProvider);
    await container.read(sessionProvider.notifier).restore();
    expect(container.read(sessionProvider), isA<SessionActive>(),
        reason: 'sinov kirgan holatdan boshlanishi kerak');

    // Tarmoq qatlami 401 ko'rdi.
    container.read(apiProvider).sessionExpired.value++;
    await Future<void>.delayed(Duration.zero);

    expect(container.read(sessionProvider), isA<SessionAnonymous>(),
        reason: 'signal chiqdi, lekin sessiya yopilmadi — router '
            'foydalanuvchini kirish ekraniga chiqara olmaydi');
  });

  group('401 — QAYSI yo\'lda sessiya yopiladi', () {
    test('KIRISH yo\'lidagi 401 sessiyani yopMAYDI', () {
      // `/api/auth/login` noto'g'ri parolda ham 401 qaytaradi. Buni
      // sessiya tugashi deb qabul qilsak, parolni bir marta xato
      // yozgan odam saqlangan sessiyasidan ham ayrilardi.
      final api = ApiClient();
      addTearDown(() {
        api.online.dispose();
        api.sessionExpired.dispose();
      });
      final before = api.sessionExpired.value;
      api.debugHandleStatus(401, '/api/auth/login');
      expect(api.sessionExpired.value, before,
          reason: 'kirish ekranidagi noto\'g\'ri parol sessiyani '
              'yopmasligi kerak');
    });

    test('403 sessiyani yopMAYDI', () {
      // 403 — "bu senga ruxsat yo'q", "kim ekaningni bilmayman"
      // emas. Foydalanuvchini chiqarib yuborish noto'g'ri bo'lardi.
      final api = ApiClient();
      addTearDown(() {
        api.online.dispose();
        api.sessionExpired.dispose();
      });
      final before = api.sessionExpired.value;
      api.debugHandleStatus(403, '/api/records/ABC123/analytics');
      expect(api.sessionExpired.value, before);
    });
  });
}
