import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/qc/qc_model.dart';
import 'package:labguide/features/qc/qc_rules.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.pumpAndSettle();
  await tester.tap(f.hitTestable().first);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('create a QC test, add runs, see Westgard verdicts', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 3600));
    await goTo(tester, '/lab/qc');
    expect(find.text(en.qcEmptyTitle), findsOneWidget);
    await _tap(tester, find.text(en.qcAddSet));

    // Validatsiya: nom va SD > 0 talab qilinadi.
    await _tap(tester, find.text(en.qcSave));
    expect(find.text(en.qcErrName), findsOneWidget);
    // Maydonlar tartibi: nom, birlik, 1-daraja (lot, o'rtacha, SD),
    // 2-daraja (lot, o'rtacha, SD).
    final f = find.byType(TextField);
    await tester.enterText(f.at(0), 'Glucose');
    await tester.enterText(f.at(1), 'mmol/L');
    await tester.enterText(f.at(3), '5,0');
    await tester.enterText(f.at(4), '0');
    await _tap(tester, find.text(en.qcSave));
    expect(find.text(en.qcErrLevel('1')), findsOneWidget);
    await tester.enterText(f.at(4), '0.2');
    await tester.enterText(f.at(6), '15');
    await tester.enterText(f.at(7), '0.5');
    await _tap(tester, find.text(en.qcSave));

    // To'plam sahifasi.
    expect(find.text('Glucose'), findsWidgets);
    expect(find.text(en.qcNoRunsYet), findsOneWidget);
    expect(s.store.getString(StoreKeys.qcData), isNotNull);

    // Maydonlar: 1-daraja, 2-daraja, izoh.
    final levelFields = find.byType(TextField);
    // Seriya 1: L1 z = +2.5 → 1-2s ogohlantirish.
    await tester.enterText(levelFields.first, '5.5');
    await tester.enterText(levelFields.at(1), '15.1');
    await _tap(tester, find.text(en.qcSaveRun));
    expect(find.text(en.qcWarning), findsWidgets);
    expect(
      find.textContaining(qcRuleText[QcRule.r12s]!.of('en')),
      findsOneWidget,
    );

    // Seriya 2: L1 z = +3.5 → 1-3s rad.
    await tester.enterText(levelFields.first, '5.7');
    await _tap(tester, find.text(en.qcSaveRun));
    expect(find.text(en.qcReject), findsWidgets);
    expect(
      find.textContaining(qcRuleText[QcRule.r13s]!.of('en')),
      findsOneWidget,
    );
    final runs = s.qc.data.runsOf(s.qc.data.sets.single.id);
    expect(runs, hasLength(2));
    expect(
      evaluateRuns(s.qc.data.sets.single, runs).last.verdict,
      QcVerdict.reject,
    );

    // Bo'sh seriya saqlanmaydi.
    await _tap(tester, find.text(en.qcSaveRun));
    expect(find.text(en.qcErrRunEmpty), findsOneWidget);

    // Yangi lot: maqsad almashtiriladi, eski maqsad tarixda ko'rinadi.
    await _tap(tester, find.byTooltip(en.qcChangeTarget).first);
    expect(find.text(en.qcChangeTargetBody), findsOneWidget);
    final tf = find.byType(TextField);
    await tester.enterText(tf.at(0), 'A-2');
    await tester.enterText(tf.at(1), '5.6');
    await tester.enterText(tf.at(2), '0.25');
    await _tap(tester, find.text(en.qcSave));
    expect(find.textContaining('Previous: '), findsOneWidget);
    expect(s.qc.data.sets.single.level('L1')!.lot, 'A-2');
    // Oldingi seriyalar baribir eski maqsad bilan baholanadi.
    final sameRuns = s.qc.data.runsOf(s.qc.data.sets.single.id);
    expect(
      evaluateRuns(s.qc.data.sets.single, sameRuns).last.verdict,
      QcVerdict.reject,
    );

    // Seriyani o'chirish (tasdiq bilan).
    await _tap(tester, find.byTooltip(en.qcDeleteRun));
    await tester.tap(find.text(en.actionDelete));
    await tester.pumpAndSettle();
    expect(s.qc.data.runsOf(s.qc.data.sets.single.id), hasLength(1));
  });

  testWidgets('set screen lays out at 320 px ×2.0 with history', (
    tester,
  ) async {
    for (final lang in AppLanguage.values) {
      final s = await makeServices(tester, language: lang);
      final set = await tester.runAsync(
        () => s.qc.addSet(
          name: 'Kreatinin',
          unit: 'µmol/L',
          targetSource: QcTargetSource.manufacturer,
          levels: [
            (label: '1', lot: 'LOT-2026-A', mean: 88, sd: 4),
            (label: '2', lot: 'LOT-2026-B', mean: 420, sd: 15),
          ],
        ),
      );
      for (final (i, (a, b)) in [
        (90.0, 410.0),
        (97.0, 452.0),
        (81.0, 380.0),
        (100.5, 470.0),
      ].indexed) {
        await tester.runAsync(
          () => s.qc.addRun(set!.id, {
            'L1': a,
            'L2': b,
          }, at: DateTime(2026, 10, 1 + i, 8)),
        );
      }
      await pumpApp(tester, s, size: const Size(320, 6000), textScale: 2);
      await goTo(tester, '/lab/qc/set/${set!.id}');
      expect(tester.takeException(), isNull, reason: lang.name);
      await goTo(tester, '/lab/qc');
      expect(tester.takeException(), isNull, reason: lang.name);
      await tester.pumpWidget(const SizedBox());
    }
  });
}
