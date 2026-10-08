import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/qc/qc_model.dart';
import 'package:labguide/features/qc/qc_rules.dart';

/// Daraja 1: o'rtacha 100, SD 10; daraja 2: o'rtacha 200, SD 20.
/// Qiymat z dan hisoblanadi: L1 = 100 + 10z, L2 = 200 + 20z.
final set = QcSet(
  id: 's',
  name: 'Test',
  unit: 'mg/dL',
  targetSource: QcTargetSource.laboratory,
  createdAt: DateTime(2026),
  levels: const [
    QcLevel(id: 'L1', label: '1', lot: '', mean: 100, sd: 10),
    QcLevel(id: 'L2', label: '2', lot: '', mean: 200, sd: 20),
  ],
);

List<QcRunResult> evalZ(List<({double? l1, double? l2})> zs) =>
    evaluateRuns(set, [
      for (final (i, z) in zs.indexed)
        QcRun(
          id: 'r$i',
          at: DateTime(2026, 1, 1).add(Duration(hours: i)),
          values: {
            if (z.l1 != null) 'L1': 100 + 10 * z.l1!,
            if (z.l2 != null) 'L2': 200 + 20 * z.l2!,
          },
        ),
    ]);

void main() {
  test('in-control run is accepted; exactly ±2 SD is not a violation', () {
    final r = evalZ([(l1: 2.0, l2: -2.0)]).single;
    expect(r.violations, isEmpty);
    expect(r.verdict, QcVerdict.accept);
    expect(r.z['L1'], closeTo(2, 1e-12));
  });

  test('1-2s alone is a warning', () {
    final r = evalZ([(l1: 2.5, l2: 0.3)]).single;
    expect(r.rules, {QcRule.r12s});
    expect(r.verdict, QcVerdict.warning);
  });

  test('1-3s rejects', () {
    final r = evalZ([(l1: -3.4, l2: null)]).single;
    expect(r.rules, containsAll([QcRule.r13s, QcRule.r12s]));
    expect(r.verdict, QcVerdict.reject);
  });

  test('2-2s within a run (both levels, same side)', () {
    final r = evalZ([(l1: 2.3, l2: 2.6)]).single;
    expect(r.rules, contains(QcRule.r22s));
    final v = r.violations.firstWhere((v) => v.rule == QcRule.r22s);
    expect(v.levelIds, {'L1', 'L2'});
    expect(v.acrossRuns, isFalse);
  });

  test('2-2s across runs (same level, consecutive)', () {
    final rs = evalZ([(l1: 2.3, l2: 0), (l1: 2.6, l2: 0)]);
    expect(rs.first.verdict, QcVerdict.warning);
    final v = rs.last.violations.firstWhere((v) => v.rule == QcRule.r22s);
    expect(v.acrossRuns, isTrue);
    expect(rs.last.verdict, QcVerdict.reject);
  });

  test('2-2s needs the same side', () {
    final rs = evalZ([(l1: 2.3, l2: 0), (l1: -2.6, l2: 0)]);
    expect(rs.last.rules, isNot(contains(QcRule.r22s)));
  });

  test('R-4s: one above +2 SD and another below −2 SD in the same run', () {
    final r = evalZ([(l1: 2.4, l2: -2.2)]).single;
    expect(r.rules, contains(QcRule.rR4s));
    expect(r.verdict, QcVerdict.reject);
    // Ikki seriya bo'ylab R-4s qo'llanmaydi.
    final across = evalZ([(l1: 2.4, l2: null), (l1: -2.4, l2: null)]);
    expect(across.last.rules, isNot(contains(QcRule.rR4s)));
  });

  test('4-1s within one level across four runs', () {
    final rs = evalZ([
      (l1: 1.2, l2: null),
      (l1: 1.5, l2: null),
      (l1: 1.1, l2: null),
      (l1: 1.3, l2: null),
    ]);
    expect(rs.take(3).every((r) => r.violations.isEmpty), isTrue);
    expect(rs.last.rules, {QcRule.r41s});
    expect(rs.last.verdict, QcVerdict.reject);
  });

  test('4-1s across levels: two runs × two levels', () {
    final rs = evalZ([(l1: 1.2, l2: 1.4), (l1: 1.1, l2: 1.6)]);
    final v = rs.last.violations.firstWhere((v) => v.rule == QcRule.r41s);
    expect(v.levelIds, {'L1', 'L2'});
  });

  test('10x: ten consecutive values on one side of the mean', () {
    final rs = evalZ([for (var i = 0; i < 10; i++) (l1: 0.4, l2: null)]);
    expect(rs[8].violations, isEmpty);
    expect(rs.last.rules, {QcRule.r10x});
    // Bitta qiymat o'rtachaning boshqa tomonida — ketma-ketlik uziladi.
    final broken = evalZ([
      for (var i = 0; i < 9; i++) (l1: 0.4, l2: null),
      (l1: -0.1, l2: null),
    ]);
    expect(broken.last.violations, isEmpty);
  });

  test('a rejected run does not taint the next in-control run', () {
    final rs = evalZ([(l1: 3.5, l2: 0), (l1: 0.2, l2: -0.1)]);
    expect(rs.first.verdict, QcVerdict.reject);
    expect(rs.last.verdict, QcVerdict.accept);
  });

  test('missing levels and invalid SD are skipped, not guessed', () {
    final bad = QcSet(
      id: 'b',
      name: 'x',
      unit: '',
      targetSource: QcTargetSource.manufacturer,
      createdAt: DateTime(2026),
      levels: const [QcLevel(id: 'L1', label: '1', lot: '', mean: 1, sd: 0)],
    );
    final r = evaluateRuns(bad, [
      QcRun(id: 'r', at: DateTime(2026), values: const {'L1': 9}),
    ]).single;
    expect(r.z, isEmpty);
    expect(r.verdict, QcVerdict.accept);
  });
}
