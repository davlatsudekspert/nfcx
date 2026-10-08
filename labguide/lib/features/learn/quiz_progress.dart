import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/storage/kv_store.dart';

/// Bitta savol bo'yicha natija tarixi (faqat qurilmada).
@immutable
class QuestionStat {
  const QuestionStat({
    required this.correct,
    required this.wrong,
    required this.lastCorrect,
  });

  factory QuestionStat.fromJson(Map<String, Object?> json) => QuestionStat(
    correct: json['c'] as int? ?? 0,
    wrong: json['w'] as int? ?? 0,
    lastCorrect: json['l'] as bool? ?? false,
  );

  final int correct;
  final int wrong;

  /// Oxirgi javob to'g'ri bo'lganmi — “xatolar ustida ishlash” shunga tayanadi.
  final bool lastCorrect;

  Map<String, Object?> toJson() => {'c': correct, 'w': wrong, 'l': lastCorrect};
}

/// Mashq natijalari: qaysi savolga oxirgi marta noto'g'ri javob berilgan,
/// mavzu bo'yicha nechtasi o'zlashtirilgan. Ma'lumot faqat qurilmada.
class QuizProgressController extends ChangeNotifier {
  QuizProgressController(this._store) {
    final raw = _store.getString(StoreKeys.quizProgress);
    if (raw == null) return;
    try {
      final json = (jsonDecode(raw) as Map).cast<String, Object?>();
      _stats.addAll({
        for (final e in json.entries)
          e.key: QuestionStat.fromJson(
            (e.value as Map).cast<String, Object?>(),
          ),
      });
    } on Object {
      // Buzilgan yozuv — progress muhim emas, yangidan boshlanadi.
      _stats.clear();
    }
  }

  final KeyValueStore _store;
  final Map<String, QuestionStat> _stats = {};

  QuestionStat? statFor(String questionId) => _stats[questionId];

  Future<void> record(String questionId, {required bool correct}) async {
    final s = _stats[questionId];
    _stats[questionId] = QuestionStat(
      correct: (s?.correct ?? 0) + (correct ? 1 : 0),
      wrong: (s?.wrong ?? 0) + (correct ? 0 : 1),
      lastCorrect: correct,
    );
    notifyListeners();
    await _store.setString(
      StoreKeys.quizProgress,
      jsonEncode({for (final e in _stats.entries) e.key: e.value.toJson()}),
    );
  }

  /// Oxirgi javobi noto'g'ri bo'lgan savollar (berilgan ro'yxat ichidan).
  Iterable<String> mistakes(Iterable<String> questionIds) =>
      questionIds.where((id) => _stats[id]?.lastCorrect == false);

  /// Oxirgi javobi to'g'ri bo'lgan savollar soni.
  int mastered(Iterable<String> questionIds) =>
      questionIds.where((id) => _stats[id]?.lastCorrect ?? false).length;

  void resetInMemory() {
    _stats.clear();
    notifyListeners();
  }
}
