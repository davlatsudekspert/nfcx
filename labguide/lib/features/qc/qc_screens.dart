import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/app_scope.dart';
import '../../app/widgets/lg_page.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../tools/clinical_calculators.dart';
import '../tools/tool_screens.dart';
import 'levey_jennings_chart.dart';
import 'qc_controller.dart';
import 'qc_export.dart';
import 'qc_model.dart';
import 'qc_rules.dart';

const _decimalKeyboard = TextInputType.numberWithOptions(
  decimal: true,
  signed: true,
);

/// Grafikda ko'rsatiladigan oxirgi seriyalar soni.
const kQcChartRuns = 30;

/// Tarixda dastlab ko'rsatiladigan seriyalar soni (qolgani — tugma bilan).
const _kHistoryRuns = 50;

/// Daraja nomi: raqam bo'lsa “1-daraja”, nom bo'lsa “Past daraja”
/// (avval “Past-daraja” chiqardi).
String qcLevelName(String label, AppLocalizations l) =>
    RegExp(r'^\d+$').hasMatch(label) ? l.qcLevel(label) : l.qcLevelNamed(label);

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

/// Maydonga qo'yish uchun: guruhlashsiz, lokal o'nlik belgisi bilan —
/// [parseFieldNumber] uni qayta o'qiy oladi.
String _plain(double v, String locale) {
  final decimals = v.abs() >= 1 ? 4 : 6;
  final f = NumberFormat.decimalPattern(locale)
    ..maximumFractionDigits = decimals
    ..minimumFractionDigits = 0
    ..turnOffGrouping();
  return f.format(roundHalfUp(v, decimals));
}

/// To'plam darajalarining amaldagi x̄/SD manbalari.
Set<QcTargetSource> _sources(QcSet set) => {
  for (final level in set.levels) set.sourceOf(level.current),
};

String _sourceLabel(QcTargetSource s, AppLocalizations l) => switch (s) {
  QcTargetSource.laboratory => l.qcSourceLab,
  QcTargetSource.manufacturer => l.qcSourceManufacturer,
};

/// Joriy maqsad davridagi, rad etilmagan seriyalar qiymatlari — kuzatilgan
/// statistika uchun (rad etilgan seriya x̄/SD ni buzmasin, D-27).
List<double> _periodValues(QcLevel level, List<QcRunResult> results) => [
  for (final r in results)
    if (r.verdict != QcVerdict.reject)
      if (level.since == null || !r.run.at.isBefore(level.since!))
        ?r.run.values[level.id],
];

void _snack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

Future<bool> _confirmDialog(
  BuildContext context, {
  required String title,
  required String body,
  required String action,
}) async {
  final l = AppLocalizations.of(context);
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l.actionCancel),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(action),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Buferdagi zaxira nusxani tekshirib, tasdiqdan keyin tiklaydi.
Future<void> _restoreFromClipboard(BuildContext context) async {
  final l = AppLocalizations.of(context);
  final qc = context.services.qc;
  final clip = await Clipboard.getData(Clipboard.kTextPlain);
  if (!context.mounted) return;
  final QcData data;
  try {
    data = QcController.parseBackup(clip?.text ?? '');
  } on FormatException {
    _snack(context, l.qcRestoreInvalid);
    return;
  }
  final runs = data.runs.values.fold<int>(0, (n, r) => n + r.length);
  final ok = await _confirmDialog(
    context,
    title: l.qcBackupRestore,
    body: l.qcRestoreConfirm(data.sets.length, runs),
    action: l.qcRestoreAction,
  );
  if (!ok || !context.mounted) return;
  try {
    await qc.restore(data);
  } on Object {
    if (context.mounted) _snack(context, l.qcErrSave);
    return;
  }
  if (context.mounted) _snack(context, l.qcRestored);
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
            if (qc.loadError != null) ...[
              LgStateView(kind: StateKind.error, title: l.qcLoadError),
              const SizedBox(height: 10),
              // Hech narsa jim yo'qolmaydi: avval matnni nusxalash, so'ng
              // zaxiradan tiklash yoki (tasdiq bilan) o'chirish.
              LgButton.secondary(
                label: l.qcCopyRaw,
                icon: Icons.copy_rounded,
                onPressed: () async {
                  await Clipboard.setData(
                    ClipboardData(text: qc.unreadableRaw ?? ''),
                  );
                  if (context.mounted) _snack(context, l.qcBackupCopied);
                },
              ),
              const SizedBox(height: 10),
              LgButton.secondary(
                label: l.qcBackupRestore,
                icon: Icons.restore_rounded,
                onPressed: () => _restoreFromClipboard(context),
              ),
              const SizedBox(height: 10),
              LgButton.secondary(
                label: l.qcDiscard,
                icon: Icons.delete_outline_rounded,
                onPressed: () async {
                  final ok = await _confirmDialog(
                    context,
                    title: l.qcDiscard,
                    body: l.qcDiscardConfirm,
                    action: l.actionDelete,
                  );
                  if (ok) await qc.discardUnreadable();
                },
              ),
            ] else if (data.sets.isEmpty)
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
              LgSectionTitle(l.qcBackupTitle),
              Text(l.qcBackupBody, style: text.bodySmall),
              const SizedBox(height: 10),
              if (data.sets.isNotEmpty) ...[
                LgButton.secondary(
                  label: l.qcBackupCopy,
                  icon: Icons.copy_rounded,
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: qc.exportJson()),
                    );
                    if (context.mounted) _snack(context, l.qcBackupCopied);
                  },
                ),
                const SizedBox(height: 10),
              ],
              LgButton.secondary(
                label: l.qcBackupRestore,
                icon: Icons.restore_rounded,
                onPressed: () => _restoreFromClipboard(context),
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
  final label = TextEditingController();
  final lot = TextEditingController();
  final mean = TextEditingController();
  final sd = TextEditingController();

  void dispose() {
    label.dispose();
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
      final mean = parseFieldNumber(context, f.mean.text);
      final sd = parseFieldNumber(context, f.sd.text);
      if (mean == null ||
          sd == null ||
          !mean.isFinite ||
          !sd.isFinite ||
          !(sd > 0)) {
        setState(() => _error = l.qcErrLevel(l.qcLevel('${i + 1}')));
        return;
      }
      final label = f.label.text.trim();
      levels.add((
        label: label.isEmpty ? '${i + 1}' : label,
        lot: f.lot.text,
        mean: mean,
        sd: sd,
      ));
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    final QcSet set;
    try {
      set = await context.services.qc.addSet(
        name: _name.text,
        unit: _unit.text,
        targetSource: _source,
        levels: levels,
      );
    } on Object {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = l.qcErrSave;
        });
      }
      return;
    }
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
          LgField(label: l.qcLevelName, controller: f.label, maxLength: 20),
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

  /// Kechikib kiritilgan seriya uchun haqiqiy o'lchash vaqti (`null` — hozir).
  DateTime? _runAt;
  bool _showAllRuns = false;

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
      final v = parseFieldNumber(context, raw);
      if (v == null) {
        setState(() => _error = l.qcErrRunInvalid(qcLevelName(level.label, l)));
        return;
      }
      if (!v.isFinite) {
        setState(() => _error = l.qcErrNotFinite(qcLevelName(level.label, l)));
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
    final now = DateTime.now();
    final at = _runAt == null || _runAt!.isAfter(now) ? null : _runAt;
    try {
      await context.services.qc.addRun(
        set.id,
        values,
        note: _note.text,
        at: at,
      );
    } on Object {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = l.qcErrSave;
        });
      }
      return;
    }
    if (!mounted) return;
    for (final c in _values.values) {
      c.clear();
    }
    _note.clear();
    setState(() {
      _busy = false;
      _runAt = null;
    });
  }

  Future<void> _pickRunTime() async {
    final now = DateTime.now();
    final initial = _runAt ?? now;
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) return;
    final at = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    setState(() => _runAt = at.isAfter(now) ? null : at);
  }

  Future<bool> _confirm(String title) {
    final l = AppLocalizations.of(context);
    return _confirmDialog(
      context,
      title: title,
      body: l.qcConfirmDelete,
      action: l.actionDelete,
    );
  }

  Future<void> _guard(Future<void> Function() action) async {
    final l = AppLocalizations.of(context);
    try {
      await action();
    } on Object {
      if (mounted) _snack(context, l.qcErrSave);
    }
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
        final sources = _sources(set);
        return LgPage(
          title: set.name,
          subtitle: [
            if (set.unit.isNotEmpty) set.unit,
            if (sources.length == 1) _sourceLabel(sources.single, l),
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
    final dateOnly = DateFormat.yMd(locale);
    final last = results.isEmpty ? null : results.last;
    final sources = _sources(set);
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

      // Levey–Jennings: har bir daraja alohida, amaldagi maqsad davri uchun
      // (lot yoki x̄/SD o'zgargan bo'lsa, eski seriyalar o'z maqsadi bilan
      // baholanadi, grafikda esa joriy davr ko'rsatiladi).
      for (final level in set.levels) ...[
        LgSectionTitle(
          [
            qcLevelName(level.label, l),
            if (level.lot.isNotEmpty) '${l.qcLot} ${level.lot}',
          ].join(' · '),
          trailing: IconButton(
            tooltip: l.qcChangeTarget,
            icon: const Icon(Icons.edit_outlined),
            onPressed: () =>
                context.push('/lab/qc/set/${set.id}/target/${level.id}'),
          ),
        ),
        Text(
          [
            'x̄ ${_num(level.mean, locale)} · SD ${_num(level.sd, locale)}'
                '${set.unit.isEmpty ? '' : ' ${set.unit}'}',
            if (level.previous.isNotEmpty && level.since != null)
              l.qcSince(dateOnly.format(level.since!)),
            if (sources.length > 1)
              _sourceLabel(set.sourceOf(level.current), l),
          ].join(' · '),
          style: text.bodySmall,
        ),
        const SizedBox(height: 6),
        Builder(
          builder: (context) {
            final period = [
              for (final r in shown)
                if (level.since == null || !r.run.at.isBefore(level.since!))
                  if (r.run.values[level.id] != null) r,
            ];
            return LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LeveyJenningsChart(
                    mean: level.mean,
                    sd: level.sd,
                    points: [
                      for (final r in period)
                        LjPoint(r.run.values[level.id]!, markFor(r, level.id)),
                    ],
                    semanticLabel: l.qcChartSemantics(
                      qcLevelName(level.label, l),
                      period.length,
                    ),
                  ),
                  // X o'qi: vaqt tartibi — birinchi va oxirgi nuqta sanasi.
                  if (period.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        period.length == 1
                            ? dateOnly.format(period.first.run.at)
                            : '${dateOnly.format(period.first.run.at)} – '
                                  '${dateOnly.format(period.last.run.at)}',
                        style: text.bodySmall,
                      ),
                    ),
                ],
              ),
            );
          },
        ),
        if (QcStats.of(_periodValues(level, results)) case final s
            when s.n >= 2)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              [
                '${l.qcStats}: n = ${s.n} · x̄ ${_num(s.mean!, locale)} · '
                    'SD ${_num(s.sd!, locale)}'
                    '${s.cv == null ? '' : ' · CV ${formatResult(roundHalfUp(s.cv!, 1), locale, maxDecimals: 1)} %'}',
                if (results.any(
                  (r) =>
                      r.verdict == QcVerdict.reject &&
                      r.run.values.containsKey(level.id),
                ))
                  l.qcStatsExcluded,
                if (s.n < 20) l.qcStatsFew(s.n),
              ].join('\n'),
              style: text.bodySmall,
            ),
          ),
        for (final t in level.previous.reversed)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              l.qcPreviousTarget(
                [
                  if (t.lot.isNotEmpty) '${l.qcLot} ${t.lot}',
                  'x̄ ${_num(t.mean, locale)}',
                  'SD ${_num(t.sd, locale)}',
                  _sourceLabel(set.sourceOf(t), l),
                ].join(' · '),
                t.from == null ? '—' : dateOnly.format(t.from!),
              ),
              style: text.bodySmall,
            ),
          ),
      ],
      const SizedBox(height: 6),
      Text(l.qcChartLegend, style: text.bodySmall),
      if (set.levels.any(
        (lv) => set.sourceOf(lv.current) == QcTargetSource.manufacturer,
      )) ...[
        const SizedBox(height: 10),
        LgNotice(l.qcManufacturerWarning, kind: NoticeKind.warning),
      ],

      // Yangi seriya.
      LgSectionTitle(l.qcAddRun),
      for (final level in set.levels)
        LgField(
          label: [
            qcLevelName(level.label, l),
            if (set.unit.isNotEmpty) set.unit,
          ].join(', '),
          controller: _ctrl(level.id),
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.next,
        ),
      LgField(label: l.qcNote, controller: _note, maxLength: 200),
      const SizedBox(height: 8),
      Row(
        children: [
          Flexible(
            child: LgButton.secondary(
              label: l.qcRunTime(
                _runAt == null ? l.qcRunTimeNow : dateFmt.format(_runAt!),
              ),
              icon: Icons.schedule_rounded,
              expand: false,
              onPressed: _pickRunTime,
            ),
          ),
          if (_runAt != null)
            IconButton(
              tooltip: l.qcRunTime(l.qcRunTimeNow),
              icon: const Icon(Icons.close_rounded),
              onPressed: () => setState(() => _runAt = null),
            ),
        ],
      ),
      if (_runAt != null) ...[
        const SizedBox(height: 6),
        Text(l.qcRunTimeHint, style: text.bodySmall),
      ],
      const SizedBox(height: 12),
      if (_error != null) ...[
        LgNotice(_error!, kind: NoticeKind.error),
        const SizedBox(height: 10),
      ],
      LgButton(label: l.qcSaveRun, busy: _busy, onPressed: () => _addRun(set)),

      // Seriyalar tarixi (oxirgisi birinchi).
      if (results.isNotEmpty) ...[
        LgSectionTitle(l.qcRunHistory),
        for (final r
            in _showAllRuns
                ? results.reversed
                : results.reversed.take(_kHistoryRuns))
          _RunTile(
            set: set,
            result: r,
            date: dateFmt.format(r.run.at),
            locale: locale,
            onDelete: () async {
              if (await _confirm(l.qcDeleteRun)) {
                await _guard(() => qc.deleteRun(set.id, r.run.id));
              }
            },
          ),
        if (!_showAllRuns && results.length > _kHistoryRuns) ...[
          const SizedBox(height: 10),
          LgButton.secondary(
            label: l.qcShowAllRuns(results.length),
            icon: Icons.expand_more_rounded,
            onPressed: () => setState(() => _showAllRuns = true),
          ),
        ],
      ],
      if (results.isNotEmpty) ...[
        const SizedBox(height: 14),
        LgButton.secondary(
          label: l.qcCopyCsv,
          icon: Icons.table_view_outlined,
          onPressed: () async {
            final csv = qcCsv(set, results);
            await Clipboard.setData(ClipboardData(text: csv));
            if (context.mounted) {
              _snack(context, l.qcCopied('\n'.allMatches(csv).length - 1));
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
            try {
              await qc.deleteSet(set.id);
            } on Object {
              if (context.mounted) _snack(context, l.qcErrSave);
              return;
            }
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
                if (r.verdict == QcVerdict.reject)
                  Text(l.qcRejectedExcluded, style: text.bodySmall),
                // Audit izi: kiritilgandagi qaror hozirgisidan farq qilsa.
                if (r.run.enteredVerdict case final entered?
                    when entered != r.verdict.name ||
                        r.run.enteredRules.join(',') !=
                            r.rules.map((x) => x.code).join(','))
                  Text(
                    l.qcAtEntry(
                      [
                        switch (entered) {
                          'reject' => l.qcReject,
                          'warning' => l.qcWarning,
                          _ => l.qcAccept,
                        },
                        if (r.run.enteredRules.isNotEmpty)
                          r.run.enteredRules.join(', '),
                      ].join(' · '),
                    ),
                    style: text.bodySmall!.copyWith(color: p.amber),
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

/// Daraja maqsadini almashtirish: yangi lot yoki laboratoriya qayta
/// hisoblagan x̄/SD. Hozirdan (yoki tanlangan sanadan) amal qiladi; undan
/// oldingi seriyalar o'z maqsadi bilan baholanishda davom etadi.
class QcTargetScreen extends StatefulWidget {
  const QcTargetScreen({super.key, required this.setId, required this.levelId});

  final String setId;
  final String levelId;

  @override
  State<QcTargetScreen> createState() => _QcTargetScreenState();
}

class _QcTargetScreenState extends State<QcTargetScreen> {
  final _lot = TextEditingController();
  final _mean = TextEditingController();
  final _sd = TextEditingController();
  bool _prefilled = false;
  QcTargetSource _source = QcTargetSource.laboratory;

  /// Amal qilish boshlanishi (`null` — hozirdan).
  DateTime? _from;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _lot.dispose();
    _mean.dispose();
    _sd.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    final mean = parseFieldNumber(context, _mean.text);
    final sd = parseFieldNumber(context, _sd.text);
    if (mean == null ||
        sd == null ||
        !mean.isFinite ||
        !sd.isFinite ||
        !(sd > 0)) {
      setState(() => _error = l.qcErrTarget);
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    final router = GoRouter.of(context);
    try {
      await context.services.qc.changeTarget(
        widget.setId,
        widget.levelId,
        lot: _lot.text,
        mean: mean,
        sd: sd,
        from: _from,
        source: _source,
      );
    } on Object {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = l.qcErrSave;
        });
      }
      return;
    }
    if (!mounted) return;
    router.pop();
  }

  Future<void> _pickFrom(DateTime previousStart) async {
    final now = DateTime.now();
    final first = DateTime(
      previousStart.year,
      previousStart.month,
      previousStart.day,
    );
    if (now.isBefore(first)) return;
    final date = await showDatePicker(
      context: context,
      initialDate: _from ?? now,
      firstDate: first,
      lastDate: now,
    );
    if (date == null || !mounted) return;
    // Kun boshidan; oldingi davr boshlanishidan oldin bo'lishi mumkin emas.
    final day = DateTime(date.year, date.month, date.day);
    setState(() => _from = day.isBefore(previousStart) ? previousStart : day);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final set = context.services.qc.data.set(widget.setId);
    final level = set?.level(widget.levelId);
    if (set == null || level == null) {
      return LgPage(
        title: l.qcChangeTarget,
        children: [LgStateView(kind: StateKind.empty, title: l.qcSetMissing)],
      );
    }
    if (!_prefilled) {
      // Lot odatda o'zgaradi, lekin oldingisi ko'rinib tursin.
      _lot.text = level.lot;
      _source = set.sourceOf(level.current);
      _prefilled = true;
    }
    final locale = Localizations.localeOf(context).toLanguageTag();
    final dateOnly = DateFormat.yMd(locale);
    final previousStart = level.since ?? set.createdAt;
    final observed = QcStats.of(
      _periodValues(
        level,
        evaluateRuns(set, context.services.qc.data.runsOf(set.id)),
      ),
    );
    return LgPage(
      title: l.qcChangeTarget,
      subtitle: '${set.name} · ${qcLevelName(level.label, l)}',
      children: [
        LgNotice(l.qcChangeTargetBody, kind: NoticeKind.info),
        LgField(
          label: l.qcLot,
          controller: _lot,
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
            for (final s in QcTargetSource.values)
              LgChoiceChip(
                label: _sourceLabel(s, l),
                selected: _source == s,
                onTap: () => setState(() => _source = s),
              ),
          ],
        ),
        if (_source == QcTargetSource.manufacturer) ...[
          const SizedBox(height: 10),
          LgNotice(l.qcManufacturerWarning, kind: NoticeKind.warning),
        ],
        if (observed.n >= 2) ...[
          const SizedBox(height: 12),
          LgButton.secondary(
            label: l.qcUseObserved(observed.n),
            icon: Icons.functions_rounded,
            onPressed: () => setState(() {
              _mean.text = _plain(observed.mean!, locale);
              _sd.text = _plain(observed.sd!, locale);
              _source = QcTargetSource.laboratory;
            }),
          ),
          if (observed.n < 20) ...[
            const SizedBox(height: 6),
            Text(l.qcStatsFew(observed.n), style: text.bodySmall),
          ],
        ],
        LgField(
          label: set.unit.isEmpty ? l.qcMean : '${l.qcMean}, ${set.unit}',
          controller: _mean,
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: set.unit.isEmpty ? l.qcSd : '${l.qcSd}, ${set.unit}',
          controller: _sd,
          keyboardType: _decimalKeyboard,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _save(),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 7),
          child: Text(
            l.qcEffectiveFrom,
            style: text.titleSmall!.copyWith(fontSize: 14),
          ),
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            LgChoiceChip(
              label: l.qcFromNow,
              selected: _from == null,
              onTap: () => setState(() => _from = null),
            ),
            LgChoiceChip(
              label: _from == null
                  ? l.qcPickDate
                  : l.qcFromDate(dateOnly.format(_from!)),
              selected: _from != null,
              onTap: () => _pickFrom(previousStart),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_error != null) ...[
          LgNotice(_error!, kind: NoticeKind.error),
          const SizedBox(height: 10),
        ],
        LgButton(label: l.qcSave, busy: _busy, onPressed: _save),
        if (level.previous.isNotEmpty) ...[
          const SizedBox(height: 10),
          LgButton.secondary(
            label: l.qcUndoTarget,
            icon: Icons.undo_rounded,
            onPressed: _busy ? null : () => _undo(level),
          ),
        ],
        const SizedBox(height: 12),
        Text(l.qcTargetNote, style: text.bodySmall),
      ],
    );
  }

  Future<void> _undo(QcLevel level) async {
    final l = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final t = level.previous.last;
    final ok = await _confirmDialog(
      context,
      title: l.qcUndoTarget,
      body: l.qcUndoTargetBody(
        [
          if (t.lot.isNotEmpty) '${l.qcLot} ${t.lot}',
          'x̄ ${_num(t.mean, locale)}',
          'SD ${_num(t.sd, locale)}',
        ].join(' · '),
      ),
      action: l.qcUndoTarget,
    );
    if (!ok || !mounted) return;
    final router = GoRouter.of(context);
    try {
      await context.services.qc.undoTargetChange(widget.setId, widget.levelId);
    } on Object {
      if (mounted) setState(() => _error = l.qcErrSave);
      return;
    }
    if (mounted) router.pop();
  }
}
