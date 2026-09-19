/// Yakuniy matritsa hisoboti.
///
/// Har bir sinov qatori shu yerga yoziladi, oxirida esa butun matritsa
/// bitta JSON blok bo'lib chiqadi. CI uni logdan ajratib olib,
/// `$GITHUB_STEP_SUMMARY` ga jadval qilib yozadi.
///
/// ## NIMA UCHUN `expect` YETARLI EMAS
///
/// Oddiy testda muvaffaqiyatsizlik — bu istisno va ish to'xtaydi.
/// Bu yerda aksincha: bitta qator yiqilsa ham QOLGANLARI tekshirilishi
/// kerak, chunki maqsad — to'liq manzara. Shuning uchun qatorlar
/// yig'iladi, testning o'zi esa faqat eng oxirida, hamma narsa
/// yozilgandan keyin baholanadi.
library;

import 'dart:convert';

import 'creds.dart';



enum Verdict {
  pass('PASS'),
  fail('FAIL'),
  partial('PARTIAL'),
  backendRequired('BACKEND REQUIRED'),
  configRequired('CONFIG REQUIRED'),
  deviceRequired('DEVICE REQUIRED'),
  manualPayment('MANUAL PAYMENT TEST REQUIRED'),

  /// ATAYLAB YO'Q va shu holat kelishilgan.
  ///
  /// `FAIL` dan farqi: bu buzilgan narsa emas, olib qo'yilgan narsa.
  /// Biometrika shunday — `local_auth` Android buildini qotirgani
  /// uchun chiqarib tashlangan. Uni `FAIL` deb belgilash ishni
  /// har safar qizartirardi va HAQIQIY yangi buzilish o'sha
  /// shovqinda ko'rinmay qolardi.
  deferred('KNOWN MISSING'),
  skipped('SKIPPED');

  const Verdict(this.label);
  final String label;

  /// Ishni yiqitadigan holat.
  ///
  /// FAQAT `FAIL`. Qolganlari — ma'lum cheklovlar (backend, config,
  /// qurilma, to'lov) yoki ataylab qoldirilgan narsalar.
  bool get isCritical => this == Verdict.fail;
}

/// Bitta HTTP so'rovning izi — FAIL sababini ko'rsatish uchun.
class Trace {
  const Trace({
    required this.method,
    required this.path,
    this.status,
    this.request,
    this.response,
  });

  final String method;
  final String path;
  final int? status;
  final String? request;
  final String? response;

  Map<String, dynamic> toJson() => {
        'method': method,
        'path': redact(path),
        if (status != null) 'status': status,
        if (request != null) 'request': redact(request),
        if (response != null) 'response': redact(response),
      };

  @override
  String toString() =>
      '$method ${redact(path)} -> ${status ?? '-'}${response == null ? '' : ' ${redact(response)}'}';
}

class MatrixRow {
  MatrixRow({
    required this.name,
    required this.verdict,
    this.screen,
    this.action,
    this.trace,
    this.cause,
    this.layer,
    this.fix,
    this.retest,
    this.note,
  });

  /// Matritsadagi qator nomi — foydalanuvchi bergan ro'yxat bilan bir xil.
  final String name;
  final Verdict verdict;

  /// FAIL/PARTIAL uchun majburiy tafsilotlar.
  final String? screen;
  final String? action;
  final Trace? trace;
  final String? cause;

  /// `frontend` | `backend` | `config` | `device`.
  final String? layer;
  final String? fix;
  final String? retest;
  final String? note;

  Map<String, dynamic> toJson() => {
        'name': name,
        'verdict': verdict.label,
        if (screen != null) 'screen': screen,
        if (action != null) 'action': action,
        if (trace != null) 'trace': trace!.toJson(),
        if (cause != null) 'cause': redact(cause),
        if (layer != null) 'layer': layer,
        if (fix != null) 'fix': fix,
        if (retest != null) 'retest': retest,
        if (note != null) 'note': redact(note),
      };
}

/// Butun ish davomida bitta ro'yxat.
class E2EReport {
  E2EReport._();
  static final E2EReport instance = E2EReport._();

  final List<MatrixRow> _rows = [];
  final List<String> _cleanupProblems = [];

  List<MatrixRow> get rows => List.unmodifiable(_rows);

  void add(MatrixRow row) {
    _rows.add(row);
    // Jonli kuzatish uchun — CI logida qator paydo bo'lishi bilan
    // ko'rinadi, oxirigacha kutish shart emas.
    // ignore: avoid_print
    print('[E2E] ${row.verdict.label.padRight(28)} ${row.name}'
        '${row.trace == null ? '' : '  |  ${row.trace}'}');
  }

  void pass(String name, {String? screen, String? action, String? note}) =>
      add(MatrixRow(
          name: name,
          verdict: Verdict.pass,
          screen: screen,
          action: action,
          note: note));

  void skip(String name, String why) =>
      add(MatrixRow(name: name, verdict: Verdict.skipped, note: why));

  void cleanupProblem(String what) {
    _cleanupProblems.add(what);
    // ignore: avoid_print
    print('[E2E][CLEANUP] TOZALANMADI: ${redact(what)}');
  }

  /// Tozalanmay qolgan sinov obyektlari — bularni qo'lda o'chirish kerak.
  List<String> get cleanupProblems => List.unmodifiable(_cleanupProblems);

  /// Ishni yiqitishi kerak bo'lgan qatorlar.
  List<MatrixRow> get criticalFailures =>
      _rows.where((r) => r.verdict.isCritical).toList();

  Map<Verdict, int> get tally {
    final out = <Verdict, int>{};
    for (final r in _rows) {
      out[r.verdict] = (out[r.verdict] ?? 0) + 1;
    }
    return out;
  }

  /// CI ajratib oladigan blok.
  void emit() {
    final payload = {
      'generatedAt': DateTime.now().toUtc().toIso8601String(),
      'tally': {
        for (final e in tally.entries) e.key.label: e.value,
      },
      'cleanupProblems': _cleanupProblems.map(redact).toList(),
      'rows': _rows.map((r) => r.toJson()).toList(),
    };
    // ignore: avoid_print
    print('<<<E2E_MATRIX_JSON>>>');
    // ignore: avoid_print
    print(const JsonEncoder.withIndent('  ').convert(payload));
    // ignore: avoid_print
    print('<<<END_E2E_MATRIX_JSON>>>');
  }
}
