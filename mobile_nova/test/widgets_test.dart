import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/design/widgets/fields.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/identity_card.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

void main() {
  group('BrandLogo', () {
    testWidgets('originalni cho‘zmaydi — har doim contain', (tester) async {
      await tester.pumpWidget(wrapScreen(const Center(child: BrandLogo())));
      final image = tester.widget<Image>(find.byType(Image).first);
      expect(image.fit, BoxFit.contain);
    });

    testWidgets('har mavzuda ham chiziladi va aktiv manzili o‘zgarmaydi',
        (tester) async {
      for (final t in NfcTokens.all) {
        await tester.pumpWidget(
          wrapScreen(const Center(child: BrandLogo()), tokens: t),
        );
        final image = tester.widget<Image>(find.byType(Image).first);
        expect((image.image as AssetImage).assetName, BrandLogo.assetLogo,
            reason: t.id);
      }
    });

    testWidgets('belgi ko‘rinishida shaffof PNG ishlatiladi', (tester) async {
      await tester.pumpWidget(wrapScreen(
        const Center(child: BrandLogo(style: BrandLogoStyle.mark)),
      ));
      final image = tester.widget<Image>(find.byType(Image).first);
      expect((image.image as AssetImage).assetName, BrandLogo.assetMark);
      // Balandlik berilmaydi — nisbat kenglikdan hisoblanadi.
      expect(image.height, isNull);
    });
  });

  group('NovaButton', () {
    testWidgets('bosilganda chaqiriladi', (tester) async {
      var taps = 0;
      await tester.pumpWidget(wrapScreen(
        Scaffold(
          body: NovaButton(label: 'Bosing', onPressed: () => taps++),
        ),
      ));
      await tester.tap(find.text('Bosing'));
      expect(taps, 1);
    });

    testWidgets('busy holatida bosilmaydi va aylanma ko‘rsatadi',
        (tester) async {
      var taps = 0;
      await tester.pumpWidget(wrapScreen(
        Scaffold(
          body: NovaButton(label: 'Bosing', busy: true, onPressed: () => taps++),
        ),
      ));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.text('Bosing'));
      expect(taps, 0);
    });

    testWidgets('onPressed null bo‘lsa o‘chirilgan', (tester) async {
      await tester.pumpWidget(wrapScreen(
        const Scaffold(body: NovaButton(label: 'Bosing')),
      ));
      final semantics = tester.getSemantics(find.byType(NovaButton));
      expect(semantics.hasFlag(SemanticsFlag.isEnabled), isFalse);
    });
  });

  group('CodeField', () {
    testWidgets('6 raqam kiritilganda natija qaytaradi', (tester) async {
      String? got;
      await tester.pumpWidget(wrapScreen(
        Scaffold(body: CodeField(onCompleted: (v) => got = v)),
      ));
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      expect(got, '123456');
    });

    testWidgets('kam raqamda hali chaqirilmaydi', (tester) async {
      String? got;
      await tester.pumpWidget(wrapScreen(
        Scaffold(body: CodeField(onCompleted: (v) => got = v)),
      ));
      await tester.enterText(find.byType(TextField), '123');
      await tester.pump();
      expect(got, isNull);
    });
  });

  group('IdentityCard', () {
    testWidgets('NFC kodini va statistikani ko‘rsatadi', (tester) async {
      await tester.pumpWidget(wrapScreen(
        const Scaffold(
          body: IdentityCard(
            user: testUser,
            id: NfcId(code: '48210377', name: 'Test', taps: 1200),
            mode: AppMode.personal,
          ),
        ),
      ));
      expect(find.text('48210377'), findsOneWidget);
      // 1200 → 1.2K
      expect(find.text('1.2K'), findsOneWidget);
    });

    testWidgets('ID bo‘lmasa chiziqcha ko‘rsatadi, qulamaydi', (tester) async {
      await tester.pumpWidget(wrapScreen(
        const Scaffold(
          body: IdentityCard(user: testUser, id: null, mode: AppMode.personal),
        ),
      ));
      expect(find.text('—'), findsOneWidget);
    });
  });

  group('Login ekrani', () {
    testWidgets('uch tilda ham sarlavhani ko‘rsatadi', (tester) async {
      for (final (code, expected) in [
        ('uz', 'Xush kelibsiz'),
        ('ru', 'С возвращением'),
        ('en', 'Welcome back'),
      ]) {
        await tester.pumpWidget(ProviderScope(
          overrides: await testOverrides(),
          child: wrapScreen(const LoginScreen(), locale: Locale(code)),
        ));
        await tester.pump();
        expect(find.text(expected), findsOneWidget, reason: code);
      }
    });

    testWidgets('bo‘sh email bilan yuborilganda xato ko‘rsatadi',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const LoginScreen()),
      ));
      await tester.pump();

      final l = LUz();
      await tester.tap(find.text(l.welcomeLogin));
      await tester.pump();
      expect(find.text(l.errRequired), findsWidgets);
    });

    testWidgets('kod rejimiga o‘tganda telefon maydoni chiqadi',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const LoginScreen()),
      ));
      await tester.pump();

      expect(find.byType(PhoneField), findsNothing);
      await tester.tap(find.text(LUz().loginUseCode));
      await tester.pump();
      expect(find.byType(PhoneField), findsOneWidget);
    });
  });

  group('Register ekrani', () {
    testWidgets('qadamma-qadam oldinga yuradi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const RegisterScreen()),
      ));
      await tester.pump();

      final l = LUz();
      // 1-qadam: ism.
      expect(find.text(l.registerStep(1, 4)), findsOneWidget);

      await tester.enterText(find.byType(TextField).first, 'Aziz Karimov');
      await tester.tap(find.text(l.actionNext));
      await settle(tester);
      expect(find.text(l.registerStep(2, 4)), findsOneWidget);
    });

    testWidgets('qisqa ism bilan oldinga o‘tkazmaydi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const RegisterScreen()),
      ));
      await tester.pump();

      final l = LUz();
      await tester.enterText(find.byType(TextField).first, 'A');
      await tester.tap(find.text(l.actionNext));
      await settle(tester);
      expect(find.text(l.registerStep(1, 4)), findsOneWidget);
      expect(find.text(l.errNameShort), findsOneWidget);
    });
  });

  group('Mavzu tanlash ekrani', () {
    testWidgets('beshta mavzuni ham ko‘rsatadi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const ThemeSettingsScreen()),
      ));
      await tester.pump();

      final l = LUz();
      for (final name in [
        l.themePearl,
        l.themeGraphite,
        l.themeOcean,
        l.themeAurora,
        l.themeMidnight,
      ]) {
        expect(find.text(name), findsOneWidget, reason: name);
      }
      // Har mavzu kartasida logotip — kontrast shu yerda tekshiriladi.
      expect(find.byType(BrandLogo), findsNWidgets(5));
    });
  });

  group('Til tanlash ekrani', () {
    testWidgets('har tilni o‘z tilida yozadi', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(const LanguageSettingsScreen()),
      ));
      await tester.pump();

      expect(find.text('O‘zbekcha'), findsOneWidget);
      expect(find.text('Русский'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
    });
  });
}
