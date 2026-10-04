import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/mode_switch.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// MAVZU RANGLARI IZCHIL (egasi, 2026-10, iPhone): Pudra'da "Shaxsiy"
/// to'q jigarrang, NFC tugmasi atirgul; Sakura'da pushti — ikki
/// palitra aralashib ko'rinardi. Faol boshqaruvlar matn siyohidan
/// (`text1`), NFC muhri va tugmalar aksentdan (`accent2`) olinardi.
///
/// Qoida: har mavzuda rejim almashtirgich, amal doiralari, faol tab,
/// chip va NFC muhri BITTA tokendan; mavzu almashganda oldingi
/// mavzuning rangi hech qayerda qolmaydi.
double _contrast(Color a, Color b) {
  final x = a.computeLuminance(), y = b.computeLuminance();
  return (max(x, y) + .05) / (min(x, y) + .05);
}

int _rgb(Color c) => c.toARGB32() & 0xFFFFFF;

/// Mavzuning barcha token ranglari (shaffofliksiz).
Set<int> _palette(NfcTokens t) => {
      for (final c in [
        t.bg1, t.bg2, t.bgVignette, t.surface, t.surface2, t.surfaceSolid,
        t.text1, t.text2, t.text3, t.accent1, t.accent2, t.accent3,
        t.goldDeep, t.accentB, t.accentBDark, t.accentC, t.accentCDark,
        t.accentD, t.accentDDark, t.glow, t.glowB, t.border1, t.border2,
        t.error, t.success, t.warn, t.ambient1, t.ambient2, t.brand,
        t.brandSoft, t.brandInk, t.onAccent, t.controlFill, t.onControl,
        t.labelInk,
        for (final s in [...t.shadowFloat, ...t.shadowSoft, ...t.shadowTiny])
          s.color,
      ])
        _rgb(c),
    };

void main() {
  group('tokenlar', () {
    for (final t in NfcTokens.all) {
      test('${t.id}: faol boshqaruv = mavzu aksenti, yozuvi o‘qiladi', () {
        expect(t.controlFill, t.accent2,
            reason: 'faol kapsula NFC muhri va tugmalar bilan bir rangda');
        expect(_contrast(t.onControl, t.controlFill), greaterThanOrEqualTo(4.5));
        expect(_contrast(t.controlFill, t.surfaceSolid), greaterThanOrEqualTo(1.5),
            reason: 'faol kapsula sirtdan ajralib turadi');
      });
    }

    test('Ivory va qorong‘i mavzular avvalgidek (o‘zgarmagan)', () {
      for (final t in NfcTokens.all) {
        final old = t.isDark ? t.accent2 : t.text1;
        final oldOn = t.isDark ? t.onAccent : t.surfaceSolid;
        if (t.isDark || t.id == 'ivory') {
          expect(t.controlFill, old, reason: t.id);
          expect(t.onControl, oldOn, reason: t.id);
        }
      }
    });

    test('Pudra va Sakura — ALOHIDA palitralar, bir rangga majburlanmagan', () {
      expect(NfcTokens.pudra.controlFill, isNot(NfcTokens.sakura.controlFill));
      expect(NfcTokens.pudra.controlFill, NfcTokens.pudra.accent2);
      expect(NfcTokens.sakura.controlFill, NfcTokens.sakura.accent2);
    });

    test('och aksent (Pearl champagne) — to‘la kapsula siyohda qoladi', () {
      final p = NfcTokens.pearl;
      expect(_contrast(p.accent2, p.surfaceSolid), lessThan(3));
      expect(p.controlFill, p.text1);
      expect(_contrast(p.onControl, p.controlFill), greaterThanOrEqualTo(4.5));
    });
  });

  group('ilovada mavzu almashuvi', () {
    Future<ProviderContainer> app(WidgetTester tester, NfcTokens first) async {
      VideoPlayerPlatform.instance = FakeVideoPlatform();
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(c.dispose);
      await c.read(themeProvider.notifier).select(first);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: const NovaApp(),
      ));
      await settle(tester, frames: 20);
      c.read(routerProvider).go(Routes.home);
      await settle(tester, frames: 20);
      expect(find.byType(HomeScreen), findsOneWidget);
      return c;
    }

    /// Ekranda chizilgan barcha bezak, ikonka va matn ranglari.
    List<Color> painted(WidgetTester tester) {
      final out = <Color>[];
      void deco(Decoration? d) {
        if (d is! BoxDecoration) return;
        if (d.color != null) out.add(d.color!);
        final b = d.border;
        if (b is Border) out.addAll([b.top.color, b.bottom.color]);
        final g = d.gradient;
        if (g != null) out.addAll(g.colors);
      }

      for (final e in find.byType(DecoratedBox).evaluate()) {
        deco((e.widget as DecoratedBox).decoration);
      }
      for (final e in find.byType(Icon).evaluate()) {
        final c = (e.widget as Icon).color;
        if (c != null) out.add(c);
      }
      for (final e in find.byType(RichText).evaluate()) {
        final c = (e.widget as RichText).text.style?.color;
        if (c != null) out.add(c);
      }
      return out;
    }

    /// Rejim almashtirgichning SURILADIGAN tanlov kapsulasi.
    Color pillOf(WidgetTester tester) => (tester
            .widget<DecoratedBox>(find
                .descendant(
                    of: find.descendant(
                        of: find.byType(ModeSwitch),
                        matching: find.byType(AnimatedAlign)),
                    matching: find.byType(DecoratedBox))
                .first)
            .decoration as BoxDecoration)
        .color!;

    Future<void> expectUsesTheme(WidgetTester tester, NfcTokens t) async {
      // Rejim almashtirgichdagi tanlangan "Shaxsiy".
      expect(pillOf(tester), t.controlFill,
          reason: '${t.id}: Shaxsiy kapsulasi');
      // Markaziy NFC tugmasi (pastki menyu muhri).
      final seal = tester.widget<BrandSeal>(find.descendant(
          of: find.byType(NovaBottomNav), matching: find.byType(BrandSeal)));
      expect(seal.ink, isTrue);
      final sealDeco = tester
          .widgetList<DecoratedBox>(find.descendant(
              of: find.byType(BrandSeal), matching: find.byType(DecoratedBox)))
          .map((d) => d.decoration as BoxDecoration)
          .first;
      expect(sealDeco.color, t.isDark ? t.surfaceSolid : t.accent2,
          reason: '${t.id}: NFC muhri');
      if (!t.isDark) {
        expect(sealDeco.color, t.controlFill,
            reason: '${t.id}: NFC muhri va Shaxsiy BIR rangda');
      }
      // Amal doiralari (4 ta tezkor amal).
      final circles = tester
          .widgetList<DecoratedBox>(find.byType(DecoratedBox))
          .map((d) => d.decoration)
          .whereType<BoxDecoration>()
          .where((d) => d.shape == BoxShape.circle && d.color == t.controlFill);
      expect(circles.length, greaterThanOrEqualTo(4),
          reason: '${t.id}: amal ikonka doiralari mavzu aksentida');
    }

    const pairs = [
      ('pudra', 'sakura'),
      ('sakura', 'pudra'),
      ('ivory', 'pudra'),
      ('noir', 'sakura'),
      ('pudra', 'ivory'),
      ('sakura', 'noir'),
      ('ocean', 'pudra'),
    ];
    for (final (from, to) in pairs) {
      testWidgets('$from -> $to: hamma accent yangi mavzudan, eski rang '
          'qolmaydi', (tester) async {
        final a = NfcTokens.byId(from), b = NfcTokens.byId(to);
        final c = await app(tester, a);
        await expectUsesTheme(tester, a);

        await c.read(themeProvider.notifier).select(b);
        await settle(tester, frames: 20);
        await expectUsesTheme(tester, b);

        // Oldingi mavzuga XOS rang (yangisida yo'q) ekranda qolmagan.
        final mine = _palette(b);
        // Sof qora/oq — barcha mavzulardagi neytral soya va surat
        // pardasi, mavzu aksenti emas.
        final stale = _palette(a).difference(mine)
          ..removeAll(const [0x000000, 0xFFFFFF]);
        final leftovers = painted(tester)
            .where((c) => stale.contains(_rgb(c)))
            .map((c) => '#${_rgb(c).toRadixString(16).padLeft(6, '0')}')
            .toSet();
        expect(leftovers, isEmpty,
            reason: '$from -> $to: eski mavzu rangi ekranda qoldi');
        expect(tester.takeException(), isNull);
      });
    }
  });
}
