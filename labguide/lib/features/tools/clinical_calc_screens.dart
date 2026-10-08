import 'package:material_ui/material_ui.dart';

import '../../app/widgets/lg_page.dart';
import '../../app/widgets/links.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import 'calc_info.dart';
import 'calculators.dart';
import 'clinical_calculators.dart';
import 'tool_screens.dart';

/// Kalkulyator maydoni: birlik tanlovi (bir nechta bo'lsa), qat'iy birlik
/// (yorliqda) yoki boshqa maydon birligiga bog'langan birlik.
class _Spec {
  const _Spec(
    this.field, {
    this.units = const [],
    this.fixedUnit,
    this.unitFrom,
    this.optional = false,
  });

  final CalcField field;
  final List<LabUnit> units;
  final String? fixedUnit;
  final CalcField? unitFrom;
  final bool optional;
}

const _mmol = 'mmol/L';

List<_Spec> _specsOf(ClinicalCalc calc) => switch (calc) {
  // SI birliklari birinchi: O'zbekiston/MDH laboratoriyalari shuni beradi.
  ClinicalCalc.egfr => const [
    _Spec(CalcField.creatinine, units: [Units.creatUmolL, Units.creatMgDl]),
    _Spec(CalcField.age),
  ],
  ClinicalCalc.acr => const [
    _Spec(CalcField.urineAlbumin, units: [Units.uAlbMgL, Units.uAlbMgDl]),
    _Spec(
      CalcField.urineCreatinine,
      units: [Units.uCreatMmolL, Units.uCreatMgDl],
    ),
  ],
  ClinicalCalc.anionGap => const [
    _Spec(CalcField.sodium, fixedUnit: _mmol),
    _Spec(CalcField.chloride, fixedUnit: _mmol),
    _Spec(CalcField.bicarbonate, fixedUnit: _mmol),
    _Spec(CalcField.potassium, fixedUnit: _mmol, optional: true),
    _Spec(
      CalcField.albumin,
      units: [Units.albGL, Units.albGDl],
      optional: true,
    ),
    _Spec(CalcField.normalAlbumin, unitFrom: CalcField.albumin, optional: true),
  ],
  ClinicalCalc.calcium => const [
    _Spec(CalcField.calcium, units: [Units.caMmolL, Units.caMgDl]),
    _Spec(CalcField.albumin, units: [Units.albGL, Units.albGDl]),
  ],
  ClinicalCalc.ldl => const [
    _Spec(
      CalcField.totalCholesterol,
      units: [Units.cholMmolL, Units.lipidMgDl],
    ),
    _Spec(CalcField.hdl, unitFrom: CalcField.totalCholesterol),
    _Spec(CalcField.triglycerides, units: [Units.tgMmolL, Units.lipidMgDl]),
  ],
  ClinicalCalc.osmolality => const [
    _Spec(CalcField.sodium, fixedUnit: _mmol),
    _Spec(CalcField.glucose, units: [Units.glucoseMmolL, Units.glucoseMgDl]),
    _Spec(CalcField.urea, units: [Units.ureaMmolL, Units.bunMgDl]),
    _Spec(CalcField.measuredOsmolality, fixedUnit: 'mOsm/kg', optional: true),
  ],
  ClinicalCalc.hba1c => const [
    _Spec(CalcField.hba1c, units: [Units.ngsp, Units.ifcc]),
  ],
};

String calcTitle(ClinicalCalc c, AppLocalizations l) => switch (c) {
  ClinicalCalc.egfr => l.calcEgfr,
  ClinicalCalc.acr => l.calcAcr,
  ClinicalCalc.anionGap => l.calcAnionGap,
  ClinicalCalc.calcium => l.calcCalcium,
  ClinicalCalc.ldl => l.calcLdl,
  ClinicalCalc.osmolality => l.calcOsmo,
  ClinicalCalc.hba1c => l.calcHba1c,
};

String calcSubtitle(ClinicalCalc c, AppLocalizations l) => switch (c) {
  ClinicalCalc.egfr => l.calcEgfrSub,
  ClinicalCalc.acr => l.calcAcrSub,
  ClinicalCalc.anionGap => l.calcAnionGapSub,
  ClinicalCalc.calcium => l.calcCalciumSub,
  ClinicalCalc.ldl => l.calcLdlSub,
  ClinicalCalc.osmolality => l.calcOsmoSub,
  ClinicalCalc.hba1c => l.calcHba1cSub,
};

IconData calcIcon(ClinicalCalc c) => switch (c) {
  ClinicalCalc.egfr => Icons.filter_alt_outlined,
  ClinicalCalc.acr => Icons.opacity_rounded,
  ClinicalCalc.anionGap => Icons.balance_outlined,
  ClinicalCalc.calcium => Icons.hexagon_outlined,
  ClinicalCalc.ldl => Icons.monitor_heart_outlined,
  ClinicalCalc.osmolality => Icons.waves,
  ClinicalCalc.hba1c => Icons.bloodtype_outlined,
};

String calcRoute(ClinicalCalc c) => switch (c) {
  ClinicalCalc.egfr => 'egfr',
  ClinicalCalc.acr => 'acr',
  ClinicalCalc.anionGap => 'anion-gap',
  ClinicalCalc.calcium => 'calcium',
  ClinicalCalc.ldl => 'ldl',
  ClinicalCalc.osmolality => 'osmolality',
  ClinicalCalc.hba1c => 'hba1c',
};

String fieldName(CalcField f, AppLocalizations l) => switch (f) {
  CalcField.creatinine => l.fieldCreatinine,
  CalcField.age => l.fieldAge,
  CalcField.sex => l.fieldSex,
  CalcField.sodium => l.fieldSodium,
  CalcField.chloride => l.fieldChloride,
  CalcField.bicarbonate => l.fieldBicarbonate,
  CalcField.potassium => l.fieldPotassium,
  CalcField.albumin => l.fieldAlbumin,
  CalcField.normalAlbumin => l.fieldNormalAlbumin,
  CalcField.calcium => l.fieldCalcium,
  CalcField.totalCholesterol => l.fieldTotalCholesterol,
  CalcField.hdl => l.fieldHdl,
  CalcField.triglycerides => l.fieldTriglycerides,
  CalcField.glucose => l.fieldGlucose,
  CalcField.urea => l.fieldUrea,
  CalcField.measuredOsmolality => l.fieldMeasuredOsmolality,
  CalcField.hba1c => l.fieldHba1c,
  CalcField.urineAlbumin => l.fieldUrineAlbumin,
  CalcField.urineCreatinine => l.fieldUrineCreatinine,
};

const _decimalKeyboard = TextInputType.numberWithOptions(decimal: true);

class ClinicalCalcScreen extends StatefulWidget {
  const ClinicalCalcScreen({super.key, required this.calc});

  final ClinicalCalc calc;

  @override
  State<ClinicalCalcScreen> createState() => _ClinicalCalcScreenState();
}

class _ClinicalCalcScreenState extends State<ClinicalCalcScreen> {
  late final List<_Spec> _specs = _specsOf(widget.calc);
  late final Map<CalcField, TextEditingController> _ctrl = {
    for (final s in _specs) s.field: TextEditingController(),
  };
  late final Map<CalcField, LabUnit> _unit = {
    for (final s in _specs)
      if (s.units.isNotEmpty) s.field: s.units.first,
  };
  Sex? _sex;
  CalcOutcome<Object?>? _outcome;

  /// Natija qaysi kiritmalardan hisoblangan — natija ostida ko'rsatiladi.
  Map<CalcField, double?> _inputs = const {};

  /// Maydon o'zgarsa eski natija ko'rinib qolmasin.
  void _invalidate() {
    if (_outcome != null) setState(() => _outcome = null);
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    super.dispose();
  }

  LabUnit _unitOf(CalcField f) {
    final spec = _specs.firstWhere((s) => s.field == f);
    if (spec.unitFrom != null) return _unitOf(spec.unitFrom!);
    return _unit[f] ?? LabUnit(spec.fixedUnit ?? '', 1);
  }

  void _calculate() {
    FocusScope.of(context).unfocus();
    final values = <CalcField, double?>{};
    CalcOutcome<Object?>? invalid;
    for (final s in _specs) {
      final raw = _ctrl[s.field]!.text;
      final v = parseDecimal(raw);
      // Matn bor, lekin son emas — ixtiyoriy maydonda ham xato.
      if (raw.trim().isNotEmpty && v == null) {
        invalid ??= CalcFail(CalcIssue.missing, field: s.field);
      }
      values[s.field] = v;
    }
    setState(() {
      _outcome = invalid ?? _compute(values);
      _inputs = values;
    });
  }

  CalcOutcome<Object?> _compute(Map<CalcField, double?> v) =>
      switch (widget.calc) {
        ClinicalCalc.egfr => egfrCkdEpi2021(
          creatinine: v[CalcField.creatinine],
          unit: _unitOf(CalcField.creatinine),
          age: v[CalcField.age],
          sex: _sex,
        ),
        ClinicalCalc.acr => albuminCreatinineRatio(
          albumin: v[CalcField.urineAlbumin],
          albuminUnit: _unitOf(CalcField.urineAlbumin),
          creatinine: v[CalcField.urineCreatinine],
          creatinineUnit: _unitOf(CalcField.urineCreatinine),
        ),
        ClinicalCalc.anionGap => anionGap(
          sodium: v[CalcField.sodium],
          chloride: v[CalcField.chloride],
          bicarbonate: v[CalcField.bicarbonate],
          potassium: v[CalcField.potassium],
          albumin: v[CalcField.albumin],
          normalAlbumin: v[CalcField.normalAlbumin],
          albuminUnit: _unitOf(CalcField.albumin),
        ),
        ClinicalCalc.calcium => correctedCalciumPayne(
          calcium: v[CalcField.calcium],
          calciumUnit: _unitOf(CalcField.calcium),
          albumin: v[CalcField.albumin],
          albuminUnit: _unitOf(CalcField.albumin),
        ),
        ClinicalCalc.ldl => ldlCholesterol(
          totalCholesterol: v[CalcField.totalCholesterol],
          hdl: v[CalcField.hdl],
          triglycerides: v[CalcField.triglycerides],
          cholesterolUnit: _unitOf(CalcField.totalCholesterol),
          tgUnit: _unitOf(CalcField.triglycerides),
        ),
        ClinicalCalc.osmolality => calculatedOsmolality(
          sodium: v[CalcField.sodium],
          glucose: v[CalcField.glucose],
          glucoseUnit: _unitOf(CalcField.glucose),
          urea: v[CalcField.urea],
          ureaUnit: _unitOf(CalcField.urea),
          measured: v[CalcField.measuredOsmolality],
        ),
        ClinicalCalc.hba1c => hba1c(
          value: v[CalcField.hba1c],
          unit: _unitOf(CalcField.hba1c),
        ),
      };

  String _label(_Spec s, AppLocalizations l) {
    // Tanlangan birlik ham yorliqda — ekran o'quvchi va ko'z uchun.
    final unit =
        s.fixedUnit ??
        (s.unitFrom != null || s.units.isNotEmpty
            ? _unitOf(s.field).label
            : null);
    return [
          fieldName(s.field, l),
          if (unit != null && unit.isNotEmpty) unit,
        ].join(', ') +
        (s.optional ? ' · ${l.calcOptional}' : '');
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final info = calcInfo[widget.calc]!;
    final outcome = _outcome;
    return LgPage(
      title: calcTitle(widget.calc, l),
      subtitle: calcSubtitle(widget.calc, l),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: LgTag(l.calcFormulaTag, icon: Icons.menu_book_outlined),
        ),
        for (final (i, s) in _specs.indexed) ...[
          LgField(
            label: _label(s, l),
            controller: _ctrl[s.field],
            keyboardType: _decimalKeyboard,
            textInputAction: i == _specs.length - 1
                ? TextInputAction.done
                : TextInputAction.next,
            onSubmitted: i == _specs.length - 1 ? (_) => _calculate() : null,
            onChanged: (_) => _invalidate(),
          ),
          if (s.units.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Semantics(
                container: true,
                label: l.calcUnitGroup(fieldName(s.field, l)),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final u in s.units)
                      LgChoiceChip(
                        label: u.label,
                        selected: identical(_unit[s.field], u),
                        onTap: () => setState(() {
                          _unit[s.field] = u;
                          _outcome = null;
                        }),
                      ),
                  ],
                ),
              ),
            ),
        ],
        if (widget.calc == ClinicalCalc.egfr) ...[
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 7),
            child: Text(
              l.fieldSex,
              style: text.titleSmall!.copyWith(fontSize: 14),
            ),
          ),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final (sex, label) in [
                (Sex.female, l.sexFemale),
                (Sex.male, l.sexMale),
              ])
                LgChoiceChip(
                  label: label,
                  selected: _sex == sex,
                  onTap: () => setState(() {
                    _sex = sex;
                    _outcome = null;
                  }),
                ),
            ],
          ),
        ],
        const SizedBox(height: 18),
        LgButton(label: l.dilCalculate, onPressed: _calculate),
        const SizedBox(height: 10),
        Semantics(
          liveRegion: true,
          child: outcome == null
              ? const SizedBox.shrink()
              : _ResultView(
                  calc: widget.calc,
                  outcome: outcome,
                  unitOf: _unitOf,
                  inputs: [
                    for (final s in _specs)
                      if (_inputs[s.field] case final v?) (s.field, v),
                  ],
                ),
        ),
        const SizedBox(height: 6),
        LgNotice(l.calcNotDiagnosis, kind: NoticeKind.info),
        LgSectionTitle(l.calcFormula),
        for (final f in info.formula)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(f.of(lang), style: text.bodyMedium),
          ),
        LgSectionTitle(l.calcLimitations),
        for (final x in info.limitations)
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
        LgSectionTitle(l.calcSources),
        for (final (i, r) in info.refs.indexed)
          CalcSourceTile(index: i + 1, ref: r),
      ],
    );
  }
}

/// Natija yoki aniq sababli xato. Rang bilan “norma/patologiya” yo'q.
class _ResultView extends StatelessWidget {
  const _ResultView({
    required this.calc,
    required this.outcome,
    required this.unitOf,
    this.inputs = const [],
  });

  final ClinicalCalc calc;
  final CalcOutcome<Object?> outcome;
  final LabUnit Function(CalcField) unitOf;

  /// Hisobda ishlatilgan kiritmalar (maydon, qiymat) — tekshirish uchun.
  final List<(CalcField, double)> inputs;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    String n(double v, int d) =>
        formatResult(roundHalfUp(v, d), locale, maxDecimals: d);

    return switch (outcome) {
      final CalcFail<Object?> f => LgNotice(
        calcErrorText(l, f, unitOf, locale),
        kind: NoticeKind.error,
      ),
      CalcOk(:final value) => _panel(context, l, value, n, locale),
    };
  }

  Widget _panel(
    BuildContext context,
    AppLocalizations l,
    Object? value,
    String Function(double, int) n,
    String locale,
  ) {
    final text = Theme.of(context).textTheme;
    final p = LgPalette.of(context);
    Widget headline(String s) =>
        Text(s, style: text.headlineSmall!.copyWith(color: p.brand));
    Widget note(String s) => Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Text(s, style: text.bodySmall),
    );
    String sub(CalcOutcome<double> o, String unit, int d, String tgLimitMsg) =>
        switch (o) {
          CalcOk(:final value) => '${n(value, d)} $unit',
          CalcFail(issue: CalcIssue.outsideValidity) => tgLimitMsg,
          CalcFail() => l.errNotPositive,
        };
    // Ixtiyoriy qator: natija — oddiy ko'rsatkich; xato — kichik
    // ogohlantirish (asosiy natijadan yirik ko'rinmasin).
    Widget line(String label, CalcOutcome<double> o, String unit, int d) =>
        switch (o) {
          CalcOk(:final value) => LgMetric(
            label: label,
            value: '${n(value, d)} $unit',
          ),
          final CalcFail<double> f => Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: p.line.withValues(alpha: 0.7)),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: text.bodyMedium),
                const SizedBox(height: 2),
                Text(
                  calcErrorText(l, f, unitOf, locale),
                  style: text.bodySmall!.copyWith(color: p.amber),
                ),
              ],
            ),
          ),
        };
    final checks = <String>[];

    final children = <Widget>[];
    switch (value) {
      case final EgfrResult r:
        children.addAll([
          Text('eGFR', style: text.titleSmall),
          headline('${n(r.egfr, 0)} mL/min/1.73 m²'),
          const SizedBox(height: 8),
          LgTag(l.resGfrCategory(r.category.code), tone: LgTone.neutral),
        ]);
      case final AcrResult r:
        final (main, other) = r.categorizedInSi
            ? ('${n(r.mgPerMmol, 1)} mg/mmol', '${n(r.mgPerG, 0)} mg/g')
            : ('${n(r.mgPerG, 0)} mg/g', '${n(r.mgPerMmol, 1)} mg/mmol');
        children.addAll([
          Text('ACR', style: text.titleSmall),
          headline(main),
          LgMetric(label: 'ACR', value: other),
          const SizedBox(height: 8),
          LgTag(l.resAlbCategory(r.category.code), tone: LgTone.neutral),
          note(
            r.categorizedInSi ? l.resCategoryBasisSi : l.resCategoryBasisConv,
          ),
        ]);
      case final AnionGapResult r:
        if (r.gap < 0) checks.add(l.calcNegativeCheck(l.resAnionGap));
        children.addAll([
          Text(l.resAnionGap, style: text.titleSmall),
          headline('${n(r.gap, 1)} mmol/L'),
          if (r.gapWithPotassium case final o?)
            line(l.resAnionGapK, o, 'mmol/L', 1),
          if (r.albuminCorrected case final o?)
            line(l.resAnionGapAlb, o, 'mmol/L', 1),
        ]);
      case final LipidResult r:
        final unit = unitOf(CalcField.totalCholesterol);
        final tgUnit = unitOf(CalcField.triglycerides);
        final d = unit.label == 'mg/dL' ? 0 : 2;
        String limit(CalcOutcome<double> o) => switch (o) {
          CalcFail(:final limit?) =>
            '${formatResult(roundHalfUp(limit.max, 1), locale, maxDecimals: 1)} '
                '${tgUnit.label}',
          _ => '',
        };
        children.addAll([
          Text(l.resNonHdl, style: text.titleSmall),
          headline('${n(r.nonHdl, d)} ${unit.label}'),
          LgMetric(
            label: l.resLdlSampson,
            value: sub(
              r.sampson,
              unit.label,
              d,
              l.errSampsonTg(limit(r.sampson)),
            ),
          ),
          LgMetric(
            label: l.resLdlFriedewald,
            value: sub(
              r.friedewald,
              unit.label,
              d,
              l.errFriedewaldTg(limit(r.friedewald)),
            ),
          ),
        ]);
      case final OsmolalityResult r:
        if (r.gap case final g? when g < 0) {
          checks.add(l.calcNegativeCheck(l.resOsmGap));
        }
        children.addAll([
          Text(l.resOsmCalc, style: text.titleSmall),
          headline('${n(r.calculated, 1)} mOsm/kg'),
          if (r.gap != null)
            LgMetric(label: l.resOsmGap, value: '${n(r.gap!, 1)} mOsm/kg'),
        ]);
      case final Hba1cResult r:
        children.addAll([
          Text('HbA1c', style: text.titleSmall),
          headline('${n(r.ngsp, 1)} % · ${n(r.ifcc, 0)} mmol/mol'),
          LgMetric(
            label: l.resEag,
            value: switch (r.eag) {
              CalcOk(:final value) =>
                '${n(value.mgDl, 0)} mg/dL · ${n(value.mmolL, 1)} mmol/L',
              final CalcFail<EagResult> f => calcErrorText(
                l,
                f,
                unitOf,
                locale,
              ),
            },
          ),
        ]);
      case final double ca:
        final unit = unitOf(CalcField.calcium);
        children.addAll([
          Text(l.resCorrectedCa, style: text.titleSmall),
          headline('${n(ca, unit.label == 'mg/dL' ? 1 : 2)} ${unit.label}'),
        ]);
      default:
        return const SizedBox.shrink();
    }
    // Birlik chalkashligiga shubha (masalan glyukoza 90 “mmol/L”).
    for (final (field, v) in inputs) {
      final unit = unitOf(field);
      if (unitLooksSwapped(field, unit, v)) {
        checks.add(l.calcUnitCheck(fieldName(field, l), n(v, 2), unit.label));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LgPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...children,
              if (inputs.isNotEmpty)
                note(
                  l.calcInputs(
                    [
                      for (final (field, v) in inputs)
                        [
                          fieldName(field, l),
                          n(v, 2),
                          if (unitOf(field).label.isNotEmpty)
                            unitOf(field).label,
                        ].join(' '),
                    ].join(' · '),
                  ),
                ),
            ],
          ),
        ),
        for (final c in checks) ...[
          const SizedBox(height: 8),
          LgNotice(c, kind: NoticeKind.warning),
        ],
      ],
    );
  }
}

/// Xato matni: qaysi maydon, nima uchun va (kerak bo'lsa) qabul oralig'i.
String calcErrorText(
  AppLocalizations l,
  CalcFail<Object?> f,
  LabUnit Function(CalcField) unitOf,
  String locale,
) {
  String num(double v) =>
      formatResult(roundHalfUp(v, 2), locale, maxDecimals: 2);
  final field = f.field;
  switch (f.issue) {
    case CalcIssue.missing:
      if (field == CalcField.sex) return l.errSexMissing;
      return l.errCalcMissing(field == null ? '' : fieldName(field, l));
    case CalcIssue.implausible:
      final unit = field == null ? '' : unitOf(field).label;
      final lim = f.limit;
      return l.errCalcImplausible(
        field == null ? '' : fieldName(field, l),
        lim == null ? '' : num(lim.min),
        lim == null ? '' : num(lim.max),
        unit.isEmpty ? '' : ' $unit',
      );
    case CalcIssue.outsideValidity:
      if (field == CalcField.age) return l.errEgfrAge;
      if (field == CalcField.hba1c && f.limit != null) {
        final unit = unitOf(CalcField.hba1c).label;
        return l.errEagRange('${num(f.limit!.min)}–${num(f.limit!.max)} $unit');
      }
      return l.errNotPositive;
    case CalcIssue.inconsistent:
      if (field == CalcField.hdl) return l.errHdlGeTc;
      return l.errNotPositive;
  }
}

class CalcSourceTile extends StatelessWidget {
  const CalcSourceTile({super.key, required this.index, required this.ref});

  final int index;
  final CalcRef ref;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final url = ref.source.url;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: () => openExternalLink(context, url),
        onLongPress: () => copyLink(context, url),
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTap),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '[$index] ${ref.source.citation}',
                        style: text.titleSmall!.copyWith(
                          color: p.brand,
                          decoration: TextDecoration.underline,
                          decorationColor: p.brand.withValues(alpha: 0.5),
                        ),
                      ),
                      if (ref.locator.isNotEmpty)
                        Text(ref.locator, style: text.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Icon(Icons.open_in_new_rounded, size: 18, color: p.brand),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
