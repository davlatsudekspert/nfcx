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

@immutable
class QcLevel {
  const QcLevel({
    required this.id,
    required this.label,
    required this.lot,
    required this.mean,
    required this.sd,
  });

  factory QcLevel.fromJson(Map<String, Object?> json) => QcLevel(
    id: json['id']! as String,
    label: json['label']! as String,
    lot: json['lot'] as String? ?? '',
    mean: (json['mean']! as num).toDouble(),
    sd: (json['sd']! as num).toDouble(),
  );

  final String id;

  /// Ko'rsatiladigan nom: “1”, “2”, “Past”, “Yuqori” va h.k.
  final String label;
  final String lot;
  final double mean;
  final double sd;

  bool get isValid => mean.isFinite && sd.isFinite && sd > 0;

  /// z = (x − o'rtacha) / SD
  double z(double value) => (value - mean) / sd;

  Map<String, Object?> toJson() => {
    'id': id,
    'label': label,
    'lot': lot,
    'mean': mean,
    'sd': sd,
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
  });

  factory QcRun.fromJson(Map<String, Object?> json) => QcRun(
    id: json['id']! as String,
    at: DateTime.parse(json['at']! as String),
    values: {
      for (final e in (json['values']! as Map).entries)
        e.key as String: (e.value as num).toDouble(),
    },
    note: json['note'] as String?,
  );

  final String id;
  final DateTime at;

  /// Daraja id → o'lchangan qiymat. Hamma daraja bo'lishi shart emas.
  final Map<String, double> values;
  final String? note;

  Map<String, Object?> toJson() => {
    'id': id,
    'at': at.toIso8601String(),
    'values': values,
    if (note != null && note!.isNotEmpty) 'note': note,
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
