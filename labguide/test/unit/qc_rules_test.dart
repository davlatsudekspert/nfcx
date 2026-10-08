import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/qc/qc_export.dart';
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

  test('a rejected run is not reused by later across-run rules', () {
    // 1-3s rad → tuzatildi → qayta seriya +2.2: faqat 1-2s ogohlantirish,
    // rad etilgan +3.5 bilan 2-2s hosil qilmaydi (D-27).
    final rs = evalZ([(l1: 3.5, l2: 0), (l1: 2.2, l2: 0)]);
    expect(rs.first.verdict, QcVerdict.reject);
    expect(rs.last.rules, {QcRule.r12s});
    expect(rs.last.verdict, QcVerdict.warning);
    // Qabul qilingan seriyalar esa hisobga olinadi.
    final kept = evalZ([(l1: 2.3, l2: 0), (l1: 2.2, l2: 0)]);
    expect(kept.last.rules, contains(QcRule.r22s));
  });

  test('values exactly on a limit with decimal targets are not violations', () {
    // x̄ 5.0, SD 0.2: 5.4 da z = 2.0000000000000018 (suzuvchi nuqta).
    final dec = QcSet(
      id: 'd',
      name: 'K',
      unit: 'mmol/L',
      targetSource: QcTargetSource.laboratory,
      createdAt: DateTime(2026),
      levels: const [QcLevel(id: 'L1', label: '1', lot: '', mean: 5, sd: 0.2)],
    );
    List<QcRunResult> eval(List<double> xs) => evaluateRuns(dec, [
      for (final (i, x) in xs.indexed)
        QcRun(
          id: 'r$i',
          at: DateTime(2026, 1, 1).add(Duration(hours: i)),
          values: {'L1': x},
        ),
    ]);
    expect(eval([5.4]).single.violations, isEmpty);
    expect(eval([4.6]).single.violations, isEmpty);
    expect(eval([5.4, 5.4]).last.violations, isEmpty);
    expect(eval([5.2, 5.2, 5.2, 5.2]).last.violations, isEmpty);
    // Aynan +3 SD: 1-2s ogohlantirish, lekin 1-3s emas.
    expect(eval([5.6]).single.rules, {QcRule.r12s});
    expect(eval([5.41]).single.rules, {QcRule.r12s});
  });

  test('three-level set: 2-2s and R-4s within a run', () {
    final three = QcSet(
      id: 't',
      name: 'x',
      unit: '',
      targetSource: QcTargetSource.laboratory,
      createdAt: DateTime(2026),
      levels: const [
        QcLevel(id: 'L1', label: '1', lot: '', mean: 100, sd: 10),
        QcLevel(id: 'L2', label: '2', lot: '', mean: 200, sd: 20),
        QcLevel(id: 'L3', label: '3', lot: '', mean: 300, sd: 30),
      ],
    );
    final r = evaluateRuns(three, [
      QcRun(
        id: 'a',
        at: DateTime(2026),
        values: const {'L1': 125, 'L2': 150, 'L3': 380},
      ),
    ]).single;
    // L1 +2.5, L2 −2.5, L3 +2.67: 2-2s (L1, L3) va R-4s.
    expect(r.rules, containsAll([QcRule.r22s, QcRule.rR4s]));
    expect(r.violations.firstWhere((v) => v.rule == QcRule.r22s).levelIds, {
      'L1',
      'L3',
    });
    expect(r.levelVerdict('L2'), QcVerdict.reject); // R-4s da ishtirok etadi
  });

  test('CSV escapes text that a spreadsheet would run as a formula', () {
    final evil = QcSet(
      id: 'e',
      name: '=HYPERLINK("x")',
      unit: '@u',
      targetSource: QcTargetSource.laboratory,
      createdAt: DateTime(2026),
      levels: const [
        QcLevel(id: 'L1', label: '-1', lot: '+L', mean: 100, sd: 10),
      ],
    );
    final rs = evaluateRuns(evil, [
      QcRun(
        id: 'a',
        at: DateTime(2026),
        values: const {'L1': 80},
        note: '=1+1',
      ),
    ]);
    final row = qcCsv(evil, rs).trim().split('\n').last;
    expect(row, contains('"\'=HYPERLINK(""x"")"'));
    expect(row, contains(",'-1,'+L,80.0,'@u,"));
    expect(row, endsWith(",'=1+1"));
    // Raqamlar (manfiy z ham) o'zgarmaydi.
    expect(row, contains(',-2.00,'));
  });

  test('each run is evaluated with the target in effect at its time', () {
    final changed = QcSet(
      id: 's',
      name: 'Test',
      unit: 'mg/dL',
      targetSource: QcTargetSource.laboratory,
      createdAt: DateTime(2026),
      levels: [
        const QcLevel(
          id: 'L1',
          label: '1',
          lot: 'A',
          mean: 100,
          sd: 10,
        ).withTarget(lot: 'B', mean: 130, sd: 5, from: DateTime(2026, 2)),
      ],
    );
    final rs = evaluateRuns(changed, [
      QcRun(id: 'a', at: DateTime(2026, 1, 10), values: const {'L1': 125}),
      QcRun(id: 'b', at: DateTime(2026, 2, 10), values: const {'L1': 125}),
    ]);
    // Eski lot: (125 − 100)/10 = +2.5 → 1-2s; yangi lot: (125 − 130)/5 = −1.
    expect(rs.first.z['L1'], closeTo(2.5, 1e-12));
    expect(rs.first.verdict, QcVerdict.warning);
    expect(rs.last.z['L1'], closeTo(-1, 1e-12));
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

  test('CSV export: one row per level value, quoting, target at run time', () {
    final rs = evalZ([(l1: 2.5, l2: 0), (l1: null, l2: -1)]);
    final noted = [
      QcRunResult(
        run: QcRun(
          id: rs.first.run.id,
          at: rs.first.run.at,
          values: rs.first.run.values,
          note: 'qayta, "tekshirildi"',
        ),
        z: rs.first.z,
        violations: rs.first.violations,
      ),
      rs.last,
    ];
    final csv = qcCsv(set, noted);
    final lines = csv.trim().split('\n');
    expect(lines, hasLength(4)); // sarlavha + 3 qiymat
    expect(lines.first, startsWith('date,test,level,lot,value'));
    expect(
      lines[1],
      contains(',1,,125.0,mg/dL,100.0,10.0,2.50,warning,warning,1-2s,'),
    );
    expect(lines[1], endsWith('"qayta, ""tekshirildi"""'));
    // Seriya xulosasi “warning”, lekin 2-daraja o'zi nazoratda.
    expect(
      lines[2],
      contains(',2,,200.0,mg/dL,200.0,20.0,0.00,warning,accept,,'),
    );
    expect(lines[3], contains(',2,,180.0,'));
  });
}
