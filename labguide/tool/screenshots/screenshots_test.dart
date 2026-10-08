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
