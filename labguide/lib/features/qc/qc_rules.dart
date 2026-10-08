/// Westgard ko'p qoidali (multirule) nazorat qoidalari — Levey–Jennings
/// grafigidagi z-qiymatlar bo'yicha (Westgard JO, Barry PL, Hunt MR,
/// Groth T. Clin Chem 1981;27(3):493–501; doi:10.1093/clinchem/27.3.493).
///
/// - 2-2s: seriya ichida ikki material bo'ylab va bir material ketma-ket
///   ikki seriyada; R-4s faqat seriya ichida; 4-1s va 10x bir material
///   ichida (4 / 10 seriya) yoki materiallar bo'ylab.
/// - 1981 tartibida 1-2s “eshik” bo'lgan (2s dan oshmasa seriya qabul).
///   Westgard sayti kompyuter tizimlari uchun bu eshik shart emasligini
///   aytadi — bu yerda har seriyada hamma rad qoidalari tekshiriladi,
///   1-2s esa ogohlantirish sifatida ko'rsatiladi (docs/DECISIONS.md, D-20).
library;

import 'package:flutter/foundation.dart';

import '../content/content_model.dart';
import 'qc_model.dart';

enum QcRule {
  r12s('1-2s'),
  r13s('1-3s'),
  r22s('2-2s'),
  rR4s('R-4s'),
  r41s('4-1s'),
  r10x('10x');

  const QcRule(this.code);
  final String code;

  /// 1-2s — ogohlantirish; qolganlari seriyani rad etadi.
  bool get rejects => this != r12s;
}

enum QcVerdict { accept, warning, reject }

@immutable
class QcViolation {
  const QcViolation(
    this.rule, {
    required this.levelIds,
    this.acrossRuns = false,
  });

  final QcRule rule;

  /// Qoidani buzgan nazorat darajalari.
  final Set<String> levelIds;

  /// Qoida seriyalar bo'ylab (oldingi seriyalar bilan) buzilganmi.
  final bool acrossRuns;
}

@immutable
class QcRunResult {
  const QcRunResult({
    required this.run,
    required this.z,
    required this.violations,
  });

  final QcRun run;

  /// Daraja id → z = (x − o'rtacha) / SD.
  final Map<String, double> z;
  final List<QcViolation> violations;

  QcVerdict get verdict {
    if (violations.any((v) => v.rule.rejects)) return QcVerdict.reject;
    if (violations.isNotEmpty) return QcVerdict.warning;
    return QcVerdict.accept;
  }

  Set<QcRule> get rules => {for (final v in violations) v.rule};

  /// Bitta daraja nuqtai nazaridan: shu darajani o'z ichiga olgan
  /// buzilishlar bo'yicha (seriya xulosasi esa [verdict]).
  QcVerdict levelVerdict(String levelId) {
    final mine = violations.where((v) => v.levelIds.contains(levelId));
    if (mine.any((v) => v.rule.rejects)) return QcVerdict.reject;
    if (mine.isNotEmpty) return QcVerdict.warning;
    return QcVerdict.accept;
  }
}

/// Bitta o'lchov: qaysi seriya va daraja, z-qiymati.
typedef _Obs = ({int run, String level, double z});

/// Suzuvchi nuqta xatosiga chidamlilik: x̄ 5.0, SD 0.2 va qiymat 5.4 da
/// z = 2.0000000000000018 chiqadi. Chegaraning aynan ustidagi qiymat
/// buzilish emas (D-20), shuning uchun taqqoslash shu chegara bilan.
const _eps = 1e-9;

/// [z] chegaradan [k] SD dan aniq tashqaridami (`z > k`, xatoga chidamli).
bool _over(double z, double k) => z > k + _eps;

/// Har bir seriyani o'zidan oldingi seriyalar bilan birga baholaydi
/// (vaqt tartibida). Har bir natija faqat shu seriyada paydo bo'lgan
/// buzilishlarni ko'rsatadi — oldingi seriyadagi rad qilish keyingisiga
/// “meros” o'tmaydi: rad etilgan seriya qiymatlari keyingi seriyalar
/// qoidalarida (2-2s, 4-1s, 10x) ishlatilmaydi — xato tuzatilib, seriya
/// qaytarilgan deb hisoblanadi (D-27).
List<QcRunResult> evaluateRuns(QcSet set, List<QcRun> runs) {
  final levelOrder = [for (final l in set.levels) l.id];
  // Barcha o'lchovlar vaqt tartibida: seriya, so'ng daraja tartibi.
  final stream = <_Obs>[];
  final results = <QcRunResult>[];
  for (var i = 0; i < runs.length; i++) {
    final run = runs[i];
    final z = <String, double>{
      for (final id in levelOrder)
        if (run.values[id] case final v?)
          if (set.level(id)?.targetAt(run.at) case final t? when t.isValid)
            id: t.z(v),
    };
    final before = stream.length;
    for (final id in levelOrder) {
      if (z[id] case final value?) {
        stream.add((run: i, level: id, z: value));
      }
    }
    final result = QcRunResult(
      run: run,
      z: z,
      violations: _check(i, z, stream, levelOrder),
    );
    if (result.verdict == QcVerdict.reject) {
      stream.removeRange(before, stream.length);
    }
    results.add(result);
  }
  return results;
}

List<QcViolation> _check(
  int runIndex,
  Map<String, double> z,
  List<_Obs> stream,
  List<String> levels,
) {
  final out = <QcViolation>[];
  final current = {for (final e in z.entries) e.key};

  // 1-3s: bitta nazorat qiymati o'rtacha ± 3 SD dan tashqarida.
  final beyond3 = {
    for (final e in z.entries)
      if (_over(e.value.abs(), 3)) e.key,
  };
  if (beyond3.isNotEmpty) out.add(QcViolation(QcRule.r13s, levelIds: beyond3));

  // 1-2s: bitta nazorat qiymati ± 2 SD dan tashqarida (ogohlantirish).
  final beyond2 = {
    for (final e in z.entries)
      if (_over(e.value.abs(), 2)) e.key,
  };
  if (beyond2.isNotEmpty) out.add(QcViolation(QcRule.r12s, levelIds: beyond2));

  // 2-2s: ketma-ket ikki qiymat bir tomonda + 2 SD (yoki − 2 SD) dan
  // tashqarida — seriya ichida (ikki daraja) yoki ikki seriya bo'ylab
  // (bir daraja).
  for (final sign in [1, -1]) {
    final within = {
      for (final e in z.entries)
        if (_over(e.value * sign, 2)) e.key,
    };
    if (within.length >= 2) {
      out.add(QcViolation(QcRule.r22s, levelIds: within));
    }
    for (final id in current) {
      if (!_over(z[id]! * sign, 2)) continue;
      final prev = _previous(stream, id, runIndex);
      if (prev != null && _over(prev.z * sign, 2)) {
        out.add(QcViolation(QcRule.r22s, levelIds: {id}, acrossRuns: true));
      }
    }
  }

  // R-4s: seriya ichida bir qiymat + 2 SD dan, boshqasi − 2 SD dan
  // tashqarida (oraliq 4 SD dan katta).
  final high = {
    for (final e in z.entries)
      if (_over(e.value, 2)) e.key,
  };
  final low = {
    for (final e in z.entries)
      if (_over(-e.value, 2)) e.key,
  };
  if (high.isNotEmpty && low.isNotEmpty) {
    out.add(QcViolation(QcRule.rR4s, levelIds: {...high, ...low}));
  }

  // 4-1s va 10x: ketma-ket o'lchovlar — har bir daraja ichida va
  // darajalar bo'ylab (umumiy oqim). Oxirgi o'lchov shu seriyadan bo'lishi
  // shart (faqat yangi buzilish hisoblanadi).
  out
    ..addAll(_consecutive(QcRule.r41s, 4, 1, stream, runIndex, levels))
    ..addAll(_consecutive(QcRule.r10x, 10, 0, stream, runIndex, levels));

  // Bir xil qoida bir necha marta topilsa — darajalarni birlashtirib bitta.
  final merged = <QcRule, QcViolation>{};
  for (final v in out) {
    final m = merged[v.rule];
    merged[v.rule] = m == null
        ? v
        : QcViolation(
            v.rule,
            levelIds: {...m.levelIds, ...v.levelIds},
            acrossRuns: m.acrossRuns || v.acrossRuns,
          );
  }
  return [for (final r in QcRule.values) ?merged[r]];
}

_Obs? _previous(List<_Obs> stream, String level, int beforeRun) {
  for (var i = stream.length - 1; i >= 0; i--) {
    final o = stream[i];
    if (o.level == level && o.run < beforeRun) return o;
  }
  return null;
}

/// [count] ta ketma-ket o'lchov bir tomonda [limit] SD dan tashqarida
/// (`limit = 0` — o'rtachaning bir tomonida).
List<QcViolation> _consecutive(
  QcRule rule,
  int count,
  double limit,
  List<_Obs> stream,
  int runIndex,
  List<String> levels,
) {
  bool sameSide(Iterable<_Obs> xs, int sign) =>
      xs.every((o) => _over(o.z * sign, limit));

  final out = <QcViolation>[];
  // Har bir daraja ichida (seriyalar bo'ylab).
  for (final id in levels) {
    final mine = [
      for (final o in stream)
        if (o.level == id) o,
    ];
    if (mine.length < count || mine.last.run != runIndex) continue;
    final window = mine.sublist(mine.length - count);
    for (final sign in [1, -1]) {
      if (sameSide(window, sign)) {
        out.add(QcViolation(rule, levelIds: {id}, acrossRuns: true));
      }
    }
  }
  // Darajalar bo'ylab (umumiy oqim) — kamida ikki daraja ishtirok etsa.
  if (stream.length >= count && stream.last.run == runIndex) {
    final window = stream.sublist(stream.length - count);
    final ids = {for (final o in window) o.level};
    if (ids.length >= 2) {
      for (final sign in [1, -1]) {
        if (sameSide(window, sign)) {
          out.add(QcViolation(rule, levelIds: ids, acrossRuns: true));
        }
      }
    }
  }
  return out;
}

/// Qoidalar izohi (3 tilda) — natija ekranida ko'rsatiladi.
const Map<QcRule, LocalizedText> qcRuleText = {
  QcRule.r12s: LocalizedText({
    'uz':
        '1-2s — bitta nazorat qiymati o‘rtacha ± 2 SD dan tashqarida. '
        'Ogohlantirish: boshqa qoidalar bilan tekshiriladi.',
    'ru':
        '1-2s — одно контрольное значение вне среднего ± 2 SD. '
        'Предупреждение: проверяется другими правилами.',
    'en':
        '1-2s — one control value outside the mean ± 2 SD. '
        'Warning: inspect with the other rules.',
  }),
  QcRule.r13s: LocalizedText({
    'uz':
        '1-3s — bitta nazorat qiymati o‘rtacha ± 3 SD dan tashqarida. '
        'Seriya rad etiladi (ko‘proq tasodifiy xato).',
    'ru':
        '1-3s — одно контрольное значение вне среднего ± 3 SD. '
        'Серия отклоняется (чаще случайная ошибка).',
    'en':
        '1-3s — one control value outside the mean ± 3 SD. '
        'Reject the run (mostly random error).',
  }),
  QcRule.r22s: LocalizedText({
    'uz':
        '2-2s — ketma-ket ikki nazorat qiymati bir tomonda 2 SD dan '
        'tashqarida (seriya ichida yoki ikki seriya bo‘ylab). Rad '
        '(tizimli xato).',
    'ru':
        '2-2s — два последовательных контрольных значения по одну сторону '
        'за пределами 2 SD (в серии или в двух сериях подряд). '
        'Серия отклоняется (систематическая ошибка).',
    'en':
        '2-2s — two consecutive control values beyond 2 SD on the same '
        'side (within a run or across two runs). Reject (systematic error).',
  }),
  QcRule.rR4s: LocalizedText({
    'uz':
        'R-4s — bir seriyada bir qiymat + 2 SD dan, boshqasi − 2 SD dan '
        'tashqarida. Rad (tasodifiy xato).',
    'ru':
        'R-4s — в одной серии одно значение выше + 2 SD, другое ниже '
        '− 2 SD. Серия отклоняется (случайная ошибка).',
    'en':
        'R-4s — within one run one value exceeds + 2 SD and another '
        '− 2 SD. Reject (random error).',
  }),
  QcRule.r41s: LocalizedText({
    'uz':
        '4-1s — ketma-ket to‘rt nazorat qiymati bir tomonda 1 SD dan '
        'tashqarida. Rad (tizimli xato).',
    'ru':
        '4-1s — четыре последовательных контрольных значения по одну '
        'сторону за пределами 1 SD. Серия отклоняется (систематическая ошибка).',
    'en':
        '4-1s — four consecutive control values beyond 1 SD on the same '
        'side. Reject (systematic error).',
  }),
  QcRule.r10x: LocalizedText({
    'uz':
        '10x — ketma-ket o‘n nazorat qiymati o‘rtachaning bir tomonida. '
        'Rad (tizimli xato).',
    'ru':
        '10x — десять последовательных контрольных значений по одну '
        'сторону от среднего. Серия отклоняется (систематическая ошибка).',
    'en':
        '10x — ten consecutive control values on the same side of the '
        'mean. Reject (systematic error).',
  }),
};
