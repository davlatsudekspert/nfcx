import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/home/widgets/mode_switch.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

double contrast(Color a, Color b) {
  final x = a.computeLuminance(), y = b.computeLuminance();
  return ((x > y ? x : y) + .05) / ((x < y ? x : y) + .05);
}

Widget themed(NfcTokens t, Widget child) => MaterialApp(
      theme: buildTheme(t),
      locale: const Locale('uz'),
      supportedLocales: L.supportedLocales,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(body: child),
    );

void main() {
  for (final t in NfcTokens.all) {
    test('${t.id}: control text remains readable', () {
      expect(contrast(t.onControl, t.controlFill), greaterThanOrEqualTo(4.5));
      if (t.isDark) {
        expect(t.controlFill, t.accent2);
        expect(t.controlFill, isNot(t.text1));
      } else {
        expect(t.controlFill, t.text1);
        expect(t.onControl, t.surfaceSolid);
      }
    });

    testWidgets('${t.id}: selection moves and uses theme colors', (tester) async {
      var mode = AppMode.personal;
      await tester.pumpWidget(themed(
        t,
        StatefulBuilder(builder: (context, setState) => Center(
          child: SizedBox(
            width: 320,
            child: ModeSwitch(
              mode: mode,
              onChanged: (value) => setState(() => mode = value),
            ),
          ),
        )),
      ));
      await tester.pumpAndSettle();
      final capsule = find.descendant(
        of: find.byType(ModeSwitch),
        matching: find.byType(AnimatedContainer),
      );
      expect((tester.widget<AnimatedContainer>(capsule).decoration as BoxDecoration).color,
          t.controlFill);
      expect(tester.widget<AnimatedAlign>(find.byType(AnimatedAlign)).alignment,
          Alignment.centerLeft);
      final l = L.of(tester.element(find.byType(ModeSwitch)));
      final selectedText = tester.element(find.text(l.modePersonal));
      expect(DefaultTextStyle.of(selectedText).style.color, t.onControl);
      await tester.tap(find.text(l.modeBusiness));
      await tester.pumpAndSettle();
      expect(mode, AppMode.business);
      expect(tester.widget<AnimatedAlign>(find.byType(AnimatedAlign)).alignment,
          Alignment.centerRight);
      expect(DefaultTextStyle.of(tester.element(find.text(l.modeBusiness))).style.color,
          t.onControl);
      expect(tester.takeException(), isNull);
    });

    testWidgets('${t.id}: filter and status capsules keep their colors', (tester) async {
      await tester.pumpWidget(themed(
        t,
        Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Capsule(label: 'Selected', selected: true),
          Capsule(label: 'Warning', selected: true, tone: t.warn),
        ])),
      ));
      await tester.pumpAndSettle();
      final selected = find.widgetWithText(Capsule, 'Selected');
      final decoration = tester.widget<AnimatedContainer>(find.descendant(
        of: selected, matching: find.byType(AnimatedContainer),
      )).decoration as BoxDecoration;
      expect(decoration.color, t.controlFill);
      expect(tester.widget<Text>(find.text('Selected')).style?.color, t.onControl);
      final warning = tester.widget<AnimatedContainer>(find.descendant(
        of: find.widgetWithText(Capsule, 'Warning'),
        matching: find.byType(AnimatedContainer),
      )).decoration as BoxDecoration;
      expect(warning.color, t.warn.withValues(alpha: t.isDark ? .13 : .18));
      expect(tester.takeException(), isNull);
    });

    testWidgets('${t.id}: active navigation icon uses matching ink', (tester) async {
      const activeIcon = Icons.home_rounded;
      await tester.pumpWidget(themed(
        t,
        const Align(
          alignment: Alignment.bottomCenter,
          child: NovaBottomNav(
            items: [
              NavItem(icon: Icons.home_outlined, activeIcon: activeIcon,
                  label: 'Asosiy', route: '/'),
              NavItem(icon: Icons.person_outline, label: 'Profil', route: '/profile'),
            ],
            centerIndex: -1,
            currentIndex: 0,
            onSelect: ignoreSelection,
          ),
        ),
      ));
      await tester.pumpAndSettle();
      final icon = tester.widget<Icon>(find.byIcon(activeIcon));
      expect(icon.color, t.onControl);
      final fills = tester.widgetList<AnimatedContainer>(
        find.byType(AnimatedContainer),
      ).map((w) => (w.decoration as BoxDecoration?)?.color);
      expect(fills, contains(t.controlFill));
      expect(tester.takeException(), isNull);
    });
  }
}

void ignoreSelection(int _) {}
