import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';

import 'helpers.dart';

/// PROFIL HERO STATUS BAR ORTIDAN BOSHLANADI (egasi, 2026-10, iPhone).
///
/// iPhone'da tepadagi xavfsiz hudud katta (59 pt). Ilgari tana
/// `SafeArea` + sarlavha qatori OSTIDAN boshlanardi: muqova pastdan
/// chiqib, ustida katta bo'sh (Ivory'da oq) zona qolar, Settings
/// tugmasi esa o'sha bo'sh zonada "uzilib" turardi.
///
/// Endi: muqova ekranning y=0 nuqtasidan, Settings tugmasi hero
/// USTIDA — xavfsiz hududdan 16 px pastda, o'ng chetdan 20 px ichkarida.
/// Matn va tugmalar status bar ostiga tushmaydi.
void main() {
  const topInset = 59.0;

  for (final theme in [
    ('Ivory', NfcTokens.ivory),
    ('Noir', NfcTokens.noir),
  ]) {
    testWidgets('${theme.$1}: hero tepadan, Settings hero ustida',
        (tester) async {
      tester.view.physicalSize = const Size(393 * 3, 852 * 3);
      tester.view.devicePixelRatio = 3;
      tester.view.padding = const FakeViewPadding(top: topInset * 3);
      tester.view.viewPadding = const FakeViewPadding(top: topInset * 3);
      addTearDown(tester.view.reset);

      final base = await testOverrides();
      await tester.pumpWidget(ProviderScope(
        overrides: base,
        child: wrapScreen(const ProfileScreen(), tokens: theme.$2),
      ));
      await settle(tester, frames: 12);
      expect(tester.takeException(), isNull);

      // 1) Hero fon (muqova/atmosfera) ekranning eng tepasidan.
      final hero = find.byType(ShaderMask).first;
      final heroRect = tester.getRect(hero);
      expect(heroRect.top, 0, reason: 'hero status bar ortidan boshlanmadi');
      expect(heroRect.bottom,
          greaterThan(topInset + 64),
          reason: 'hero tugmalar qatoridan pastgacha tushishi kerak');

      // 2) Settings — hero ustida, xavfsiz hududdan 16 px, o'ngdan 20 px.
      final settings = find.ancestor(
        of: find.byIcon(Icons.settings_outlined),
        matching: find.byType(NovaIconButton),
      );
      expect(settings, findsOneWidget);
      final s = tester.getRect(settings);
      expect(s.top, closeTo(topInset + 16, 2.5),
          reason: 'Settings xavfsiz hududdan keyin ~16 px bo‘lishi kerak');
      expect(393 - s.right, inInclusiveRange(16, 24),
          reason: 'Settings o‘ng chetdan 16–20 px ichkarida bo‘lishi kerak');
      expect(s.top, greaterThanOrEqualTo(heroRect.top));
      expect(s.bottom, lessThan(heroRect.bottom),
          reason: 'Settings hero ustida turishi kerak');

      // Settings — muqova ustidagi shisha doira (yarim shaffof, blur),
      // mavzu sirt rangida: Ivory'da iliq ivory, Noir'da to'q.
      expect(tester.widget<NovaIconButton>(settings).glass, isTrue);
      expect(find.descendant(of: settings, matching: find.byType(BackdropFilter)),
          findsOneWidget);
      final disc = tester.widget<Container>(find.descendant(
          of: settings, matching: find.byType(Container)).first);
      final fill = (disc.decoration! as BoxDecoration).color!;
      expect(fill.a, inExclusiveRange(.4, .9), reason: 'shisha emas');
      expect(fill.withValues(alpha: 1), theme.$2.surfaceSolid.withValues(alpha: 1));

      // 3) Kontent (ism va avatar) status bar ostiga tushmaydi.
      final firstText = find.descendant(
          of: find.byType(ProfileScreen), matching: find.byType(Text));
      for (final e in firstText.evaluate().take(3)) {
        final r = tester.getRect(find.byWidget(e.widget).first);
        expect(r.top, greaterThan(topInset),
            reason: 'matn status bar ostida qoldi');
      }
    });
  }
}
