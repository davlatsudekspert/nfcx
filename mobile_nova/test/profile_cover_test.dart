import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// PROFIL MUQOVASI.
///
/// Server `bgUrl` ni ANCHADAN BERI saqlaydi, model uni `coverUrl`
/// deb o'qiydi va profil ekrani chizadi ham. Yetishmagani bitta joy
/// edi: tahrir oynasida uni qo'yish yo'li yo'q edi, ya'ni odam o'z
/// profilining tepa qismini o'zgartira olmasdi.
class _SpyRepo extends ProfileRepository {
  _SpyRepo() : super(ApiClient());

  final saved = <Map<String, dynamic>>[];

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
    saved.add({'code': code, 'coverUrl': coverUrl, 'avatarUrl': avatarUrl});
    return const Ok(null);
  }
}

void main() {
  Future<_SpyRepo> pump(WidgetTester tester, {String cover = ''}) async {
    final spy = _SpyRepo();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        authRepositoryProvider.overrideWithValue(
          FakeAuthRepository(ids: [
            NfcId(
              code: '48210377',
              name: 'Test',
              primary: true,
              coverUrl: cover,
            ),
          ]),
        ),
        profileRepositoryProvider.overrideWithValue(spy),
      ],
      // Ekran saqlagandan keyin `context.pop()` chaqiradi, ya'ni
      // unga HAQIQIY GoRouter kerak. Yalang'och `MaterialApp` da
      // bu asinxron istisno bo'lib chiqadi va sinov o'sha yerda
      // yiqiladi — tekshiruvlarga yetib ham bormaydi.
      child: MaterialApp.router(
        routerConfig: GoRouter(
          initialLocation: '/edit',
          routes: [
            // Tahrir ekrani HAQIQATDA profil ustiga qo'yiladi va
            // saqlagandan keyin `pop()` bilan yopiladi. Ichma-ich
            // marshrut aynan shu stekni beradi — aks holda
            // "There is nothing to pop" chiqadi.
            GoRoute(
              path: '/',
              builder: (_, __) => const SizedBox.shrink(),
              routes: [
                GoRoute(
                    path: 'edit',
                    builder: (_, __) => const ProfileEditScreen()),
              ],
            ),
          ],
        ),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await settle(tester, frames: 20);
    return spy;
  }

  testWidgets('muqova tugmasi BOR', (tester) async {
    await pump(tester);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.profileCover), findsOneWidget,
        reason: 'muqova qo‘yish yo‘li umuman yo‘q');
  });

  testWidgets('serverdagi muqova ochilganda KO‘RINADI', (tester) async {
    await pump(tester, cover: 'https://nfcstore.uz/uploads/cover.jpg');
    // Muqova rasmi chizilgan bo'lishi kerak — yo'qsa tahrir oynasi
    // mavjud muqovani "yo'q" deb ko'rsatib, saqlashda o'chirib
    // yuborardi.
    expect(find.byType(Image), findsWidgets);
  });

  testWidgets('saqlaganda muqova SERVERGA ketadi', (tester) async {
    final spy = await pump(tester, cover: 'https://nfcstore.uz/uploads/c.jpg');
    final l = await L.delegate.load(const Locale('uz'));

    // NovaButton matnni o'zgartirmaydi — yorliq qanday bo'lsa
    // shunday chiziladi.
    final save = find.widgetWithText(NovaButton, l.actionSave);
    await tester.scrollUntilVisible(save, 200,
        scrollable: find.byType(Scrollable).first);
    // `scrollUntilVisible` tugma ekranga ENDIGINA kirgan payt
    // to'xtaydi — u pastki chekkada, qisman ko'rinadi va tegish
    // nishonga tushmaydi. `ensureVisible` uni to'liq ko'rinadigan
    // joyga keltiradi.
    await tester.ensureVisible(save);
    await settle(tester, frames: 8);
    await tester.tap(save);
    await settle(tester, frames: 20);

    // Saqlangandan keyin ekran `context.pop()` bilan yopiladi va
    // bu yalang'och `MaterialApp` da GoRouter topa olmaydi. Bizni
    // qiziqtirgani SO'ROV — u pop'dan OLDIN ketadi, shuning uchun
    // navigatsiya istisnosi tekshiruvga xalaqit bermaydi.
    expect(spy.saved, hasLength(1), reason: 'saqlash umuman ketmadi');
    expect(spy.saved.single['coverUrl'], isNotNull,
        reason: 'muqova saqlanmadi — tahrirdan keyin u YO‘QOLADI');
    expect('${spy.saved.single['coverUrl']}', contains('c.jpg'));
  });
}
