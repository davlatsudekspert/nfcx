import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/widgets/lg_page.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../content/content_model.dart';
import '../content/ui/content_widgets.dart';
import 'calculators.dart';

/// Natijani lokal formatda ko'rsatish; juda kichik/katta qiymatlar
/// eksponensial ko'rinishda (0 ga yaxlitlanib "yo'qolmasligi" uchun).
String formatResult(double v, String locale, {int maxDecimals = 4}) {
  final abs = v.abs();
  if (abs != 0 && (abs < 0.001 || abs >= 1e9)) {
    return v.toStringAsExponential(3);
  }
  final f = NumberFormat.decimalPattern(locale)
    ..maximumFractionDigits = maxDecimals
    ..minimumFractionDigits = 0;
  return f.format(v);
}

class CalculatorsScreen extends StatelessWidget {
  const CalculatorsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.calcTitle,
      children: [
        LgRow(
          title: l.calcDilution,
          subtitle: l.calcDilutionSub,
          icon: Icons.water_drop_outlined,
          onTap: () => context.push('/lab/calculators/dilution'),
        ),
        LgRow(
          title: l.calcUnits,
          subtitle: l.calcUnitsSub,
          icon: Icons.swap_vert_rounded,
          onTap: () => context.push('/lab/calculators/units'),
          divider: false,
        ),
      ],
    );
  }
}

const _decimalKeyboard = TextInputType.numberWithOptions(decimal: true);

class DilutionScreen extends StatefulWidget {
  const DilutionScreen({super.key});

  @override
  State<DilutionScreen> createState() => _DilutionScreenState();
}

class _DilutionScreenState extends State<DilutionScreen> {
  final _c1 = TextEditingController(text: '10');
  final _c2 = TextEditingController(text: '2');
  final _v2 = TextEditingController(text: '100');
  DilutionResult? _result;

  @override
  void dispose() {
    for (final c in [_c1, _c2, _v2]) {
      c.dispose();
    }
    super.dispose();
  }

  void _calculate() {
    FocusScope.of(context).unfocus();
    setState(() {
      _result = solveDilution(
        stockConcentration: parseDecimal(_c1.text),
        targetConcentration: parseDecimal(_c2.text),
        finalVolume: parseDecimal(_v2.text),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final p = LgPalette.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final r = _result;
    return LgPage(
      title: l.calcDilution,
      subtitle: l.calcDilutionSub,
      children: [
        Align(alignment: Alignment.centerLeft, child: LgTag(l.calcLearningTag)),
        LgField(
          label: l.dilC1,
          controller: _c1,
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.dilC2,
          controller: _c2,
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.dilV2,
          controller: _v2,
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _calculate(),
        ),
        const SizedBox(height: 12),
        Text(l.dilNote, style: text.bodySmall),
        const SizedBox(height: 16),
        LgButton(label: l.dilCalculate, onPressed: _calculate),
        const SizedBox(height: 10),
        Semantics(
          liveRegion: true,
          child: switch (r) {
            null => const SizedBox.shrink(),
            DilutionResult(isOk: false) => LgNotice(switch (r.error!) {
              DilutionError.invalidInput => l.dilErrorInvalid,
              DilutionError.targetAboveStock => l.dilErrorC2GtC1,
              DilutionError.outOfRange => l.dilErrorRange,
            }, kind: NoticeKind.error),
            _ => LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.dilResult(formatResult(r.stockVolume!, locale)),
                    style: text.headlineSmall!.copyWith(color: p.brand),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    r.noDilutionNeeded ? l.dilNoDilution : l.dilResultBody,
                    style: text.bodyMedium,
                  ),
                  if (!r.noDilutionNeeded) ...[
                    const SizedBox(height: 4),
                    Text(
                      l.dilDiluent(formatResult(r.diluentVolume!, locale)),
                      style: text.bodyMedium,
                    ),
                  ],
                ],
              ),
            ),
          },
        ),
      ],
    );
  }
}

class UnitConverterScreen extends StatefulWidget {
  const UnitConverterScreen({super.key, this.analyteId});

  final String? analyteId;

  @override
  State<UnitConverterScreen> createState() => _UnitConverterScreenState();
}

class _UnitConverterScreenState extends State<UnitConverterScreen> {
  final _value = TextEditingController();
  String? _analyteId;
  MassUnit _from = MassUnit.mgPerDl;
  ConversionResult? _result;

  @override
  void initState() {
    super.initState();
    _analyteId = widget.analyteId;
  }

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  static String unitLabel(MassUnit u) => switch (u) {
    MassUnit.mgPerDl => 'mg/dL',
    MassUnit.mmolPerL => 'mmol/L',
  };

  void _convert(Analyte analyte) {
    FocusScope.of(context).unfocus();
    setState(() {
      _result = convertConcentration(
        value: parseDecimal(_value.text),
        from: _from,
        molarMass: analyte.conversion?.molarMass,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final p = LgPalette.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return LgPage(
      title: l.ucTitle,
      subtitle: l.ucSubtitle,
      children: [
        ContentGate(
          builder: (context, pack) {
            final convertible = pack.analytes
                .where((a) => a.conversion != null)
                .toList();
            final requested = widget.analyteId == null
                ? null
                : pack.analyte(widget.analyteId!);
            if (requested != null && requested.conversion == null ||
                convertible.isEmpty) {
              return LgStateView(
                kind: StateKind.unavailable,
                title: l.ucNotAvailable,
              );
            }
            final analyte =
                convertible.where((a) => a.id == _analyteId).firstOrNull ??
                convertible.first;
            final to = _from == MassUnit.mgPerDl
                ? MassUnit.mmolPerL
                : MassUnit.mgPerDl;
            final r = _result;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6, bottom: 8),
                  child: Text(l.ucAnalyte, style: text.titleSmall),
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final a in convertible)
                      LgChoiceChip(
                        label: a.names.of(lang),
                        selected: a.id == analyte.id,
                        onTap: () => setState(() {
                          _analyteId = a.id;
                          _result = null;
                        }),
                      ),
                  ],
                ),
                LgField(
                  label: '${l.ucValue} (${unitLabel(_from)})',
                  controller: _value,
                  keyboardType: _decimalKeyboard,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _convert(analyte),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: LgButton.secondary(
                    label: '${unitLabel(_from)} → ${unitLabel(to)}',
                    icon: Icons.swap_vert_rounded,
                    expand: false,
                    onPressed: () => setState(() {
                      _from = to;
                      _result = null;
                    }),
                  ),
                ),
                const SizedBox(height: 14),
                LgButton(
                  label: l.ucConvert,
                  onPressed: () => _convert(analyte),
                ),
                const SizedBox(height: 10),
                Semantics(
                  liveRegion: true,
                  child: switch (r) {
                    null => const SizedBox.shrink(),
                    ConversionResult(isOk: false) => LgNotice(
                      switch (r.error!) {
                        ConversionError.invalidInput => l.ucErrorInvalid,
                        ConversionError.outOfRange => l.ucErrorRange,
                        ConversionError.unsupported => l.ucNotAvailable,
                      },
                      kind: NoticeKind.error,
                    ),
                    _ => LgPanel(
                      child: Text(
                        '${formatResult(r.value!, locale, maxDecimals: to == MassUnit.mmolPerL ? 2 : 1)} ${unitLabel(to)}',
                        style: text.headlineSmall!.copyWith(color: p.brand),
                      ),
                    ),
                  },
                ),
                Text(
                  l.ucNote(formatResult(analyte.conversion!.molarMass, locale)),
                  style: text.bodySmall,
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
