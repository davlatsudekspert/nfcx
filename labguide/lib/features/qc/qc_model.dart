/// Ichki sifat nazorati (QC) ma'lumotlari: nazorat to'plami (test + daraja
/// + lot + maqsadli o'rtacha/SD) va seriyalar (run) natijalari.
///
/// Qiymatlarni foydalanuvchi kiritadi — ilova hech qanday maqsadli
/// o'rtacha, SD yoki natija to'qimaydi.
library;

import 'dart:math' as math;

import 'package:flutter/foundation.dart';

/// Maqsadli o'rtacha va SD qayerdan olingan.
enum QcTargetSource {
  /// Laboratoriyaning o'z nazorat natijalaridan hisoblangan.
  laboratory,

  /// Nazorat materiali ishlab chiqaruvchisining varaqasidan.
  manufacturer;

  static QcTargetSource parse(String raw) => values.firstWhere(
    (v) => v.name == raw,
    orElse: () => throw FormatException('unknown target source: $raw'),
  );
}

/// Maqsadli qiymatlar davri: lot, o'rtacha va SD qaysi sanadan amal qiladi.
@immutable
class QcTarget {
  const QcTarget({
    required this.lot,
    required this.mean,
    required this.sd,
    this.from,
    this.source,
  });

  factory QcTarget.fromJson(Map<String, Object?> json) => QcTarget(
    lot: json['lot'] as String? ?? '',
    mean: (json['mean']! as num).toDouble(),
    sd: (json['sd']! as num).toDouble(),
    from: json['from'] == null ? null : DateTime.parse(json['from']! as String),
    source: json['source'] == null
        ? null
        : QcTargetSource.parse(json['source']! as String),
  );

  final String lot;
  final double mean;
  final double sd;

  /// Shu sanadan boshlab amal qiladi (`null` — boshidan).
  final DateTime? from;

  /// x̄/SD manbai; `null` — to'plamniki ([QcSet.targetSource]).
  final QcTargetSource? source;

  bool get isValid => mean.isFinite && sd.isFinite && sd > 0;

  /// z = (x − o'rtacha) / SD
  double z(double value) => (value - mean) / sd;

  Map<String, Object?> toJson() => {
    'lot': lot,
    'mean': mean,
    'sd': sd,
    if (from != null) 'from': from!.toIso8601String(),
    if (source != null) 'source': source!.name,
  };
}

@immutable
class QcLevel {
  const QcLevel({
    required this.id,
    required this.label,
    required this.lot,
    required this.mean,
    required this.sd,
    this.since,
    this.source,
    this.previous = const [],
  });

  factory QcLevel.fromJson(Map<String, Object?> json) => QcLevel(
    id: json['id']! as String,
    label: json['label']! as String,
    lot: json['lot'] as String? ?? '',
    mean: (json['mean']! as num).toDouble(),
    sd: (json['sd']! as num).toDouble(),
    since: json['since'] == null
        ? null
        : DateTime.parse(json['since']! as String),
    source: json['source'] == null
        ? null
        : QcTargetSource.parse(json['source']! as String),
    previous: [
      for (final t in json['previous'] as List? ?? const [])
        QcTarget.fromJson((t as Map).cast<String, Object?>()),
    ],
  );

  final String id;

  /// Ko'rsatiladigan nom: “1”, “2”, “Past”, “Yuqori” va h.k.
  final String label;

  /// Amaldagi lot va maqsadli qiymatlar.
  final String lot;
  final double mean;
  final double sd;

  /// Amaldagi maqsadlar shu sanadan beri (`null` — to'plam yaratilgandan).
  final DateTime? since;

  /// Amaldagi x̄/SD manbai; `null` — to'plamniki ([QcSet.targetSource]).
  final QcTargetSource? source;

  /// Oldingi maqsadlar (eski lot yoki qayta hisoblangan x̄/SD) — vaqt
  /// tartibida. O'tgan seriyalar o'z davridagi maqsad bilan baholanadi.
  final List<QcTarget> previous;

  QcTarget get current =>
      QcTarget(lot: lot, mean: mean, sd: sd, from: since, source: source);

  bool get isValid => current.isValid;

  /// Amaldagi maqsad bo'yicha z = (x − o'rtacha) / SD.
  double z(double value) => current.z(value);

  /// [at] vaqtida amal qilgan maqsad.
  QcTarget targetAt(DateTime at) {
    if (since == null || !at.isBefore(since!)) return current;
    for (final t in previous.reversed) {
      if (t.from == null || !at.isBefore(t.from!)) return t;
    }
    return previous.isEmpty ? current : previous.first;
  }

  /// Yangi maqsad (lot almashdi yoki x̄/SD qayta hisoblandi): amaldagisi
  /// tarixga o'tadi.
  QcLevel withTarget({
    required String lot,
    required double mean,
    required double sd,
    required DateTime from,
    QcTargetSource? source,
  }) => QcLevel(
    id: id,
    label: label,
    lot: lot,
    mean: mean,
    sd: sd,
    since: from,
    source: source,
    previous: [...previous, current],
  );

  Map<String, Object?> toJson() => {
    'id': id,
    'label': label,
    'lot': lot,
    'mean': mean,
    'sd': sd,
    if (since != null) 'since': since!.toIso8601String(),
    if (source != null) 'source': source!.name,
    if (previous.isNotEmpty) 'previous': [for (final t in previous) t.toJson()],
  };
}

@immutable
class QcSet {
  const QcSet({
    required this.id,
    required this.name,
    required this.unit,
    required this.levels,
    required this.targetSource,
    required this.createdAt,
  });

  factory QcSet.fromJson(Map<String, Object?> json) => QcSet(
    id: json['id']! as String,
    name: json['name']! as String,
    unit: json['unit'] as String? ?? '',
    levels: [
      for (final l in json['levels']! as List)
        QcLevel.fromJson((l as Map).cast<String, Object?>()),
    ],
    targetSource: QcTargetSource.parse(json['target_source']! as String),
    createdAt: DateTime.parse(json['created_at']! as String),
  );

  final String id;

  /// Test nomi (masalan, “Glyukoza”).
  final String name;
  final String unit;
  final List<QcLevel> levels;
  final QcTargetSource targetSource;
  final DateTime createdAt;

  QcLevel? level(String id) => levels.where((l) => l.id == id).firstOrNull;

  /// Maqsad x̄/SD manbai (maqsadda yozilmagan bo'lsa — to'plamniki).
  QcTargetSource sourceOf(QcTarget target) => target.source ?? targetSource;

  Map<String, Object?> toJson() => {
    'id': id,
    'name': name,
    'unit': unit,
    'levels': [for (final l in levels) l.toJson()],
    'target_source': targetSource.name,
    'created_at': createdAt.toIso8601String(),
  };
}

/// Bitta seriya (run): bir vaqtda o'lchangan nazorat darajalari.
@immutable
class QcRun {
  const QcRun({
    required this.id,
    required this.at,
    required this.values,
    this.note,
    this.enteredVerdict,
    this.enteredRules = const [],
  });

  factory QcRun.fromJson(Map<String, Object?> json) {
    final entered = (json['entered'] as Map?)?.cast<String, Object?>();
    final verdict = entered?['verdict'];
    if (entered != null && !_verdicts.contains(verdict)) {
      throw FormatException('unknown entered verdict: $verdict');
    }
    // Ro'yxat darhol tekshiriladi (`cast` dangasa — buzuq element keyin
    // ekran qurilayotganda yiqitardi).
    final rules = <String>[
      for (final r in entered?['rules'] as List? ?? const [])
        if (r is String) r else throw FormatException('bad rule code: $r'),
    ];
    return QcRun(
      id: json['id']! as String,
      at: DateTime.parse(json['at']! as String),
      values: {
        for (final e in (json['values']! as Map).entries)
          e.key as String: (e.value as num).toDouble(),
      },
      note: json['note'] as String?,
      enteredVerdict: verdict as String?,
      enteredRules: List.unmodifiable(rules),
    );
  }

  /// `QcVerdict` nomlari (qc_rules.dart; test bir xilligini tekshiradi).
  static const _verdicts = {'accept', 'warning', 'reject'};

  final String id;
  final DateTime at;

  /// Daraja id → o'lchangan qiymat. Hamma daraja bo'lishi shart emas.
  final Map<String, double> values;
  final String? note;

  /// Kiritilgan paytdagi xulosa (`accept` / `warning` / `reject`) va
  /// qoidalar — audit izi: keyin seriya o'chirilsa yoki maqsad o'zgarsa,
  /// joriy baho farq qilishi mumkin, lekin o'sha paytdagi qaror saqlanadi.
  final String? enteredVerdict;
  final List<String> enteredRules;

  QcRun withEntered(String verdict, List<String> rules) => QcRun(
    id: id,
    at: at,
    values: values,
    note: note,
    enteredVerdict: verdict,
    enteredRules: List.unmodifiable(rules),
  );

  Map<String, Object?> toJson() => {
    'id': id,
    'at': at.toIso8601String(),
    'values': values,
    if (note != null && note!.isNotEmpty) 'note': note,
    if (enteredVerdict != null)
      'entered': {'verdict': enteredVerdict, 'rules': enteredRules},
  };
}

/// Lokal saqlanadigan barcha QC ma'lumotlari.
@immutable
class QcData {
  const QcData({this.sets = const [], this.runs = const {}});

  factory QcData.fromJson(Map<String, Object?> json) {
    final version = json['version'] as int? ?? 1;
    if (version != 1) throw FormatException('unsupported qc version $version');
    return QcData(
      sets: [
        for (final s in json['sets'] as List? ?? const [])
          QcSet.fromJson((s as Map).cast<String, Object?>()),
      ],
      runs: {
        for (final e in ((json['runs'] as Map?) ?? const {}).entries)
          e.key as String: [
            for (final r in e.value as List)
              QcRun.fromJson((r as Map).cast<String, Object?>()),
          ]..sort((a, b) => a.at.compareTo(b.at)),
      },
    );
  }

  final List<QcSet> sets;

  /// To'plam id → seriyalar (vaqt bo'yicha o'sish tartibida).
  final Map<String, List<QcRun>> runs;

  QcSet? set(String id) => sets.where((s) => s.id == id).firstOrNull;

  List<QcRun> runsOf(String setId) => runs[setId] ?? const [];

  Map<String, Object?> toJson() => {
    'version': 1,
    'sets': [for (final s in sets) s.toJson()],
    'runs': {
      for (final e in runs.entries)
        e.key: [for (final r in e.value) r.toJson()],
    },
  };
}

/// Kuzatilgan statistika (kiritilgan natijalardan): n, o'rtacha, SD, CV %.
@immutable
class QcStats {
  const QcStats({required this.n, this.mean, this.sd});

  factory QcStats.of(Iterable<double> values) {
    final xs = values.where((v) => v.isFinite).toList();
    if (xs.isEmpty) return const QcStats(n: 0);
    final mean = xs.reduce((a, b) => a + b) / xs.length;
    if (xs.length < 2) return QcStats(n: xs.length, mean: mean);
    var ss = 0.0;
    for (final x in xs) {
      ss += (x - mean) * (x - mean);
    }
    // Tanlanma SD (n − 1).
    return QcStats(
      n: xs.length,
      mean: mean,
      sd: math.sqrt(ss / (xs.length - 1)),
    );
  }

  final int n;
  final double? mean;
  final double? sd;

  /// CV % = SD / o'rtacha × 100; o'rtacha 0 bo'lsa aniqlanmaydi.
  double? get cv => (mean == null || sd == null || mean == 0)
      ? null
      : sd! / mean!.abs() * 100;
}
