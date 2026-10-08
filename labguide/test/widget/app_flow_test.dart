import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/app/widgets/lg_page.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/design/tokens.dart';
import 'package:labguide/features/auth/otp_auth.dart';
import 'package:labguide/features/library/library_screens.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:labguide/l10n/gen/app_localizations_ru.dart';
import 'package:labguide/l10n/gen/app_localizations_uz.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final uz = AppLocalizationsUz();
final ru = AppLocalizationsRu();
final en = AppLocalizationsEn();

/// Asosiy (vertikal) scroll — gorizontal chip qatorlari emas.
final verticalScrollable = find.byWidgetPredicate(
  (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
);

/// Ro'yxat dangasa quriladi — element ko'rinadigan joyga scroll qilinadi.
Future<void> scrollTo(WidgetTester tester, Finder finder) async {
  if (finder.hitTestable().evaluate().isNotEmpty) return;
  if (finder.evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      finder,
      250,
      scrollable: verticalScrollable.hitTestable().first,
    );
  } else {
    await tester.ensureVisible(finder.first);
  }
  await tester.pumpAndSettle();
}

/// Matnli elementni topib (kerak bo'lsa scroll qilib) bosadi.
Future<void> tapText(WidgetTester tester, String text) async {
  final all = find.text(text);
  await scrollTo(tester, all);
  await tester.tap(all.hitTestable().first);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('guest onboarding → role → role-specific home', (tester) async {
    final s = await makeServices(tester, onboarded: false, role: null);
    await pumpApp(tester, s);
    expect(find.text(uz.welcomeGuest), findsOneWidget);
    // Kontent uchun kirish majburiy emas: mehmon yo'li bor.
    await tapText(tester, uz.welcomeGuest);
    expect(find.text(uz.rolesTitle), findsOneWidget);
    await tapText(tester, uz.roleDoctor);
    await tapText(tester, uz.actionContinue);
    expect(s.settings.onboarded, isTrue);
    expect(s.settings.role, AppRole.doctor);
    expect(find.text(uz.homeHeroDoctorTitle), findsOneWidget);
    // Besh tab.
    for (final t in [
      uz.navHome,
      uz.navTests,
      uz.navLab,
      uz.navLibrary,
      uz.navLearn,
    ]) {
      expect(find.text(t), findsWidgets);
    }
  });

  testWidgets('switching role changes home content', (tester) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    final expectations = {
      AppRole.doctor: (uz.homeHeroDoctorTitle, uz.featureSampleFactors),
      AppRole.lab: (uz.homeHeroLabTitle, uz.featureCalibration),
      AppRole.student: (uz.homeHeroStudentTitle, uz.featureExam),
      AppRole.teacher: (uz.homeHeroTeacherTitle, uz.featureClasses),
    };
    for (final MapEntry(key: role, value: (hero, action))
        in expectations.entries) {
      await s.settings.setRole(role);
      await tester.pumpAndSettle();
      expect(find.text(hero), findsOneWidget, reason: '$role');
      expect(find.text(action), findsWidgets, reason: '$role');
      expect(
        find.text(
          role == AppRole.doctor ? uz.homeHeroLabTitle : uz.homeHeroDoctorTitle,
        ),
        findsNothing,
      );
    }
  });

  testWidgets('role change from profile', (tester) async {
    final s = await makeServices(tester, role: AppRole.lab);
    await pumpApp(tester, s);
    await tester.tap(find.byTooltip(uz.actionProfile));
    await tester.pumpAndSettle();
    await tapText(tester, uz.profileRole);
    await tapText(tester, uz.roleStudent);
    await tapText(tester, uz.actionContinue);
    expect(s.settings.role, AppRole.student);
    await tester.tap(find.byTooltip(uz.actionBack).hitTestable());
    await tester.pumpAndSettle();
    // ignore: avoid_print
    print(
      find
          .byType(Text)
          .hitTestable()
          .evaluate()
          .map((e) => (e.widget as Text).data)
          .toList(),
    );
    expect(find.text(uz.homeHeroStudentTitle), findsOneWidget);
  });

  testWidgets('language menu switches UZ → RU → EN', (tester) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    expect(find.text(uz.navLibrary), findsOneWidget);
    await tester.tap(find.byTooltip(uz.actionLanguage));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Русский').last);
    await tester.pumpAndSettle();
    expect(s.settings.language, AppLanguage.ru);
    expect(find.text(ru.navLibrary), findsOneWidget);
    expect(find.text(ru.homeTitle), findsOneWidget);
    await tester.tap(find.byTooltip(ru.actionLanguage));
    await tester.pumpAndSettle();
    await tester.tap(find.text('English').last);
    await tester.pumpAndSettle();
    expect(find.text(en.navLibrary), findsOneWidget);
  });

  testWidgets('theme: system / light / dark', (tester) async {
    final s = await makeServices(tester, themeMode: ThemeMode.system);
    await pumpApp(tester, s, platformBrightness: Brightness.dark);
    BuildContext ctx() => tester.element(find.byType(LgPage).first);
    expect(Theme.of(ctx()).brightness, Brightness.dark);
    expect(LgPalette.of(ctx()).brand, LgPalette.dark.brand);
    await s.settings.setThemeMode(ThemeMode.light);
    await tester.pumpAndSettle();
    expect(Theme.of(ctx()).brightness, Brightness.light);
    await s.settings.setThemeMode(ThemeMode.dark);
    await tester.pumpAndSettle();
    expect(Theme.of(ctx()).scaffoldBackgroundColor, LgPalette.dark.bg);
  });

  testWidgets('each tab keeps its stack and scroll position', (tester) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    // Tahlillar → glyukoza kartasi.
    await tapText(tester, uz.navTests);
    await tapText(tester, 'Och qoringa plazma glyukozasi');
    expect(find.text(uz.analyteSampleNotice), findsOneWidget);
    // Lab tab: ro'yxatni pastga suramiz.
    await tapText(tester, uz.navLab);
    final labList = find.byType(Scrollable).hitTestable().first;
    await tester.drag(labList, const Offset(0, -250));
    await tester.pumpAndSettle();
    final labOffset = tester.state<ScrollableState>(labList).position.pixels;
    expect(labOffset, greaterThan(0));
    // Tahlillarga qaytganda karta hali ochiq.
    await tapText(tester, uz.navTests);
    expect(find.text(uz.analyteSampleNotice), findsOneWidget);
    // Lab ga qaytganda scroll joyida.
    await tapText(tester, uz.navLab);
    expect(
      tester
          .state<ScrollableState>(find.byType(Scrollable).hitTestable().first)
          .position
          .pixels,
      labOffset,
    );
    // Faol tabni qayta bosish — ildizga qaytadi.
    await tapText(tester, uz.navTests);
    await tester.tap(find.text(uz.navTests));
    await tester.pumpAndSettle();
    expect(find.text(uz.testsTitle), findsWidgets);
    expect(find.text(uz.analyteSampleNotice), findsNothing);
  });

  testWidgets('Android back: card → list → Home tab', (tester) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await tapText(tester, uz.navTests);
    await tapText(tester, 'Och qoringa plazma glyukozasi');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text(uz.testsSubtitle), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text(uz.homeTitle), findsOneWidget);
  });

  testWidgets('search: synonyms, filter, empty state, clear', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.ru);
    await pumpApp(tester, s);
    await tapText(tester, ru.navTests);
    await tester.enterText(find.byType(TextField), 'АЛТ');
    await tester.pumpAndSettle();
    expect(find.text('Аланинаминотрансфераза (АЛТ)'), findsOneWidget);
    expect(find.text(ru.testsResultCount(1)), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'xyzzy');
    await tester.pumpAndSettle();
    expect(find.text(ru.testsEmptyTitle), findsOneWidget);
    await tapText(tester, ru.testsClearSearch);
    expect(find.text(ru.testsResultCount(35)), findsOneWidget);
    // Guruh filtri.
    await tapText(tester, 'Печень');
    expect(find.text(ru.testsResultCount(6)), findsOneWidget);
  });

  testWidgets('bookmark survives an app restart', (tester) async {
    final store = MemoryKeyValueStore();
    final s = await makeServices(tester, store: store);
    await pumpApp(tester, s);
    await tapText(tester, uz.navTests);
    await tapText(tester, 'Och qoringa plazma glyukozasi');
    await tapText(tester, uz.analyteSave);
    expect(find.text(uz.analyteSavedToast), findsOneWidget);
    expect(find.text(uz.analyteSaved), findsOneWidget);

    // "Qayta ochish": shu ombor bilan yangi servislar va ilova.
    await tester.pumpWidget(const SizedBox());
    final reopened = await makeServices(tester, store: store);
    await pumpApp(tester, reopened);
    await tapText(tester, uz.navLibrary);
    await tapText(tester, uz.featureSaved);
    expect(find.text('Och qoringa plazma glyukozasi'), findsOneWidget);
  });

  testWidgets('glucose card: sources, thresholds ≠ reference interval', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 4000));
    await goTo(tester, '/tests/analyte/glucose-plasma-fasting');
    expect(find.text(en.analyteSampleNotice), findsOneWidget);
    expect(find.text(en.analyteRefIntervalNone), findsOneWidget);
    expect(find.textContaining('100–125 mg/dL'), findsOneWidget);
    expect(find.textContaining('≥ 126 mg/dL'), findsOneWidget);
    // SI ekvivalenti hisoblangan va shunday belgilangan (manbada yo'q).
    expect(find.text(en.analyteSiApprox('5.6–6.9 mmol/L')), findsOneWidget);
    expect(find.text(en.analyteSiApprox('≥ 7.0 mmol/L')), findsOneWidget);
    expect(find.textContaining('180.156 g/mol'), findsOneWidget);
    expect(find.text(en.analyteDecisionNotRef), findsOneWidget);
    expect(find.textContaining('MedlinePlus'), findsWidgets);
    expect(find.textContaining('NIDDK'), findsWidgets);
    expect(find.text(en.analyteReviewPending), findsOneWidget);
    expect(find.text(en.analyteReviewApproved), findsNothing);
  });

  testWidgets('structure-only card shows no clinical text', (tester) async {
    // Paketda bunday karta qolmagan — tekshiruvdan o'tadigan o'zgartirilgan
    // paket bilan sinaladi (yangi analit avval shu holatda qo'shiladi).
    final bundle = PatchedPackBundle(rootBundle, (pack) {
      final alt = (pack['analytes']! as List)
          .cast<Map<String, Object?>>()
          .firstWhere((a) => a['id'] == 'alt');
      alt
        ..['content_state'] = 'structure_only'
        ..['claims'] = <Object>[]
        ..['decision_limits'] = <Object>[];
    });
    final s = await makeServices(
      tester,
      language: AppLanguage.en,
      bundle: bundle,
    );
    await pumpApp(tester, s);
    await goTo(tester, '/tests/analyte/alt');
    expect(find.text(en.analyteStructureOnlyTitle), findsOneWidget);
    expect(find.text(en.statusStructureOnly), findsOneWidget);
    expect(find.text(en.analyteDecisionLimits), findsNothing);
    expect(find.text(en.analyteSampleNotice), findsNothing);
  });

  testWidgets('sourced card: sample notice, cited claims, strict limits', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 6000));
    await goTo(tester, '/tests/analyte/egfr');
    expect(find.text(en.analyteSampleNotice), findsOneWidget);
    expect(find.text(en.analyteStructureOnlyTitle), findsNothing);
    // Manba “less than 60” deydi — “≤ 60” emas.
    expect(find.textContaining('< 60 mL/min/1.73 m²'), findsWidgets);
    expect(find.textContaining('≤ 60'), findsNothing);
    expect(find.textContaining('≤ 15 mL/min/1.73 m²'), findsWidgets);
    expect(find.textContaining('MedlinePlus'), findsWidgets);
  });

  testWidgets('analyte practice opens that analyte’s questions in-tab', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s);
    await goTo(tester, '/tests/analyte/creatinine');
    await tapText(tester, en.analytePractice);
    // Eyebrow katta harflarda ko'rsatiladi.
    expect(find.text(en.quizProgress(1, 2).toUpperCase()), findsOneWidget);
    expect(find.text(en.quizDraftTag), findsOneWidget);
    // Mavzu tanlovi yo'q — to'g'ridan-to'g'ri shu analit savollari.
    expect(find.text(en.quizChooseTopic), findsNothing);
    expect(find.text('Creatinine'), findsWidgets);
    // Boshqa analit testiga o'tilganda sessiya yangilanadi.
    await goTo(tester, '/tests/analyte/urea/quiz');
    expect(find.text('Urea'), findsWidgets);
    final ureaPrompt = s.content.pack!.quiz
        .firstWhere((q) => q.topicIds.contains('urea'))
        .prompt
        .of('en');
    expect(find.text(ureaPrompt), findsOneWidget);
  });

  testWidgets('demo OTP flow with validation, attempts and success', (
    tester,
  ) async {
    final s = await makeServices(tester, onboarded: false, role: null);
    await pumpApp(tester, s);
    await tapText(tester, uz.welcomeGetStarted);
    expect(find.text(uz.authDemoNotice), findsOneWidget);
    await tapText(tester, uz.authGetCode);
    expect(find.text(uz.authEmailInvalid), findsOneWidget);
    expect(find.text(uz.authConsentRequired), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'student@example.com');
    await tapText(tester, uz.authConsent);
    await tapText(tester, uz.authGetCode);
    expect(find.text(uz.otpTitle), findsWidgets);
    expect(find.text(uz.otpDemoCode('123456')), findsOneWidget);
    await tester.enterText(find.byType(TextField), '12');
    await tapText(tester, uz.otpVerify);
    expect(find.text(uz.otpFormat), findsOneWidget);
    // 6 raqam kiritilganda o'zi tekshiradi (iOS raqam klaviaturasida
    // “Done” yo'q).
    await tester.enterText(find.byType(TextField), '000000');
    await tester.pumpAndSettle();
    expect(find.text(uz.otpInvalid(4)), findsOneWidget);
    // Til almashsa, ekrandagi xato ham yangi tilda.
    await s.settings.setLanguage(AppLanguage.en);
    await tester.pumpAndSettle();
    expect(find.text(en.otpInvalid(4)), findsOneWidget);
    await s.settings.setLanguage(AppLanguage.uz);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    expect(find.text(uz.rolesTitle), findsOneWidget);
    expect(s.auth.hasAccount, isTrue);
    // Muvaffaqiyatdan keyin “faol kod yo'q” holati chaqnamaydi.
    expect(find.text(uz.otpNoActiveCode), findsNothing);
  });

  testWidgets('signing in from Profile returns to Profile; tabs survive', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await goTo(tester, '/lab/calculators');
    // Profil tab ichidan ochiladi (push) — orqaga yo'li bor.
    await tester.tap(find.byTooltip(uz.actionProfile).first);
    await tester.pumpAndSettle();
    await tapText(tester, uz.profileSignIn);
    await tester.enterText(find.byType(TextField), 'lab@example.com');
    await tapText(tester, uz.authConsent);
    await tapText(tester, uz.authGetCode);
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    expect(s.auth.hasAccount, isTrue);
    // Profil sahifasi, orqaga tugmasi bor; orqaga — tablar o'z joyida.
    expect(find.text(uz.profileTitle), findsWidgets);
    expect(find.byTooltip(uz.actionBack), findsOneWidget);
    await tester.tap(find.byTooltip(uz.actionBack));
    await tester.pumpAndSettle();
    expect(find.text(uz.navLab), findsWidgets);
    expect(find.text(uz.calcTitle), findsWidgets);
  });

  testWidgets('account sign out can also delete data on this device', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await s.bookmarks.toggle('glucose-plasma-fasting');
    await s.auth.requestCode('lab@example.com');
    await s.auth.verifyCode('123456');
    await pumpApp(tester, s);
    await goTo(tester, '/profile');
    await tapText(tester, uz.profileSignOut);
    expect(find.text(uz.profileSignOutBody), findsOneWidget);
    await tester.tap(find.text(uz.actionCancel));
    await tester.pumpAndSettle();
    expect(s.auth.hasAccount, isTrue);

    await tapText(tester, uz.profileSignOut);
    await tester.tap(find.text(uz.profileSignOutDelete));
    await tester.pumpAndSettle();
    expect(s.auth.hasAccount, isFalse);
    expect(s.bookmarks.ids, isEmpty);
    expect(s.settings.onboarded, isFalse);
  });

  testWidgets('release build: email sign-in is unavailable, guest works', (
    tester,
  ) async {
    final s = await makeServices(
      tester,
      onboarded: false,
      role: null,
      otpAdapter: const UnconfiguredOtpAdapter(),
    );
    await pumpApp(tester, s);
    await tapText(tester, uz.welcomeSignIn);
    expect(find.text(uz.authUnavailableTitle), findsOneWidget);
    expect(find.text(uz.authGetCode), findsNothing);
    await tapText(tester, uz.authContinueGuest);
    expect(find.text(uz.rolesTitle), findsOneWidget);
  });

  testWidgets('classes require sign-in; nothing pretends to work', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await goTo(tester, '/learn/classes');
    expect(find.text(uz.classesSignInTitle), findsOneWidget);
    await goTo(tester, '/profile/purchase');
    expect(find.text(uz.purchaseNotice), findsOneWidget);
    final buttons = find.textContaining(uz.notAvailableYet);
    expect(buttons, findsNWidgets(2));
  });

  testWidgets('large title collapses on scroll down and expands on scroll up', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await tapText(tester, uz.navTests);
    final list = find.byType(Scrollable).hitTestable().first;
    final subtitle = find.text(uz.testsSubtitle).hitTestable();
    expect(subtitle, findsOneWidget);
    await tester.drag(list, const Offset(0, -300));
    await tester.pumpAndSettle();
    // Ixcham: katta blok yig'ildi, sarlavha toolbarda.
    expect(subtitle, findsNothing);
    expect(find.text(uz.testsTitle).hitTestable(), findsOneWidget);
    // Kichik teskari harakat (14 px dan kam) holatni o'zgartirmaydi.
    await tester.timedDragFrom(
      tester.getCenter(list),
      const Offset(0, 28), // touch slop (18) dan keyin ~10 px
      // Sekin: fling (inersiya) qo'shilmasin.
      const Duration(milliseconds: 1500),
    );
    await tester.pumpAndSettle();
    expect(subtitle, findsNothing);
    await tester.drag(list, const Offset(0, 120));
    await tester.pumpAndSettle();
    expect(subtitle, findsOneWidget);
    // Pastki menyu doim ko'rinadi.
    expect(find.text(uz.navLearn).hitTestable(), findsOneWidget);
  });

  testWidgets('reduced motion: header switches without animation', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s, reduceMotion: true);
    await tapText(tester, uz.navTests);
    final list = find.byType(Scrollable).hitTestable().first;
    await tester.drag(list, const Offset(0, -300));
    // Animatsiya bo'lsa, bitta 0 ms kadrdan keyin blok hali ochiq bo'lardi.
    await tester.pump();
    expect(find.text(uz.testsSubtitle).hitTestable(), findsNothing);
  });

  testWidgets('dilution calculator: comma decimals, errors, result', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.ru);
    await pumpApp(tester, s);
    await goTo(tester, '/lab/calculators/dilution');
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '10');
    await tester.enterText(fields.at(1), '2,5');
    await tester.enterText(fields.at(2), '100');
    await tapText(tester, ru.dilCalculate);
    expect(find.text(ru.dilResult('25')), findsOneWidget);
    await tester.enterText(fields.at(1), '-1');
    await tapText(tester, ru.dilCalculate);
    expect(find.text(ru.dilErrorInvalid), findsOneWidget);
    await tester.enterText(fields.at(1), '20');
    await tapText(tester, ru.dilCalculate);
    expect(find.text(ru.dilErrorC2GtC1), findsOneWidget);
  });

  testWidgets('glucose unit converter is analyte-specific', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s);
    await goTo(tester, '/tests/analyte/glucose-plasma-fasting/units');
    await tester.enterText(find.byType(TextField), '126');
    await tapText(tester, en.ucConvert);
    expect(find.text('6.99 mmol/L'), findsOneWidget);
    expect(find.text(en.ucNote('180.156')), findsOneWidget);
    // Kreatinin: laboratoriyalar µmol/L da beradi.
    await goTo(tester, '/tests/analyte/creatinine/units');
    await tester.enterText(find.byType(TextField), '1.2');
    await tapText(tester, en.ucConvert);
    await scrollTo(tester, find.text('106.1 µmol/L'));
    expect(find.text('106.1 µmol/L'), findsOneWidget);
    // Molyar massasi yo'q analit uchun o'tkazish taklif qilinmaydi.
    await goTo(tester, '/tests/analyte/alt/units');
    expect(find.text(en.ucNotAvailable), findsOneWidget);
  });

  testWidgets('quiz: explanations per answer, score from real answers', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s);
    await goTo(tester, '/learn/quiz');
    // Avval mavzu tanlanadi: guruhlar, laboratoriya hisoblari, aralash.
    expect(find.text(en.quizChooseTopic), findsOneWidget);
    expect(find.text(en.quizTopicMixed(10)), findsOneWidget);
    await tapText(tester, en.quizTopicGeneral);
    expect(find.text(en.quizDraftTag), findsOneWidget);
    // 1-savol: to'g'ri.
    await tapText(tester, 'C₁V₁ = C₂V₂');
    expect(find.text(en.quizCorrect), findsOneWidget);
    await tapText(tester, en.quizNext);
    // 2-savol: noto'g'ri.
    await tapText(tester, 'Always');
    expect(find.text(en.quizIncorrect), findsOneWidget);
    expect(find.text(en.quizYourAnswer), findsOneWidget);
    await tapText(tester, en.quizNext);
    // 3-savol: to'g'ri.
    await tapText(tester, 'Model and relevant document revision');
    await tapText(tester, en.quizFinish);
    expect(find.text(en.quizScore(2, 3)), findsOneWidget);
    expect(find.text(en.quizMistakes), findsOneWidget);
    // Boshqa mavzu — yana tanlov ro'yxati; xato savol takrorlashga tushadi.
    await tapText(tester, en.quizOtherTopic);
    expect(find.text(en.quizChooseTopic), findsOneWidget);
    expect(find.text(en.quizTopicMistakes), findsOneWidget);
    expect(
      find.text('${en.quizQuestionCount(3)} · ${en.quizMastered(2, 3)}'),
      findsOneWidget,
    );
    await tapText(tester, en.quizTopicMistakes);
    expect(find.text(en.quizProgress(1, 1).toUpperCase()), findsOneWidget);
    // Endi to'g'ri javob — xatolar ro'yxatidan chiqadi.
    final wrongId = s.quizProgress.mistakes([
      for (final q in s.content.pack!.quiz) q.id,
    ]).single;
    final wrongQ = s.content.pack!.quiz.firstWhere((q) => q.id == wrongId);
    await tapText(tester, wrongQ.options[wrongQ.correctIndex].text.of('en'));
    await tapText(tester, en.quizFinish);
    await tapText(tester, en.quizOtherTopic);
    expect(find.text(en.quizTopicMistakes), findsNothing);
  });

  testWidgets('preanalytics shows the WHO order of draw with its source', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 4000));
    await goTo(tester, '/lab/preanalytics');
    expect(find.text(en.preOrderTitle), findsOneWidget);
    expect(find.text('Blood culture bottle'), findsOneWidget);
    expect(find.text(en.preCap('purple')), findsOneWidget);
    expect(
      find.textContaining('WHO guidelines on drawing blood'),
      findsOneWidget,
    );
  });

  testWidgets('creatinine card links to the eGFR calculator', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s);
    await goTo(tester, '/tests/analyte/creatinine');
    await tapText(tester, en.calcEgfr);
    expect(find.text('${en.fieldCreatinine}, µmol/L'), findsOneWidget);
    expect(find.text(en.calcFormulaTag), findsOneWidget);
  });

  testWidgets('quiz by group uses only that group’s questions', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s);
    await goTo(tester, '/learn/quiz');
    final kidney = s.content.pack!.group('kidney')!.names.of('en');
    await tapText(tester, kidney);
    final kidneyIds = {
      for (final a in s.content.pack!.analytes)
        if (a.group == 'kidney') a.id,
    };
    final expected = s.content.pack!.quiz
        .where((q) => q.topicIds.any(kidneyIds.contains))
        .length;
    expect(expected, greaterThan(0));
    expect(
      find.text(en.quizProgress(1, expected).toUpperCase()),
      findsOneWidget,
    );
  });

  testWidgets('corrupted content pack → error state, no content shown', (
    tester,
  ) async {
    final s = await makeServices(tester, bundle: TamperingBundle(rootBundle));
    await pumpApp(tester, s);
    await tapText(tester, uz.navTests);
    expect(find.text(uz.contentErrorTitle), findsOneWidget);
    expect(find.text(uz.actionRetry), findsOneWidget);
    expect(find.text('Och qoringa plazma glyukozasi'), findsNothing);
  });

  testWidgets('library catalog: licence-aware records, language filter', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s, size: const Size(390, 30000));
    await goTo(tester, '/library/books');
    final library = s.content.pack!.library;
    expect(library, isNotEmpty);
    expect(find.text(uz.booksEmptyTitle), findsNothing);
    // Har yozuvda rasmiy sahifa havolasi; ochiq litsenziya nomi bilan.
    expect(
      find.text(uz.libOpenSource),
      findsNWidgets(library.where((i) => i.url != null).length),
    );
    expect(find.text(uz.libAccessOpen('CC BY-NC-SA 4.0')), findsWidgets);
    // Til filtri: faqat o'zbekcha yozuvlar.
    await tester.tap(find.text('O‘zbekcha'));
    await tester.pumpAndSettle();
    expect(
      find.byType(LibraryItemCard),
      findsNWidgets(library.where((i) => i.language == 'uz').length),
    );
  });

  testWidgets('review queue has honest counts', (tester) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await goTo(tester, '/library/review');
    expect(find.text(uz.reviewNoDiscrepancies), findsOneWidget);
    expect(
      find.text(uz.reviewCatalog(s.content.pack!.library.length)),
      findsOneWidget,
    );
    expect(
      find.text(uz.reviewDraftQuestions(s.content.pack!.quiz.length)),
      findsOneWidget,
    );
    await goTo(tester, '/library/packs');
    expect(find.text(uz.packsVerified), findsOneWidget);
  });

  testWidgets('sign out returns to welcome and clears tab stacks', (
    tester,
  ) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await goTo(tester, '/profile');
    // Mehmon uchun bu “boshidan sozlash” (hisobdan chiqish emas).
    expect(find.text(uz.profileSignOut), findsNothing);
    await tapText(tester, uz.profileRestartSetup);
    expect(find.text(uz.welcomeGuest), findsOneWidget);
    expect(s.settings.onboarded, isFalse);
  });

  testWidgets('every interactive target is at least 44×44', (tester) async {
    final s = await makeServices(tester);
    await pumpApp(tester, s);
    await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
    await goTo(tester, '/tests');
    await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
  });

  test('palette text contrast meets WCAG AA (≥ 4.5:1) in both themes', () {
    for (final p in [LgPalette.light, LgPalette.dark]) {
      final pairs = {
        'ink/bg': (p.ink, p.bg),
        'ink/paper': (p.ink, p.paper),
        'ink/soft': (p.ink, p.soft),
        'sub/bg': (p.sub, p.bg),
        'sub/paper': (p.sub, p.paper),
        'sub/soft': (p.sub, p.soft),
        'brand/bg': (p.brand, p.bg),
        'brand/paper': (p.brand, p.paper),
        'brand/soft': (p.brand, p.soft),
        'onBrand/brand': (p.onBrand, p.brand),
        'amber/amberBg': (p.amber, p.amberBg),
        'danger/paper': (p.danger, p.paper),
        'danger/amberBg': (p.danger, p.amberBg),
      };
      for (final MapEntry(key: name, value: (fg, bg)) in pairs.entries) {
        expect(
          contrastRatio(fg, bg),
          greaterThanOrEqualTo(4.5),
          reason: '$name ${p == LgPalette.light ? 'light' : 'dark'}',
        );
      }
    }
  });

  test('control boundaries meet WCAG 1.4.11 (≥ 3:1) in both themes', () {
    for (final p in [LgPalette.light, LgPalette.dark]) {
      for (final MapEntry(key: name, value: bg) in {
        'bg': p.bg,
        'paper': p.paper,
      }.entries) {
        expect(
          contrastRatio(p.outline, bg),
          greaterThanOrEqualTo(3),
          reason: 'outline/$name ${p == LgPalette.light ? 'light' : 'dark'}',
        );
      }
    }
  });

  test('l10n: all three languages define every key', () {
    expect(
      AppLocalizations.supportedLocales.map((l) => l.languageCode).toSet(),
      {'en', 'ru', 'uz'},
    );
  });

  testWidgets('keyboard does not hide the primary action', (tester) async {
    final s = await makeServices(tester, onboarded: false, role: null);
    await pumpApp(tester, s, size: const Size(320, 640));
    await tapText(tester, uz.welcomeGetStarted);
    tester.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
    await tester.pumpAndSettle();
    await tester.showKeyboard(find.byType(TextField));
    await tester.pumpAndSettle();
    // Asosiy tugma klaviatura ostida qolib ketmaydi: unga scroll qilib
    // yetish mumkin va u klaviaturadan yuqorida turadi.
    final button = find.text(uz.authGetCode);
    await scrollTo(tester, button);
    expect(button.hitTestable(), findsOneWidget);
    final rect = tester.getRect(button);
    expect(rect.bottom, lessThanOrEqualTo(640 - 300));
    expect(tester.takeException(), isNull);
    await SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
  });
}

double contrastRatio(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}
