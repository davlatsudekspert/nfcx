import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';

import 'helpers.dart';

/// EKRAN KENGLIKLARI — RenderFlex overflow bo'lmasin.
///
/// ## NIMA UCHUN KERAK
///
/// Flutter overflow'ni ISTISNO sifatida beradi va u sinovda
/// `tester.takeException()` orqali ushlanadi. Ya'ni "sariq-qora
/// chiziq" ni ko'z bilan qidirish shart emas — uni sinov topadi.
///
/// Kengliklar ataylab shular:
///
///   320 — eng tor eski telefon (iPhone SE 1, arzon Android);
///   360 — eng keng tarqalgan Android;
///   390 — iPhone 13/14 sinfi;
///   430 — katta telefonlar (Pro Max).
///
/// Uzbek va rus tillari INGLIZCHADAN UZUNROQ: "Ro'yxatdan o'tish"
/// va "Зарегистрироваться" bir xil tugmada inglizcha "Sign up" dan
/// ikki barobar joy oladi. Shuning uchun uchala til ham tekshiriladi
/// — faqat inglizchada sinash overflow'ni yashirardi.
void main() {
  const widths = [320.0, 360.0, 390.0, 430.0];
  const locales = [Locale('uz'), Locale('ru'), Locale('en')];

  Future<void> check(
    WidgetTester tester,
    Widget screen,
    String name, {
    NfcTokens? tokens,
  }) async {
    for (final w in widths) {
      for (final loc in locales) {
        tester.view.physicalSize = Size(w * 3, 800 * 3);
        tester.view.devicePixelRatio = 3.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(ProviderScope(
          overrides: await testOverrides(),
          child: wrapScreen(screen, locale: loc, tokens: tokens),
        ));
        await tester.pump();

        final err = tester.takeException();
        expect(err, isNull,
            reason: '$name — ${w.toInt()}px / ${loc.languageCode}: $err');
      }
    }
  }

  testWidgets('Welcome — 320/360/390/430', (t) async {
    await check(t, const WelcomeScreen(), 'Welcome');
  });

  testWidgets('Login — 320/360/390/430', (t) async {
    await check(t, const LoginScreen(), 'Login');
  });

  testWidgets('Settings — 320/360/390/430', (t) async {
    await check(t, const SettingsScreen(), 'Settings');
  });

  // BIZNES TAHLILI bu yerda SINALMAYDI — sababi izohda.
  //
  // Ekran `businessStatsProvider` orqali tarmoqqa chiqadi va sinov
  // muhitida Dio taymeri osilib qoladi: `!timersPending`. Bu
  // JOYLASHUV xatosi EMAS, sinov uchun soxta tarmoq yo'qligi.
  //
  // Joylashuv xavfi ham past: yangi katakchalarning HAMMASI `Row`
  // ichida `Expanded` bilan o'ralgan, ya'ni overflow tuzilish
  // jihatidan mumkin emas — kirish ekranidagi muammo aynan
  // `Expanded`siz `Row` dan kelib chiqqandi.

  testWidgets('BARCHA MAVZULARDA ham tor ekran buzilmaydi', (t) async {
    // Mavzu faqat rangni emas, o'lchamlarni ham beradi
    // (`NfcTokens` ichida radius va oraliqlar bor), shuning uchun
    // bittasida sinash yetarli emas.
    for (final tok in NfcTokens.all) {
      t.view.physicalSize = const Size(320 * 3, 800 * 3);
      t.view.devicePixelRatio = 3.0;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);

      await t.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const LoginScreen(), tokens: tok),
      ));
      await t.pump();
      expect(t.takeException(), isNull, reason: 'mavzu: ${tok.id}');
    }
  });
}
