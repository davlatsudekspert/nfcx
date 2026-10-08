import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../../core/storage/kv_store.dart';
import 'qc_model.dart';
import 'qc_rules.dart';

/// QC to'plamlari va seriyalarini lokal saqlaydi (`qc.data`, JSON).
///
/// Buzilgan yozuv topilsa — ma'lumot jim o'chirilmaydi: [loadError]
/// to'ldiriladi va saqlash bloklanadi, foydalanuvchi buni ko'radi.
class QcController extends ChangeNotifier {
  QcController(this._store, {DateTime Function()? clock, math.Random? random})
    : _clock = clock ?? DateTime.now,
      _random = random ?? math.Random() {
    _load();
  }

  final KeyValueStore _store;
  final DateTime Function() _clock;
  final math.Random _random;

  QcData _data = const QcData();
  Object? _loadError;

  QcData get data => _data;

  /// Saqlangan ma'lumotni o'qib bo'lmadi — yozish bloklangan.
  Object? get loadError => _loadError;

  void _load() {
    final raw = _store.getString(StoreKeys.qcData);
    if (raw == null) return;
    try {
      _data = QcData.fromJson((jsonDecode(raw) as Map).cast<String, Object?>());
    } on Object catch (e) {
      _loadError = e;
    }
  }

  String _newId() =>
      '${_clock().microsecondsSinceEpoch.toRadixString(36)}'
      '${_random.nextInt(1 << 30).toRadixString(36)}';

  /// Avval diskka yoziladi, so'ng xotiraga: yozish muvaffaqiyatsiz bo'lsa,
  /// ekranda saqlanmagan ma'lumot ko'rinib qolmaydi (xato chaqiruvchiga).
  Future<void> _save(QcData next) async {
    if (_loadError != null) {
      throw StateError('QC data could not be read; refusing to overwrite');
    }
    await _store.setString(StoreKeys.qcData, jsonEncode(next.toJson()));
    _data = next;
    notifyListeners();
  }

  /// Zaxira nusxa (JSON) — boshqa qurilmaga ko'chirish yoki saqlash uchun.
  String exportJson() => jsonEncode(_data.toJson());

  /// O'qib bo'lmagan saqlangan matn (faqat [loadError] bo'lsa) — foydalanuvchi
  /// uni nusxalab olishi mumkin, hech narsa jim yo'qolmaydi.
  String? get unreadableRaw =>
      _loadError == null ? null : _store.getString(StoreKeys.qcData);

  /// Zaxira nusxani tekshirib o'qiydi; yaroqsiz bo'lsa [FormatException].
  static QcData parseBackup(String raw) {
    final QcData data;
    try {
      data = QcData.fromJson(
        (jsonDecode(raw.trim()) as Map).cast<String, Object?>(),
      );
    } on FormatException {
      rethrow;
    } on Object catch (e) {
      throw FormatException('not a QC backup: $e');
    }
    final ids = {for (final s in data.sets) s.id};
    if (ids.length != data.sets.length) {
      throw const FormatException('duplicate set id');
    }
    for (final set in data.sets) {
      final levelIds = {for (final l in set.levels) l.id};
      if (set.levels.isEmpty ||
          levelIds.length != set.levels.length ||
          !set.levels.every(
            (l) => l.isValid && l.previous.every((t) => t.isValid),
          )) {
        throw FormatException('invalid levels in ${set.id}');
      }
    }
    for (final e in data.runs.entries) {
      final set = data.set(e.key);
      if (set == null) throw FormatException('runs for unknown set ${e.key}');
      for (final run in e.value) {
        if (run.values.isEmpty ||
            run.values.values.any((v) => !v.isFinite) ||
            run.values.keys.any((k) => set.level(k) == null)) {
          throw FormatException('invalid run ${run.id}');
        }
      }
    }
    return data;
  }

  /// Hamma QC ma'lumotini zaxira nusxa bilan almashtiradi. O'qib bo'lmagan
  /// eski yozuv bo'lsa ham ishlaydi — bu tiklash yo'li (foydalanuvchi
  /// tasdiqlagandan keyin).
  Future<void> restore(QcData data) async {
    await _store.setString(StoreKeys.qcData, jsonEncode(data.toJson()));
    _data = data;
    _loadError = null;
    notifyListeners();
  }

  /// O'qib bo'lmagan yozuvni o'chirib, bo'sh holatdan boshlash
  /// (foydalanuvchi tasdiqlagandan keyin).
  Future<void> discardUnreadable() async {
    await _store.remove(StoreKeys.qcData);
    _data = const QcData();
    _loadError = null;
    notifyListeners();
  }

  /// Yangi to'plam. Har bir daraja uchun SD > 0 va o'rtacha chekli bo'lishi
  /// shart — aks holda [ArgumentError].
  Future<QcSet> addSet({
    required String name,
    required String unit,
    required QcTargetSource targetSource,
    required List<({String label, String lot, double mean, double sd})> levels,
  }) async {
    if (name.trim().isEmpty) throw ArgumentError.value(name, 'name');
    if (levels.isEmpty) throw ArgumentError.value(levels, 'levels');
    final set = QcSet(
      id: _newId(),
      name: name.trim(),
      unit: unit.trim(),
      targetSource: targetSource,
      createdAt: _clock(),
      levels: [
        for (final (i, l) in levels.indexed)
          QcLevel(
            id: 'L${i + 1}',
            label: l.label.trim().isEmpty ? '${i + 1}' : l.label.trim(),
            lot: l.lot.trim(),
            mean: l.mean,
            sd: l.sd,
          ),
      ],
    );
    if (!set.levels.every((l) => l.isValid)) {
      throw ArgumentError.value(levels, 'levels', 'mean/SD invalid');
    }
    await _save(QcData(sets: [..._data.sets, set], runs: _data.runs));
    return set;
  }

  Future<void> deleteSet(String setId) => _save(
    QcData(
      sets: [
        for (final s in _data.sets)
          if (s.id != setId) s,
      ],
      runs: {
        for (final e in _data.runs.entries)
          if (e.key != setId) e.key: e.value,
      },
    ),
  );

  /// Daraja maqsadini almashtirish (yangi lot yoki qayta hisoblangan x̄/SD).
  /// Eski maqsad tarixda qoladi; [from] dan oldingi seriyalar eski maqsad
  /// bilan baholanishda davom etadi.
  Future<void> changeTarget(
    String setId,
    String levelId, {
    required String lot,
    required double mean,
    required double sd,
    DateTime? from,
    QcTargetSource? source,
  }) async {
    final set = _data.set(setId);
    final level = set?.level(levelId);
    if (set == null || level == null) {
      throw ArgumentError.value('$setId/$levelId', 'level');
    }
    final previousStart = level.since ?? set.createdAt;
    // “Hozirdan”: qurilma soati orqaga ketgan bo'lsa ham oldingi davrdan
    // oldin boshlanmaydi.
    var start = from ?? _clock();
    if (from == null && start.isBefore(previousStart)) start = previousStart;
    if (!mean.isFinite ||
        !sd.isFinite ||
        !(sd > 0) ||
        start.isBefore(previousStart)) {
      throw ArgumentError('invalid target');
    }
    final updated = QcSet(
      id: set.id,
      name: set.name,
      unit: set.unit,
      targetSource: set.targetSource,
      createdAt: set.createdAt,
      levels: [
        for (final l in set.levels)
          l.id == levelId
              ? QcLevel(
                  id: l.id,
                  label: l.label,
                  lot: l.lot,
                  mean: l.mean,
                  sd: l.sd,
                  // Birinchi maqsadning boshlanishi aniq yozib qo'yiladi.
                  since: l.since ?? set.createdAt,
                  source: l.source,
                  previous: l.previous,
                ).withTarget(
                  lot: lot.trim(),
                  mean: mean,
                  sd: sd,
                  from: start,
                  source: source,
                )
              : l,
      ],
    );
    await _save(
      QcData(
        sets: [for (final s in _data.sets) s.id == setId ? updated : s],
        runs: _data.runs,
      ),
    );
  }

  /// Seriya qo'shish. Kamida bitta daraja qiymati bo'lishi, hamma qiymat
  /// chekli bo'lishi va to'plamdagi darajaga tegishli bo'lishi shart.
  Future<QcRun> addRun(
    String setId,
    Map<String, double> values, {
    String? note,
    DateTime? at,
  }) async {
    final set = _data.set(setId);
    if (set == null) throw ArgumentError.value(setId, 'setId');
    if (values.isEmpty ||
        values.values.any((v) => !v.isFinite) ||
        values.keys.any((k) => set.level(k) == null)) {
      throw ArgumentError.value(values, 'values');
    }
    final draft = QcRun(
      id: _newId(),
      at: at ?? _clock(),
      values: Map.unmodifiable(values),
      note: note?.trim().isEmpty ?? true ? null : note!.trim(),
    );
    // Kiritilgan paytdagi Westgard xulosasi audit uchun yoziladi.
    final provisional = [..._data.runsOf(setId), draft]
      ..sort((a, b) => a.at.compareTo(b.at));
    final result = evaluateRuns(
      set,
      provisional,
    ).firstWhere((r) => r.run.id == draft.id);
    final run = draft.withEntered(result.verdict.name, [
      for (final rule in result.rules) rule.code,
    ]);
    final runs = [for (final r in provisional) r.id == run.id ? run : r];
    await _save(QcData(sets: _data.sets, runs: {..._data.runs, setId: runs}));
    return run;
  }

  /// Oxirgi maqsad almashtirishini bekor qilish (xato kiritilgan bo'lsa):
  /// joriy maqsad o'chiriladi, oldingisi qaytadi; seriyalar qayta baholanadi.
  Future<void> undoTargetChange(String setId, String levelId) async {
    final set = _data.set(setId);
    final level = set?.level(levelId);
    if (set == null || level == null || level.previous.isEmpty) {
      throw ArgumentError.value('$setId/$levelId', 'level');
    }
    final restored = level.previous.last;
    final updated = QcSet(
      id: set.id,
      name: set.name,
      unit: set.unit,
      targetSource: set.targetSource,
      createdAt: set.createdAt,
      levels: [
        for (final l in set.levels)
          l.id == levelId
              ? QcLevel(
                  id: l.id,
                  label: l.label,
                  lot: restored.lot,
                  mean: restored.mean,
                  sd: restored.sd,
                  since: restored.from,
                  source: restored.source,
                  previous: l.previous.sublist(0, l.previous.length - 1),
                )
              : l,
      ],
    );
    await _save(
      QcData(
        sets: [for (final s in _data.sets) s.id == setId ? updated : s],
        runs: _data.runs,
      ),
    );
  }

  Future<void> deleteRun(String setId, String runId) => _save(
    QcData(
      sets: _data.sets,
      runs: {
        ..._data.runs,
        setId: [
          for (final r in _data.runsOf(setId))
            if (r.id != runId) r,
        ],
      },
    ),
  );

  /// “Lokal ma'lumotlarni o'chirish”dan keyin xotiradagi holatni tozalash.
  void resetInMemory() {
    _data = const QcData();
    _loadError = null;
    notifyListeners();
  }
}
