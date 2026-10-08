import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

/// Har bir ekranni turli o'lcham/til/mavzu/shrift masshtabida ochib,
/// layout xatosi (RenderFlex overflow va h.k.) yo'qligini tekshiradi.
/// Ekran balandligi katta olinadi — ro'yxatning barcha elementlari
/// quriladi va tekshiriladi (dangasa ro'yxat yashirib qo'ymaydi).
const onboardingRoutes = ['/welcome', '/welcome/auth', '/welcome/role'];

const appRoutes = [
  '/home',
  '/tests',
  '/tests/analyte/glucose-plasma-fasting',
  '/tests/analyte/glucose-plasma-fasting/units',
  '/tests/analyte/bilirubin-direct',
  '/tests/analyte/urine-acr',
  '/tests/analyte/urine-chemistry',
  '/tests/analyte/egfr',
  '/tests/analyte/creatinine/quiz',
  '/lab',
  '/lab/calibration',
  '/lab/qc',
  '/lab/qc/new',
  '/lab/preanalytics',
  '/lab/instruments',
  '/lab/microscopy',
  '/lab/calculators',
  '/lab/calculators/dilution',
  '/lab/calculators/units',
  '/lab/calculators/egfr',
  '/lab/calculators/acr',
  '/lab/calculators/anion-gap',
  '/lab/calculators/calcium',
  '/lab/calculators/ldl',
  '/lab/calculators/osmolality',
  '/lab/calculators/hba1c',
  '/library',
  '/library/saved',
  '/library/packs',
  '/library/books',
  '/library/sources',
  '/library/research',
  '/library/review',
  '/learn',
  '/learn/quiz',
  '/learn/exam',
  '/learn/classes',
  '/learn/lesson',
  '/profile',
  '/profile/role',
  '/profile/purchase',
  '/profile/privacy',
  '/profile/auth',
  '/terms',
];

typedef Config = ({
  double width,
  double textScale,
  AppLanguage lang,
  ThemeMode theme,
});

List<Config> configs() {
  final out = <Config>[];
  for (final lang in AppLanguage.values) {
    for (final width in [320.0, 390.0, 430.0, 820.0]) {
      for (final scale in [1.0, 1.35]) {
        out.add((
          width: width,
          textScale: scale,
          lang: lang,
          theme: ThemeMode.light,
        ));
      }
    }
    // Eng og'ir holat: tor ekran + juda katta shrift.
    out.add((width: 320, textScale: 2.0, lang: lang, theme: ThemeMode.light));
    out.add((width: 390, textScale: 1.0, lang: lang, theme: ThemeMode.dark));
  }
  return out;
}

void main() {
  setUpAll(loadAppFonts);

  for (final c in configs()) {
    final name =
        '${c.lang.name} ${c.width.toInt()}px ×${c.textScale} ${c.theme.name}';

    testWidgets('no layout errors: $name', (tester) async {
      Future<void> visitAll(List<String> routes) async {
        for (final route in routes) {
          await goTo(tester, route);
          final error = tester.takeException();
          expect(error, isNull, reason: '$route → $error');
        }
      }

      final size = Size(c.width, 3200);
      // Onboarding ekranlari.
      final fresh = await makeServices(
        tester,
        language: c.lang,
        themeMode: c.theme,
        onboarded: false,
        role: null,
      );
      await pumpApp(tester, fresh, size: size, textScale: c.textScale);
      await visitAll(onboardingRoutes);
      // OTP ekrani (demo kod so'ralgan holat).
      await tester.runAsync(
        () => fresh.auth.requestCode('student@example.com'),
      );
      await visitAll(['/welcome/auth/otp']);
      await tester.pumpWidget(const SizedBox());

      // Asosiy ekranlar — har bir rolning bosh sahifasi bilan.
      final s = await makeServices(
        tester,
        language: c.lang,
        themeMode: c.theme,
      );
      await s.bookmarks.toggle('glucose-plasma-fasting');
      await pumpApp(tester, s, size: size, textScale: c.textScale);
      for (final role in AppRole.values) {
        await s.settings.setRole(role);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: 'home $role');
      }
      await visitAll(appRoutes);
    });
  }

  testWidgets('tab labels fit on one line at 320 px in every language', (
    tester,
  ) async {
    for (final lang in AppLanguage.values) {
      for (final scale in [1.0, 1.15, 2.0]) {
        final s = await makeServices(tester, language: lang);
        await pumpApp(tester, s, size: const Size(320, 640), textScale: scale);
        // Tab nomlari bir qatorda va qirqilmagan (fade qo'llanmagan).
        // Faqat tab nomlari bir qatorli va softWrap: false.
        final labels = find.byWidgetPredicate(
          (w) => w is Text && w.maxLines == 1 && w.softWrap == false,
        );
        expect(labels, findsNWidgets(5), reason: '$lang ×$scale');
        for (final e in labels.evaluate()) {
          final paragraph = e.renderObject! as RenderParagraph;
          final needed = paragraph.getMaxIntrinsicWidth(double.infinity);
          expect(
            needed,
            lessThanOrEqualTo(paragraph.size.width + 0.5),
            reason: '${(e.widget as Text).data} $lang ×$scale',
          );
          final style = (e.widget as Text).style!;
          expect(style.fontSize, greaterThanOrEqualTo(11));
        }
        await tester.pumpWidget(const SizedBox());
      }
    }
  });
}
