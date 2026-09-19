import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/design/widgets/fields.dart';
import 'package:nfcstore_nova/design/widgets/nfc_orb.dart';
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
        const Center(child: BrandLogo(style: BrandLogoStyle.markOnly)),
      ));
      final image = tester.widget<Image>(find.byType(Image).first);
      expect((image.image as AssetImage).assetName, BrandLogo.assetMark);
      // Balandlik berilmaydi — nisbat kenglikdan hisoblanadi.
      expect(image.height, isNull);
    });

    testWidgets('nishon dumaloq, oltin halqali va belgi bo‘yalmaydi',
        (tester) async {
      for (final t in NfcTokens.all) {
        await tester.pumpWidget(wrapScreen(
          const Center(child: BrandLogo(size: 48, style: BrandLogoStyle.badge)),
          tokens: t,
        ));
        final box = tester.widget<Container>(
          find.descendant(
            of: find.byType(BrandLogo),
            matching: find.byType(Container),
          ),
        );
        final dec = box.decoration! as BoxDecoration;
        expect(dec.shape, BoxShape.circle, reason: t.id);
        // Halqa bor va ingichka.
        expect(dec.border!.top.width, lessThanOrEqualTo(3.0), reason: t.id);
        // Nishon MAVZUGA BOG‘LIQ EMAS: halqa rangi hamma mavzuda bir xil.
        expect(dec.border!.top.color, const Color(0xFFD4B87C), reason: t.id);

        final image = tester.widget<Image>(find.byType(Image).first);
        expect((image.image as AssetImage).assetName, BrandLogo.assetMark,
            reason: t.id);
        // Belgi ORIGINAL oltinida qoladi — qayta bo‘yalmaydi.
        expect(image.color, isNull, reason: t.id);
      }
    });

    testWidgets('orb markazlarida plastina ISHLATILMAYDI', (tester) async {
      // Orb ichida plastina "doira ichida to‘rtburchak" hosil qiladi.
      // Bu test o‘sha xatoning qaytib kelishini ushlaydi.
      final src = File('lib/features/entry/welcome_screen.dart')
          .readAsStringSync() +
          File('lib/features/nfc/nfc_scan_screen.dart').readAsStringSync() +
          File('lib/features/nfc/nfc_center_screen.dart').readAsStringSync() +
          File('lib/features/home/home_screen.dart').readAsStringSync();
      for (final m in RegExp(r'NfcOrb\(').allMatches(src)) {
        final tail = src.substring(m.start, (m.start + 700).clamp(0, src.length));
        final end = tail.indexOf('\n        ),');
        final body = end == -1 ? tail : tail.substring(0, end);
        expect(body.contains('BrandLogoStyle.plate'), isFalse,
            reason: 'NfcOrb ichida plastina: $body');
      }
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
      expect(semantics.flagsCollection.isEnabled, isFalse);
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

  group('OrbitActions', () {
    Widget orbit({required bool reduce}) => wrapScreen(
          MediaQuery(
            data: MediaQueryData(disableAnimations: reduce),
            child: const Center(
              child: OrbitActions(
                size: 360,
                actions: [
                  OrbitAction(icon: Icons.badge_rounded, label: 'Bir'),
                  OrbitAction(icon: Icons.credit_card_rounded, label: 'Ikki'),
                  OrbitAction(icon: Icons.card_giftcard_rounded, label: 'Uch'),
                  OrbitAction(icon: Icons.shield_outlined, label: 'To‘rt'),
                ],
              ),
            ),
          ),
        );

    testWidgets('halqa sekin aylanadi — chiplar o‘rnidan siljiydi',
        (tester) async {
      await tester.pumpWidget(orbit(reduce: false));
      final before = tester.getCenter(find.text('Bir'));
      // 22s siklning chorakiga yaqini — sezilarli siljish.
      await tester.pump(const Duration(seconds: 5));
      final after = tester.getCenter(find.text('Bir'));
      expect((after - before).distance, greaterThan(40));
    });

    testWidgets('aylanishda yorliq TIK qoladi — burilmaydi', (tester) async {
      await tester.pumpWidget(orbit(reduce: false));
      // Burilgan matnning chegara to‘rtburchagi KATTALASHADI. O‘lcham
      // o‘zgarmasa — demak faqat ko‘chirish bo‘lgan, burish emas.
      final size = tester.getRect(find.text('Bir')).size;
      await tester.pump(const Duration(milliseconds: 2750)); // 45°
      expect(tester.getRect(find.text('Bir')).size, size);
      await tester.pump(const Duration(milliseconds: 2750)); // 90°
      expect(tester.getRect(find.text('Bir')).size, size);
    });

    testWidgets('harakatni kamaytirish yoqilsa — aylanish YO‘Q',
        (tester) async {
      await tester.pumpWidget(orbit(reduce: true));
      final before = tester.getCenter(find.text('Bir'));
      await tester.pump(const Duration(seconds: 7));
      expect(tester.getCenter(find.text('Bir')), before);
      // Takrorlanuvchi animatsiya qolmagani uchun sahna tinchiydi.
      await tester.pumpAndSettle();
    });

    testWidgets('chiplar orbit qutisidan chiqib ketmaydi', (tester) async {
      await tester.pumpWidget(orbit(reduce: true));
      final box = tester.getRect(find.byType(OrbitActions));
      for (final label in ['Bir', 'Ikki', 'Uch', 'To‘rt']) {
        final r = tester.getRect(find.text(label));
        expect(box.contains(r.topLeft), isTrue, reason: label);
        expect(box.contains(r.bottomRight), isTrue, reason: label);
      }
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
