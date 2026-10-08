import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/widgets/lg_page.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../content/content_model.dart';
import '../content/ui/content_widgets.dart';
import 'ifu_matching.dart';

class LabScreen extends StatelessWidget {
  const LabScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.labTitle,
      subtitle: l.labSubtitle,
      showBrand: true,
      children: [
        LgHeroCard(
          eyebrow: l.labHeroEyebrow,
          title: l.labHeroTitle,
          body: l.labHeroBody,
          action: LgButton(
            label: l.labHeroCta,
            onPressed: () => context.push('/lab/calibration'),
          ),
        ),
        LgRow(
          title: l.featureQc,
          subtitle: l.labQcSub,
          icon: Icons.show_chart_rounded,
          onTap: () => context.push('/lab/qc'),
        ),
        LgRow(
          title: l.labPreanalytics,
          subtitle: l.labPreanalyticsSub,
          icon: Icons.science_outlined,
          onTap: () => context.push('/lab/preanalytics'),
        ),
        LgRow(
          title: l.featureCalculators,
          subtitle: l.labCalculatorsSub,
          icon: Icons.calculate_outlined,
          onTap: () => context.push('/lab/calculators'),
        ),
        LgRow(
          title: l.labInstruments,
          subtitle: l.labInstrumentsSub,
          icon: Icons.precision_manufacturing_outlined,
          onTap: () => context.push('/lab/instruments'),
        ),
        LgRow(
          title: l.micTitle,
          subtitle: l.labMicroscopySub,
          icon: Icons.biotech_outlined,
          onTap: () => context.push('/lab/microscopy'),
          divider: false,
        ),
      ],
    );
  }
}

class CalibrationScreen extends StatefulWidget {
  const CalibrationScreen({super.key, this.initialManufacturer});

  final String? initialManufacturer;

  @override
  State<CalibrationScreen> createState() => _CalibrationScreenState();
}

class _CalibrationScreenState extends State<CalibrationScreen> {
  static const _makers = ['Mindray', 'HUMAN'];

  late String? _maker = widget.initialManufacturer ?? _makers.first;
  final _model = TextEditingController();
  final _ref = TextEditingController();
  final _ifu = TextEditingController();
  final _lot = TextEditingController();
  String? _error;
  IfuMatch? _result;

  @override
  void dispose() {
    for (final c in [_model, _ref, _ifu, _lot]) {
      c.dispose();
    }
    super.dispose();
  }

  void _check(ContentPack pack) {
    final l = AppLocalizations.of(context);
    final query = IfuQuery(
      manufacturer: _maker,
      model: _model.text,
      reagentRef: _ref.text,
      ifuRevision: _ifu.text,
      calibratorLot: _lot.text,
    );
    if (!query.isComplete) {
      setState(() {
        _error = l.calFieldsRequired;
        _result = null;
      });
      return;
    }
    setState(() {
      _error = null;
      _result = matchIfu(pack.ifuRecords, query);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    return LgPage(
      title: l.calTitle,
      subtitle: l.calSubtitle,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 8),
          child: Text(l.calManufacturer, style: text.titleSmall),
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final m in [..._makers, null])
              LgChoiceChip(
                label: m ?? l.calManufacturerOther,
                selected: _maker == m,
                onTap: () => setState(() {
                  _maker = m;
                  _result = null;
                }),
              ),
          ],
        ),
        LgField(
          label: l.calModel,
          controller: _model,
          hint: l.calModelHint,
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.calReagentRef,
          controller: _ref,
          hint: 'REF',
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.calIfuRevision,
          controller: _ifu,
          hint: 'IFU rev.',
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.calCalibratorLot,
          controller: _lot,
          hint: 'LOT',
          textInputAction: TextInputAction.done,
        ),
        if (_error != null) LgNotice(_error!, kind: NoticeKind.error),
        const SizedBox(height: 14),
        ContentGate(
          builder: (context, pack) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LgButton(label: l.calCheck, onPressed: () => _check(pack)),
              if (_result?.record case final record?)
                LgNotice(
                  pack.analyte(record.analyteId)?.names.of(lang) ??
                      record.analyteId,
                  kind: NoticeKind.info,
                  title: 'IFU',
                )
              else if (_result != null)
                LgNotice(l.calNoMatchBody, title: l.calNoMatchTitle),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  l.calCatalogCount(pack.ifuRecords.length),
                  style: text.bodySmall,
                ),
              ),
            ],
          ),
        ),
        LgNotice(l.calBrandWarning, kind: NoticeKind.info),
        LgSectionTitle(l.calWorkflow),
        LgSteps([
          l.calStep1,
          l.calStep2,
          l.calStep3,
          l.calStep4,
          l.calStep5,
          l.calStep6,
        ]),
        const SizedBox(height: 8),
        Text(l.calNoServiceCodes, style: text.bodySmall),
      ],
    );
  }
}

class QcScreen extends StatelessWidget {
  const QcScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: l.qcTitle,
      children: [
        LgPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.qcChartTitle, style: text.titleMedium),
              const SizedBox(height: 6),
              Text(l.qcChartBody, style: text.bodyMedium),
            ],
          ),
        ),
        LgStateView(
          kind: StateKind.empty,
          title: l.qcEmptyTitle,
          message: l.qcEmptyBody,
        ),
        Center(child: LgTag(l.plannedStage('C'), tone: LgTone.neutral)),
      ],
    );
  }
}

class PreanalyticsScreen extends StatelessWidget {
  const PreanalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.preTitle,
      children: [
        LgSteps([l.preStep1, l.preStep2, l.preStep3, l.preStep4, l.preStep5]),
        LgNotice(l.preNotice),
      ],
    );
  }
}

class InstrumentsScreen extends StatelessWidget {
  const InstrumentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.insTitle,
      children: [
        LgRow(
          title: 'Mindray',
          subtitle: l.insMindraySub,
          icon: Icons.precision_manufacturing_outlined,
          onTap: () => context.push('/lab/calibration'),
        ),
        LgRow(
          title: 'HUMAN',
          subtitle: l.insHumanSub,
          icon: Icons.precision_manufacturing_outlined,
          onTap: () => context.push('/lab/calibration'),
        ),
        LgRow(
          title: l.insOther,
          subtitle: l.insOtherSub,
          icon: Icons.add_circle_outline_rounded,
          onTap: () => context.push('/lab/calibration'),
          divider: false,
        ),
        LgNotice(l.calBrandWarning, kind: NoticeKind.info),
      ],
    );
  }
}

class MicroscopyScreen extends StatelessWidget {
  const MicroscopyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final items = [
      l.micRedCells,
      l.micWhiteCells,
      l.micEpithelium,
      l.micCasts,
      l.micCrystals,
    ];
    return LgPage(
      title: l.micTitle,
      children: [
        LgNotice(l.micNotice),
        for (var i = 0; i < items.length; i++)
          LgRow(
            title: items[i],
            subtitle: '${l.micItemSub}\n${l.micImagePending}',
            icon: Icons.hide_image_outlined,
            divider: i < items.length - 1,
          ),
        const SizedBox(height: 12),
        Center(child: LgTag(l.plannedStage('C'), tone: LgTone.neutral)),
        // Siydik mikroskopiyasi kartasi tuzilmasi bilan bog'lanish.
        ContentGate(
          builder: (context, pack) {
            final card = pack.analyte('urine-microscopy');
            if (card == null) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(top: 12),
              child: AnalyteRow(
                analyte: card,
                divider: false,
                onTap: () => context.go('/tests/analyte/${card.id}'),
              ),
            );
          },
        ),
      ],
    );
  }
}
