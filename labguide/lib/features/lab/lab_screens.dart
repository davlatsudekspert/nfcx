import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/shell.dart';
import '../../app/widgets/lg_page.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../content/content_model.dart';
import '../content/ui/content_widgets.dart';
import '../tools/calc_info.dart';
import '../tools/clinical_calc_screens.dart';
import 'ifu_matching.dart';
import 'preanalytics_info.dart';

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

  /// `?maker=` qiymati: “Mindray”, “HUMAN” yoki “other” (boshqa ishlab
  /// chiqaruvchi). Asboblar ro'yxatidan kelganda tanlov saqlanadi.
  final String? initialManufacturer;

  static const makers = ['Mindray', 'HUMAN'];

  @override
  State<CalibrationScreen> createState() => _CalibrationScreenState();
}

class _CalibrationScreenState extends State<CalibrationScreen> {
  static const _makers = CalibrationScreen.makers;

  late String? _maker = switch (widget.initialManufacturer) {
    'other' => null,
    final m? when _makers.contains(m) => m,
    _ => _makers.first,
  };
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

  /// Maydon o'zgarsa eski moslik natijasi ko'rinib qolmasin.
  void _invalidate(String _) {
    if (_result != null || _error != null) {
      setState(() {
        _result = null;
        _error = null;
      });
    }
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
          onChanged: _invalidate,
        ),
        LgField(
          label: l.calReagentRef,
          controller: _ref,
          hint: 'REF',
          textInputAction: TextInputAction.next,
          onChanged: _invalidate,
        ),
        LgField(
          label: l.calIfuRevision,
          controller: _ifu,
          hint: 'IFU rev.',
          textInputAction: TextInputAction.next,
          onChanged: _invalidate,
        ),
        LgField(
          label: l.calCalibratorLot,
          controller: _lot,
          hint: 'LOT',
          textInputAction: TextInputAction.done,
          onChanged: _invalidate,
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

class PreanalyticsScreen extends StatelessWidget {
  const PreanalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    Widget bullets(List<LocalizedText> items) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final x in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('•  ', style: text.bodyMedium),
                Expanded(child: Text(x.of(lang), style: text.bodyMedium)),
              ],
            ),
          ),
      ],
    );
    return LgPage(
      title: l.preTitle,
      children: [
        LgSteps([l.preStep1, l.preStep2, l.preStep3, l.preStep4, l.preStep5]),
        LgSectionTitle(l.preOrderTitle),
        Text(l.preOrderSub, style: text.bodySmall),
        const SizedBox(height: 8),
        for (final (i, tube) in drawOrder.indexed)
          _TubeRow(index: i + 1, tube: tube, lang: lang),
        const SizedBox(height: 10),
        bullets(drawOrderNotes),
        LgSectionTitle(l.preHaemolysisTitle),
        bullets(haemolysisCauses),
        LgSectionTitle(l.preTourniquetTitle),
        bullets(tourniquetRules),
        LgSectionTitle(l.preIdTitle),
        bullets(identificationRules),
        const SizedBox(height: 6),
        LgNotice(l.preNotice),
        LgSectionTitle(l.calcSources),
        const CalcSourceTile(
          index: 1,
          ref: CalcRef(
            CalcSources.whoPhlebotomy2010,
            'Section 2.2.3, Table 2.3; 1.1.1; 7.1.3',
          ),
        ),
      ],
    );
  }
}

/// Probirka qatori: tartib raqami, qopqoq rangi belgisi (rang matn bilan
/// ham aytiladi — faqat rangga tayanmaydi), nomi va izohi.
class _TubeRow extends StatelessWidget {
  const _TubeRow({required this.index, required this.tube, required this.lang});

  final int index;
  final DrawTube tube;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final colors = tube.colors;
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 26,
              child: Text(
                '$index',
                style: text.titleSmall!.copyWith(color: p.brand),
              ),
            ),
            Container(
              width: 22,
              height: 22,
              margin: const EdgeInsets.only(right: 12, top: 1),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: p.line, width: 1.5),
                gradient: colors.isEmpty
                    ? null
                    : LinearGradient(
                        colors: colors.length == 1
                            ? [colors.first, colors.first]
                            : colors,
                        stops: colors.length == 1 ? null : const [0.5, 0.5],
                      ),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tube.name.of(lang), style: text.titleSmall),
                  Text(l.preCap(tube.cap.of(lang)), style: text.bodySmall),
                  if (tube.note != null)
                    Text(tube.note!.of(lang), style: text.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
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
          onTap: () => context.push('/lab/calibration?maker=Mindray'),
        ),
        LgRow(
          title: 'HUMAN',
          subtitle: l.insHumanSub,
          icon: Icons.precision_manufacturing_outlined,
          onTap: () => context.push('/lab/calibration?maker=HUMAN'),
        ),
        LgRow(
          title: l.insOther,
          subtitle: l.insOtherSub,
          icon: Icons.add_circle_outline_rounded,
          onTap: () => context.push('/lab/calibration?maker=other'),
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
                onTap: () => openInTab(context, '/tests/analyte/${card.id}'),
              ),
            );
          },
        ),
      ],
    );
  }
}
