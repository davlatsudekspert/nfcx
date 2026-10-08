/// QC ma'lumotini CSV ga (Excel/Sheets'ga qo'yish uchun) o'girish.
///
/// Har qator — bitta seriyadagi bitta daraja qiymati; maqsad o'sha seriya
/// vaqtida amal qilgan lot/x̄/SD bilan. `run_verdict` — butun seriya
/// xulosasi, `level_verdict` va `level_rules` — shu daraja ishtirok etgan
/// buzilishlar; `entered_verdict` — seriya kiritilgan paytdagi qaror (audit).
/// Qiymatlar nuqta bilan (lokal formatsiz) — jadval dasturlari
/// bir xil o'qiydi.
library;

import 'qc_model.dart';
import 'qc_rules.dart';

String _cell(String v) {
  if (v.contains(RegExp(r'[",\n\r]'))) return '"${v.replaceAll('"', '""')}"';
  return v;
}

/// Foydalanuvchi matni (test nomi, daraja, lot, izoh): `= + - @` yoki
/// tab/CR bilan boshlansa, jadval dasturi uni formula deb bajarmasligi
/// uchun oldiga `'` qo'yiladi (CSV injection).
String _text(String v) => v.startsWith(RegExp('[=+\\-@\t\r]')) ? "'$v" : v;

String _two(int v) => v.toString().padLeft(2, '0');

String _date(DateTime t) =>
    '${t.year}-${_two(t.month)}-${_two(t.day)} ${_two(t.hour)}:${_two(t.minute)}';

String qcCsv(QcSet set, List<QcRunResult> results) {
  final rows = <List<String>>[
    [
      'date',
      'test',
      'level',
      'lot',
      'value',
      'unit',
      'target_mean',
      'target_sd',
      'z',
      'run_verdict',
      'level_verdict',
      'level_rules',
      'entered_verdict',
      'note',
    ],
  ];
  for (final r in results) {
    for (final level in set.levels) {
      final v = r.run.values[level.id];
      if (v == null) continue;
      final t = level.targetAt(r.run.at);
      final z = r.z[level.id];
      rows.add([
        _date(r.run.at),
        _text(set.name),
        _text(level.label),
        _text(t.lot),
        '$v',
        _text(set.unit),
        '${t.mean}',
        '${t.sd}',
        z == null ? '' : z.toStringAsFixed(2),
        r.verdict.name,
        r.levelVerdict(level.id).name,
        [
          for (final x in r.violations)
            if (x.levelIds.contains(level.id)) x.rule.code,
        ].join(' '),
        [?r.run.enteredVerdict, ...r.run.enteredRules].join(' '),
        _text(r.run.note ?? ''),
      ]);
    }
  }
  return '${rows.map((row) => row.map(_cell).join(',')).join('\n')}\n';
}
