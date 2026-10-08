// Vizual tekshiruv uchun ekran rasmlari (CI testlariga kirmaydi).
//
//   flutter test tool/screenshots/screenshots_test.dart --update-goldens
//
// Natija: tool/screenshots/out/*.png (gitignore qilingan).
import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/app/app.dart';
import 'package:labguide/features/auth/ui/welcome_screen.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:material_ui/material_ui.dart';

import '../../test/helpers/harness.dart';

typedef Shot = ({
  String name,
  String route,
  AppLanguage lang,
  ThemeMode theme,
  AppRole role,
  Size size,
  bool onboarded,
  Future<void> Function(WidgetTester tester)? act,
});

Shot shot(
  String name,
  String route, {
  AppLanguage lang = AppLanguage.uz,
  ThemeMode theme = ThemeMode.light,
  AppRole role = AppRole.lab,
  Size size = const Size(390, 844),
  bool onboarded = true,
  Future<void> Function(WidgetTester tester)? act,
}) => (
  name: name,
  route: route,
  lang: lang,
  theme: theme,
  role: role,
  size: size,
  onboarded: onboarded,
  act: act,
);

Future<void> tapFirstText(WidgetTester tester, String text) async {
  await tester.tap(find.text(text).hitTestable().first);
  await tester.pumpAndSettle();
}

final shots = <Shot>[
  shot('01_welcome_light', '/welcome', onboarded: false),
  shot('02_welcome_dark', '/welcome', onboarded: false, theme: ThemeMode.dark),
  shot('03_role_select', '/welcome/role', onboarded: false),
  shot('04_home_doctor', '/home', role: AppRole.doctor),
  shot('05_home_lab', '/home'),
  shot('06_home_student', '/home', role: AppRole.student),
  shot(
    '07_home_teacher_dark',
    '/home',
    role: AppRole.teacher,
    theme: ThemeMode.dark,
  ),
  shot('08_tests_ru', '/tests', lang: AppLanguage.ru),
  shot(
    '09_tests_collapsed_ru',
    '/tests',
    lang: AppLanguage.ru,
    act: (t) async {
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, -320),
      );
      await t.pumpAndSettle();
    },
  ),
  shot(
    '10_glucose_en',
    '/tests/analyte/glucose-plasma-fasting',
    lang: AppLanguage.en,
  ),
  shot(
    '11_glucose_limits_dark',
    '/tests/analyte/glucose-plasma-fasting',
    theme: ThemeMode.dark,
    act: (t) async {
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, -1150),
      );
      await t.pumpAndSettle();
    },
  ),
  shot('12_alt_sourced', '/tests/analyte/alt'),
  shot('13_lab', '/lab'),
  shot(
    '14_calibration_nomatch',
    '/lab/calibration',
    act: (t) async {
      final fields = find.byType(TextField);
      await t.enterText(fields.at(0), 'BS-240');
      await t.enterText(fields.at(1), 'REF 105-001');
      await t.enterText(fields.at(2), 'v3.1');
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, -380),
      );
      await t.pumpAndSettle();
      await tapFirstText(t, 'Moslikni tekshirish');
    },
  ),
  shot(
    '15_dilution_result_ru',
    '/lab/calculators/dilution',
    lang: AppLanguage.ru,
    act: (t) async {
      await tapFirstText(t, 'Рассчитать');
    },
  ),
  shot(
    '16_quiz_answered_en',
    '/learn/quiz',
    lang: AppLanguage.en,
    act: (t) async {
      await tapFirstText(t, 'Laboratory calculations');
      await tapFirstText(t, 'C₁ + V₁ = C₂ + V₂');
    },
  ),
  shot('17_library', '/library'),
  shot(
    '18_profile_ru_dark',
    '/profile',
    lang: AppLanguage.ru,
    theme: ThemeMode.dark,
  ),
  shot(
    '19_home_320_ru',
    '/home',
    lang: AppLanguage.ru,
    size: const Size(320, 640),
  ),
  shot(
    '20_home_tablet',
    '/home',
    role: AppRole.doctor,
    size: const Size(820, 1180),
  ),
  shot('21_review_queue', '/library/review'),
  shot('22_classes_signin', '/learn/classes', role: AppRole.teacher),
  shot('23_calculators', '/lab/calculators'),
  shot(
    '24_egfr_result',
    '/lab/calculators/egfr',
    act: (t) async {
      final fields = find.byType(TextField);
      await t.enterText(fields.at(0), '97');
      await t.enterText(fields.at(1), '58');
      await tapFirstText(t, 'Ayol');
      await tapFirstText(t, 'Hisoblash');
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, -330),
      );
      await t.pumpAndSettle();
    },
  ),
  shot(
    '25_ldl_result_ru',
    '/lab/calculators/ldl',
    lang: AppLanguage.ru,
    act: (t) async {
      final fields = find.byType(TextField);
      await t.enterText(fields.at(0), '6,1');
      await t.enterText(fields.at(1), '1,2');
      await t.enterText(fields.at(2), '5,3');
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, -300),
      );
      await t.pumpAndSettle();
      await tapFirstText(t, 'Рассчитать');
    },
  ),
  shot('26_quiz_topics_en', '/learn/quiz', lang: AppLanguage.en),
  shot('27_creatinine_ru', '/tests/analyte/creatinine', lang: AppLanguage.ru),
  shot(
    // Kartaning to'liq uzunligi — butun mazmunni bir rasmda ko'rish uchun.
    '28_egfr_full_en_dark',
    '/tests/analyte/egfr',
    lang: AppLanguage.en,
    theme: ThemeMode.dark,
    size: const Size(390, 5200),
  ),
  shot(
    '30_qc_levey_jennings',
    '/lab/qc/new',
    size: const Size(390, 2400),
    act: (t) async {
      var f = find.byType(TextField);
      await t.enterText(f.at(0), 'Glyukoza');
      await t.enterText(f.at(1), 'mmol/L');
      await t.enterText(f.at(2), 'Past');
      await t.enterText(f.at(3), 'GL-2611');
      await t.enterText(f.at(4), '5.5');
      await t.enterText(f.at(5), '0.15');
      await t.enterText(f.at(6), 'Yuqori');
      await t.enterText(f.at(7), 'GH-2611');
      await t.enterText(f.at(8), '16.0');
      await t.enterText(f.at(9), '0.45');
      await tapFirstText(t, 'Saqlash');
      // Ko'rgazma uchun seriyalar: oxirgisi 2-2s bilan rad etiladi.
      for (final (a, b) in [
        ('5.52', '15.9'),
        ('5.41', '16.3'),
        ('5.60', '15.7'),
        ('5.47', '16.1'),
        ('5.58', '16.5'),
        ('5.66', '16.2'),
        ('5.83', '16.6'),
        ('5.87', '16.95'),
      ]) {
        f = find.byType(TextField);
        await t.enterText(f.at(0), a);
        await t.enterText(f.at(1), b);
        await t.ensureVisible(find.text('Seriyani saqlash'));
        await t.pumpAndSettle();
        await tapFirstText(t, 'Seriyani saqlash');
      }
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, 4000),
      );
      await t.pumpAndSettle();
    },
  ),
  shot(
    '31_preanalytics_ru',
    '/lab/preanalytics',
    lang: AppLanguage.ru,
    size: const Size(390, 3400),
  ),
  shot('32_library_books', '/library/books', size: const Size(390, 2600)),
  shot(
    '33_osmolality_unit_check_en',
    '/lab/calculators/osmolality',
    lang: AppLanguage.en,
    size: const Size(390, 1500),
    act: (t) async {
      final f = find.byType(TextField);
      await t.enterText(f.at(0), '140');
      await t.enterText(f.at(1), '90');
      await t.enterText(f.at(2), '5');
      await tapFirstText(t, 'Calculate');
    },
  ),
  shot(
    '34_anion_gap_partial_ru',
    '/lab/calculators/anion-gap',
    lang: AppLanguage.ru,
    size: const Size(390, 1700),
    act: (t) async {
      final f = find.byType(TextField);
      for (final (i, v) in ['140', '104', '24', '4', '24'].indexed) {
        await t.enterText(f.at(i), v);
      }
      await tapFirstText(t, 'Рассчитать');
    },
  ),
  shot(
    '35_glucose_si_limits_uz',
    '/tests/analyte/glucose-plasma-fasting',
    size: const Size(390, 3600),
  ),
  shot('36_home_landscape', '/home', size: const Size(844, 390)),
  shot(
    '37_search_cyrillic_uz',
    '/tests',
    act: (t) async {
      await t.enterText(find.byType(TextField).first, 'сийдик');
      await t.pumpAndSettle();
    },
  ),
  shot(
    '29_calc_sources_en',
    '/lab/calculators/hba1c',
    lang: AppLanguage.en,
    act: (t) async {
      await t.enterText(find.byType(TextField).first, '7.4');
      await tapFirstText(t, 'Calculate');
      await t.drag(
        find.byType(Scrollable).hitTestable().first,
        const Offset(0, -420),
      );
      await t.pumpAndSettle();
    },
  ),
];

void main() {
  setUpAll(loadAppFonts);

  for (final s in shots) {
    testWidgets(s.name, (tester) async {
      final services = await makeServices(
        tester,
        language: s.lang,
        themeMode: s.theme,
        role: s.role,
        onboarded: s.onboarded,
      );
      await pumpApp(tester, services, size: s.size);
      if (s.route != '/home' && s.route != '/welcome') {
        await goTo(tester, s.route);
      }
      // Dekorativ rasmni dekod qilish (testda real async kerak).
      await tester.runAsync(() async {
        final ctx = tester.element(find.byType(Scaffold).first);
        await precacheImage(kHeroImage, ctx);
      });
      await tester.pumpAndSettle();
      if (s.act != null) await s.act!(tester);
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(LabGuideApp),
        matchesGoldenFile('out/${s.name}.png'),
      );
    });
  }
}
