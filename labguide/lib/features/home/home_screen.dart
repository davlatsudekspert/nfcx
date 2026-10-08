import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/app_scope.dart';
import '../../app/widgets/lg_page.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/ui/role_screen.dart';
import '../auth/ui/welcome_screen.dart';
import '../content/ui/content_widgets.dart';
import '../settings/settings_controller.dart';
import '../../app/shell.dart';

/// Bosh sahifadagi bitta tezkor amal.
class HomeAction {
  const HomeAction(this.label, this.icon, this.location);

  final String label;
  final IconData icon;

  /// `context.go` bilan ochiladi: tegishli tab o'z stacki bilan tanlanadi.
  final String location;
}

/// Rolga mos bosh sahifa tarkibi. Rol faqat ustuvorlikni o'zgartiradi —
/// kontent va ruxsatlar hamma uchun bir xil.
class RoleHome {
  const RoleHome({
    required this.heroTitle,
    required this.heroBody,
    required this.heroCta,
    required this.heroLocation,
    required this.actions,
    required this.usefulAnalytes,
  });

  final String heroTitle;
  final String heroBody;
  final String heroCta;
  final String heroLocation;
  final List<HomeAction> actions;
  final List<String> usefulAnalytes;

  static RoleHome of(AppRole role, AppLocalizations l) => switch (role) {
    AppRole.doctor => RoleHome(
      heroTitle: l.homeHeroDoctorTitle,
      heroBody: l.homeHeroDoctorBody,
      heroCta: l.homeHeroDoctorCta,
      heroLocation: '/tests',
      actions: [
        HomeAction(l.featureTests, Icons.biotech_outlined, '/tests'),
        HomeAction(
          l.featureCalculators,
          Icons.calculate_outlined,
          '/lab/calculators',
        ),
        HomeAction(
          l.featureSampleFactors,
          Icons.vaccines_outlined,
          '/lab/preanalytics',
        ),
        HomeAction(l.featureSaved, Icons.bookmark_outline, '/library/saved'),
      ],
      usefulAnalytes: const ['glucose-plasma-fasting', 'creatinine', 'alt'],
    ),
    AppRole.lab => RoleHome(
      heroTitle: l.homeHeroLabTitle,
      heroBody: l.homeHeroLabBody,
      heroCta: l.homeHeroLabCta,
      heroLocation: '/lab/qc',
      actions: [
        HomeAction(l.featureQc, Icons.show_chart_rounded, '/lab/qc'),
        HomeAction(
          l.featureCalibration,
          Icons.tune_rounded,
          '/lab/calibration',
        ),
        HomeAction(
          l.featureCalculators,
          Icons.calculate_outlined,
          '/lab/calculators',
        ),
        HomeAction(
          l.featureSampling,
          Icons.science_outlined,
          '/lab/preanalytics',
        ),
      ],
      usefulAnalytes: const [
        'glucose-plasma-fasting',
        'potassium',
        'urine-microscopy',
      ],
    ),
    AppRole.student => RoleHome(
      heroTitle: l.homeHeroStudentTitle,
      heroBody: l.homeHeroStudentBody,
      heroCta: l.homeHeroStudentCta,
      heroLocation: '/learn',
      actions: [
        HomeAction(l.featureTopics, Icons.menu_book_outlined, '/tests'),
        HomeAction(l.featureQuiz, Icons.quiz_outlined, '/learn/quiz'),
        HomeAction(
          l.featureMicroscopy,
          Icons.biotech_outlined,
          '/lab/microscopy',
        ),
        HomeAction(l.featureExam, Icons.timer_outlined, '/learn/exam'),
      ],
      usefulAnalytes: const ['glucose-plasma-fasting', 'hba1c', 'egfr'],
    ),
    AppRole.teacher => RoleHome(
      heroTitle: l.homeHeroTeacherTitle,
      heroBody: l.homeHeroTeacherBody,
      heroCta: l.homeHeroTeacherCta,
      heroLocation: '/learn/classes',
      actions: [
        HomeAction(l.featureClasses, Icons.groups_outlined, '/learn/classes'),
        HomeAction(l.featureQuestionBank, Icons.quiz_outlined, '/learn/quiz'),
        HomeAction(
          l.featureSources,
          Icons.fact_check_outlined,
          '/library/sources',
        ),
        HomeAction(
          l.featureResearch,
          Icons.edit_note_rounded,
          '/library/research',
        ),
      ],
      usefulAnalytes: const ['glucose-plasma-fasting', 'hba1c', 'crp'],
    ),
  };
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.services.settings;
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) {
        final l = AppLocalizations.of(context);
        final role = settings.effectiveRole;
        final config = RoleHome.of(role, l);
        return LgPage(
          // Rol almashganda sarlavha holati ham yangidan boshlanadi.
          key: ValueKey(role),
          title: l.homeTitle,
          eyebrow: role.title(l),
          showBrand: true,
          children: [
            LgHeroCard(
              image: kHeroImage,
              tag: l.homeFocusTag,
              title: config.heroTitle,
              body: config.heroBody,
              action: LgButton(
                label: config.heroCta,
                onPressed: () => openInTab(context, config.heroLocation),
              ),
            ),
            const SizedBox(height: 8),
            LgTwoColumnGrid(
              children: [
                for (var i = 0; i < config.actions.length; i++)
                  LgTile(
                    title: config.actions[i].label,
                    caption: l.actionOpen,
                    icon: config.actions[i].icon,
                    highlighted: i == 0,
                    onTap: () => openInTab(context, config.actions[i].location),
                  ),
              ],
            ),
            LgSectionTitle(l.homeUsefulTests),
            ContentGate(
              builder: (context, pack) {
                final analytes = [
                  for (final id in config.usefulAnalytes) ?pack.analyte(id),
                ];
                return Column(
                  children: [
                    for (var i = 0; i < analytes.length; i++)
                      AnalyteRow(
                        analyte: analytes[i],
                        divider: i < analytes.length - 1,
                        onTap: () =>
                            context.push('/home/analyte/${analytes[i].id}'),
                      ),
                  ],
                );
              },
            ),
          ],
        );
      },
    );
  }
}
