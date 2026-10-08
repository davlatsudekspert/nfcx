import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/app_scope.dart';
import '../../app/widgets/lg_page.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../tools/calculators.dart';
import '../tools/clinical_calculators.dart';
import '../tools/tool_screens.dart';
import 'levey_jennings_chart.dart';
import 'qc_controller.dart';
import 'qc_model.dart';
import 'qc_rules.dart';

const _decimalKeyboard = TextInputType.numberWithOptions(
  decimal: true,
  signed: true,
);

/// Grafikda ko'rsatiladigan oxirgi seriyalar soni.
const kQcChartRuns = 30;

String verdictLabel(QcVerdict v, AppLocalizations l) => switch (v) {
  QcVerdict.accept => l.qcAccept,
  QcVerdict.warning => l.qcWarning,
  QcVerdict.reject => l.qcReject,
};

String _num(double v, String locale) =>
    formatResult(roundHalfUp(v, 3), locale, maxDecimals: 3);

String _z(double z, String locale) {
  final s = formatResult(roundHalfUp(z, 2), locale, maxDecimals: 2);
  return z > 0 ? '+$s' : s;
}

class QcScreen extends StatelessWidget {
  const QcScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final qc = context.services.qc;
    return ListenableBuilder(
      listenable: qc,
      builder: (context, _) {
        final data = qc.data;
        return LgPage(
          title: l.qcTitle,
          children: [
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.qcChartTitle, style: text.titleMedium),
                  const SizedBox(height: 6),
                  Text(l.qcIntro, style: text.bodyMedium),
                ],
              ),
            ),
            if (qc.loadError != null)
              LgStateView(kind: StateKind.error, title: l.qcLoadError)
            else if (data.sets.isEmpty)
              LgStateView(
                kind: StateKind.empty,
                title: l.qcEmptyTitle,
                message: l.qcEmptyBody,
              )
            else
              for (final (i, set) in data.sets.indexed)
                _SetRow(
                  set: set,
                  runs: data.runsOf(set.id),
                  divider: i < data.sets.length - 1,
                ),
            if (qc.loadError == null) ...[
              const SizedBox(height: 14),
              LgButton(
                label: l.qcAddSet,
                icon: Icons.add_rounded,
                onPressed: () => context.push('/lab/qc/new'),
              ),
            ],
            const SizedBox(height: 14),
            Text(l.qcRulesSource, style: text.bodySmall),
          ],
        );
      },
    );
  }
}

class _SetRow extends StatelessWidget {
  const _SetRow({required this.set, required this.runs, required this.divider});

  final QcSet set;
  final List<QcRun> runs;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final last = runs.isEmpty ? null : evaluateRuns(set, runs).last;
    final parts = [
      if (set.unit.isNotEmpty) set.unit,
      l.qcLevelsCount(set.levels.length),
      l.qcRunsCount(runs.length),
      if (last != null)
        [
          verdictLabel(last.verdict, l),
          if (last.rules.isNotEmpty) last.rules.map((r) => r.code).join(', '),
        ].join(' · '),
    ];
    return LgRow(
      title: set.name,
      subtitle: parts.join(' · '),
      icon: switch (last?.verdict) {
        QcVerdict.reject => Icons.report_outlined,
        QcVerdict.warning => Icons.warning_amber_rounded,
        _ => Icons.show_chart_rounded,
      },
      onTap: () => context.push('/lab/qc/set/${set.id}'),
      divider: divider,
    );
  }
}

/// Yangi nazorat to'plami: test, birlik, maqsad manbai va 1–3 daraja.
class QcNewSetScreen extends StatefulWidget {
  const QcNewSetScreen({super.key});

  @override
  State<QcNewSetScreen> createState() => _QcNewSetScreenState();
}

class _LevelFields {
  final lot = TextEditingController();
  final mean = TextEditingController();
  final sd = TextEditingController();

  void dispose() {
    lot.dispose();
    mean.dispose();
    sd.dispose();
  }
}

class _QcNewSetScreenState extends State<QcNewSetScreen> {
  final _name = TextEditingController();
  final _unit = TextEditingController();
  final _levels = [_LevelFields(), _LevelFields()];
  QcTargetSource _source = QcTargetSource.laboratory;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _unit.dispose();
    for (final f in _levels) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    if (_name.text.trim().isEmpty) {
      setState(() => _error = l.qcErrName);
      return;
    }
    final levels = <({String label, String lot, double mean, double sd})>[];
    for (final (i, f) in _levels.indexed) {
      final mean = parseDecimal(f.mean.text);
      final sd = parseDecimal(f.sd.text);
      if (mean == null || sd == null || !mean.isFinite || !(sd > 0)) {
        setState(() => _error = l.qcErrLevel('${i + 1}'));
        return;
      }
      levels.add((label: '${i + 1}', lot: f.lot.text, mean: mean, sd: sd));
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    final set = await context.services.qc.addSet(
      name: _name.text,
      unit: _unit.text,
      targetSource: _source,
      levels: levels,
    );
    if (!mounted) return;
    context.pushReplacement('/lab/qc/set/${set.id}');
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: l.qcAddSet,
      children: [
        LgField(
          label: l.qcSetName,
          controller: _name,
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.qcUnit,
          controller: _unit,
          textInputAction: TextInputAction.next,
        ),
        Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 7),
          child: Text(
            l.qcTargetSource,
            style: text.titleSmall!.copyWith(fontSize: 14),
          ),
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final (s, label) in [
              (QcTargetSource.laboratory, l.qcSourceLab),
              (QcTargetSource.manufacturer, l.qcSourceManufacturer),
            ])
              LgChoiceChip(
                label: label,
                selected: _source == s,
                onTap: () => setState(() => _source = s),
              ),
          ],
        ),
        if (_source == QcTargetSource.manufacturer) ...[
          const SizedBox(height: 10),
          LgNotice(l.qcManufacturerWarning, kind: NoticeKind.warning),
        ],
        for (final (i, f) in _levels.indexed) ...[
          LgSectionTitle(
            l.qcLevel('${i + 1}'),
            trailing: _levels.length > 1
                ? IconButton(
                    tooltip: l.qcRemoveLevel,
                    icon: const Icon(Icons.remove_circle_outline_rounded),
                    onPressed: () => setState(() {
                      _levels.removeAt(i).dispose();
                    }),
                  )
                : null,
          ),
          LgField(label: l.qcLot, controller: f.lot),
          LgField(
            label: l.qcMean,
            controller: f.mean,
            keyboardType: _decimalKeyboard,
          ),
          LgField(
            label: l.qcSd,
            controller: f.sd,
            keyboardType: _decimalKeyboard,
          ),
        ],
        if (_levels.length < 3) ...[
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: LgButton.secondary(
              label: l.qcAddLevel,
              icon: Icons.add_rounded,
              expand: false,
              onPressed: () => setState(() => _levels.add(_LevelFields())),
            ),
          ),
        ],
        const SizedBox(height: 18),
        if (_error != null) ...[
          LgNotice(_error!, kind: NoticeKind.error),
          const SizedBox(height: 10),
        ],
        LgButton(label: l.qcSave, busy: _busy, onPressed: _save),
        const SizedBox(height: 12),
        Text(l.qcTargetNote, style: text.bodySmall),
      ],
    );
  }
}

class QcSetScreen extends StatefulWidget {
  const QcSetScreen({super.key, required this.setId});

  final String setId;

  @override
  State<QcSetScreen> createState() => _QcSetScreenState();
}

class _QcSetScreenState extends State<QcSetScreen> {
  final Map<String, TextEditingController> _values = {};
  final _note = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _values.values) {
      c.dispose();
    }
    _note.dispose();
    super.dispose();
  }

  TextEditingController _ctrl(String levelId) =>
      _values.putIfAbsent(levelId, TextEditingController.new);

  Future<void> _addRun(QcSet set) async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    final values = <String, double>{};
    for (final level in set.levels) {
      final raw = _ctrl(level.id).text;
      if (raw.trim().isEmpty) continue;
      final v = parseDecimal(raw);
      if (v == null) {
        setState(() => _error = l.qcErrRunInvalid(level.label));
        return;
      }
      values[level.id] = v;
    }
    if (values.isEmpty) {
      setState(() => _error = l.qcErrRunEmpty);
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    await context.services.qc.addRun(set.id, values, note: _note.text);
    if (!mounted) return;
    for (final c in _values.values) {
      c.clear();
    }
    _note.clear();
    setState(() => _busy = false);
  }

  Future<bool> _confirm(String title) async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(l.qcConfirmDelete),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l.actionDelete),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final qc = context.services.qc;
    return ListenableBuilder(
      listenable: qc,
      builder: (context, _) {
        final set = qc.data.set(widget.setId);
        if (set == null) {
          return LgPage(
            title: l.qcTitle,
            children: [
              LgStateView(kind: StateKind.empty, title: l.qcSetMissing),
            ],
          );
        }
        final results = evaluateRuns(set, qc.data.runsOf(set.id));
        return LgPage(
          title: set.name,
          subtitle: [
            if (set.unit.isNotEmpty) set.unit,
            switch (set.targetSource) {
              QcTargetSource.laboratory => l.qcSourceLab,
              QcTargetSource.manufacturer => l.qcSourceManufacturer,
            },
          ].join(' · '),
          children: _body(context, l, qc, set, results),
        );
      },
    );
  }

  List<Widget> _body(
    BuildContext context,
    AppLocalizations l,
    QcController qc,
    QcSet set,
    List<QcRunResult> results,
  ) {
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final dateFmt = DateFormat.yMd(locale).add_Hm();
    final last = results.isEmpty ? null : results.last;
    final shown = results.length > kQcChartRuns
        ? results.sublist(results.length - kQcChartRuns)
        : results;

    LjMark markFor(QcRunResult r, String levelId) {
      final involved = r.violations.where((v) => v.levelIds.contains(levelId));
      if (involved.any((v) => v.rule.rejects)) return LjMark.reject;
      if (involved.isNotEmpty) return LjMark.warning;
      return LjMark.ok;
    }

    return [
      // Oxirgi seriya xulosasi.
      LgSectionTitle(l.qcLatestRun),
      if (last == null)
        Text(l.qcNoRunsYet, style: text.bodyMedium)
      else
        Semantics(
          liveRegion: true,
          child: LgNotice(
            [
              dateFmt.format(last.run.at),
              for (final v in last.violations) qcRuleText[v.rule]!.of(lang),
              if (last.violations.isEmpty) l.qcAcceptBody,
            ].join('\n\n'),
            title: verdictLabel(last.verdict, l),
            kind: switch (last.verdict) {
              QcVerdict.accept => NoticeKind.info,
              QcVerdict.warning => NoticeKind.warning,
              QcVerdict.reject => NoticeKind.error,
            },
          ),
        ),

      // Levey–Jennings: har bir daraja alohida.
      for (final level in set.levels) ...[
        LgSectionTitle(
          [
            l.qcLevel(level.label),
            if (level.lot.isNotEmpty) '${l.qcLot} ${level.lot}',
          ].join(' · '),
        ),
        Text(
          'x̄ ${_num(level.mean, locale)} · SD ${_num(level.sd, locale)}'
          '${set.unit.isEmpty ? '' : ' ${set.unit}'}',
          style: text.bodySmall,
        ),
        const SizedBox(height: 6),
        LgPanel(
          child: LeveyJenningsChart(
            mean: level.mean,
            sd: level.sd,
            points: [
              for (final r in shown)
                if (r.run.values[level.id] case final v?)
                  LjPoint(v, markFor(r, level.id)),
            ],
            semanticLabel: l.qcChartSemantics(
              level.label,
              shown.where((r) => r.run.values.containsKey(level.id)).length,
            ),
          ),
        ),
        if (QcStats.of([for (final r in results) ?r.run.values[level.id]])
            case final s when s.n >= 2)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              '${l.qcStats}: n = ${s.n} · x̄ ${_num(s.mean!, locale)} · '
              'SD ${_num(s.sd!, locale)}'
              '${s.cv == null ? '' : ' · CV ${formatResult(roundHalfUp(s.cv!, 1), locale, maxDecimals: 1)} %'}',
              style: text.bodySmall,
            ),
          ),
      ],
      const SizedBox(height: 6),
      Text(l.qcChartLegend, style: text.bodySmall),

      // Yangi seriya.
      LgSectionTitle(l.qcAddRun),
      for (final level in set.levels)
        LgField(
          label: [
            l.qcLevel(level.label),
            if (set.unit.isNotEmpty) set.unit,
          ].join(', '),
          controller: _ctrl(level.id),
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.next,
        ),
      LgField(label: l.qcNote, controller: _note, maxLength: 200),
      const SizedBox(height: 12),
      if (_error != null) ...[
        LgNotice(_error!, kind: NoticeKind.error),
        const SizedBox(height: 10),
      ],
      LgButton(label: l.qcSaveRun, busy: _busy, onPressed: () => _addRun(set)),

      // Seriyalar tarixi (oxirgisi birinchi).
      if (results.isNotEmpty) ...[
        LgSectionTitle(l.qcRunHistory),
        for (final r in results.reversed.take(50))
          _RunTile(
            set: set,
            result: r,
            date: dateFmt.format(r.run.at),
            locale: locale,
            onDelete: () async {
              if (await _confirm(l.qcDeleteRun)) {
                await qc.deleteRun(set.id, r.run.id);
              }
            },
          ),
      ],
      const SizedBox(height: 18),
      LgButton.secondary(
        label: l.qcDeleteSet,
        icon: Icons.delete_outline_rounded,
        onPressed: () async {
          final router = GoRouter.of(context);
          if (await _confirm(l.qcDeleteSet)) {
            await qc.deleteSet(set.id);
            router.pop();
          }
        },
      ),
      const SizedBox(height: 14),
      Text(l.qcRulesSource, style: text.bodySmall),
    ];
  }
}

class _RunTile extends StatelessWidget {
  const _RunTile({
    required this.set,
    required this.result,
    required this.date,
    required this.locale,
    required this.onDelete,
  });

  final QcSet set;
  final QcRunResult result;
  final String date;
  final String locale;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final r = result;
    final values = [
      for (final level in set.levels)
        if (r.run.values[level.id] case final v?)
          '${level.label}: ${_num(v, locale)} '
              '(z ${_z(r.z[level.id] ?? 0, locale)})',
    ].join(' · ');
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: p.line.withValues(alpha: 0.7)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(date, style: text.titleSmall),
                Text(values, style: text.bodyMedium),
                Text(
                  [
                    verdictLabel(r.verdict, l),
                    if (r.rules.isNotEmpty)
                      r.rules.map((x) => x.code).join(', '),
                  ].join(' · '),
                  style: text.bodySmall!.copyWith(
                    color: r.verdict == QcVerdict.reject ? p.danger : p.sub,
                    fontWeight: r.verdict == QcVerdict.accept
                        ? null
                        : FontWeight.w600,
                  ),
                ),
                if (r.run.note != null)
                  Text(r.run.note!, style: text.bodySmall),
              ],
            ),
          ),
          IconButton(
            tooltip: l.qcDeleteRun,
            icon: const Icon(Icons.delete_outline_rounded),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
