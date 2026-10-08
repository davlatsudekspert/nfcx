import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/qc/qc_controller.dart';
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
    // Maydonlar tartibi: nom, birlik, 1-daraja (nom, lot, o'rtacha, SD),
    // 2-daraja (nom, lot, o'rtacha, SD).
    final f = find.byType(TextField);
    await tester.enterText(f.at(0), 'Glucose');
    await tester.enterText(f.at(1), 'mmol/L');
    await tester.enterText(f.at(2), 'Low');
    await tester.enterText(f.at(4), '5,0');
    await tester.enterText(f.at(5), '0');
    await _tap(tester, find.text(en.qcSave));
    expect(find.text(en.qcErrLevel('1')), findsOneWidget);
    // Juda katta SD (1e400 = cheksiz) ham qabul qilinmaydi.
    await tester.enterText(f.at(5), '1e400');
    await _tap(tester, find.text(en.qcSave));
    expect(find.text(en.qcErrLevel('1')), findsOneWidget);
    await tester.enterText(f.at(5), '0.2');
    await tester.enterText(f.at(8), '15');
    await tester.enterText(f.at(9), '0.5');
    await _tap(tester, find.text(en.qcSave));
    expect(s.qc.data.sets.single.levels.map((l) => l.label), ['Low', '2']);

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

    // Rad etilgan seriya keyingi qoidalar va statistikada ishlatilmaydi.
    expect(find.text(en.qcRejectedExcluded), findsOneWidget);

    // Bo'sh seriya saqlanmaydi.
    await _tap(tester, find.text(en.qcSaveRun));
    expect(find.text(en.qcErrRunEmpty), findsOneWidget);

    // Cheksiz qiymat saqlanmaydi, tugma “osilib” qolmaydi.
    await tester.enterText(levelFields.first, '1e400');
    await _tap(tester, find.text(en.qcSaveRun));
    expect(find.text(en.qcErrNotFinite('Low')), findsOneWidget);
    await tester.enterText(levelFields.first, '');

    // Yangi lot: maqsad almashtiriladi, eski maqsad tarixda ko'rinadi.
    await _tap(tester, find.byTooltip(en.qcChangeTarget).first);
    expect(find.text(en.qcChangeTargetBody), findsOneWidget);
    // Kuzatilgan x̄/SD: 1-darajada faqat bitta qabul qilingan seriya bor
    // (ikkinchisi rad etilgan) — tugma ko'rsatilmaydi.
    expect(find.textContaining('Use observed'), findsNothing);
    final tf = find.byType(TextField);
    await tester.enterText(tf.at(0), 'A-2');
    await tester.enterText(tf.at(1), '5.6');
    await tester.enterText(tf.at(2), '0.25');
    await _tap(tester, find.text(en.qcSourceManufacturer).last);
    expect(find.text(en.qcManufacturerWarning), findsOneWidget);
    await _tap(tester, find.text(en.qcSave));
    expect(find.textContaining('Previous: '), findsOneWidget);
    final changed = s.qc.data.sets.single;
    expect(
      changed.sourceOf(changed.level('L1')!.current),
      QcTargetSource.manufacturer,
    );
    // Manbalar har xil — sarlavhada emas, daraja qatorida ko'rsatiladi.
    expect(find.textContaining(en.qcSourceManufacturer), findsWidgets);
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

  testWidgets('backup: copy, restore from clipboard, reject garbage', (
    tester,
  ) async {
    String? clip;
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        clip = (call.arguments as Map)['text'] as String?;
        return null;
      }
      if (call.method == 'Clipboard.getData') return {'text': clip};
      return null;
    });
    addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
    );
    final s = await makeServices(tester, language: AppLanguage.en);
    final set = await tester.runAsync(
      () => s.qc.addSet(
        name: 'K',
        unit: 'mmol/L',
        targetSource: QcTargetSource.laboratory,
        levels: [(label: '1', lot: 'A', mean: 4.0, sd: 0.1)],
      ),
    );
    await tester.runAsync(() => s.qc.addRun(set!.id, {'L1': 4.05}));
    await pumpApp(tester, s, size: const Size(390, 3600));
    await goTo(tester, '/lab/qc');

    await _tap(tester, find.text(en.qcBackupCopy));
    expect(find.text(en.qcBackupCopied), findsOneWidget);
    expect(QcController.parseBackup(clip!).sets.single.name, 'K');

    await tester.runAsync(() => s.qc.deleteSet(set!.id));
    await tester.pumpAndSettle();
    expect(find.text(en.qcEmptyTitle), findsOneWidget);

    await _tap(tester, find.text(en.qcBackupRestore));
    expect(find.text(en.qcRestoreConfirm(1, 1)), findsOneWidget);
    await tester.tap(find.text(en.qcRestoreAction));
    await tester.pumpAndSettle();
    expect(s.qc.data.sets.single.name, 'K');
    expect(s.qc.data.runsOf(set!.id), hasLength(1));
    expect(find.text(en.qcRestored), findsOneWidget);

    clip = '{"version": 1, "sets": "x"}';
    await _tap(tester, find.text(en.qcBackupRestore));
    expect(find.text(en.qcRestoreInvalid), findsOneWidget);
    expect(s.qc.data.sets, hasLength(1));
  });

  testWidgets('unreadable QC data: copy the text, then delete with consent', (
    tester,
  ) async {
    String? clip;
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        clip = (call.arguments as Map)['text'] as String?;
      }
      return null;
    });
    addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
    );
    final store = MemoryKeyValueStore();
    await store.setString(StoreKeys.qcData, '{"version": 99}');
    final s = await makeServices(
      tester,
      store: store,
      language: AppLanguage.en,
    );
    await pumpApp(tester, s, size: const Size(390, 3600));
    await goTo(tester, '/lab/qc');
    expect(find.text(en.qcLoadError), findsOneWidget);
    expect(find.text(en.qcAddSet), findsNothing);

    await _tap(tester, find.text(en.qcCopyRaw));
    expect(clip, '{"version": 99}');

    await _tap(tester, find.text(en.qcDiscard));
    expect(find.text(en.qcDiscardConfirm), findsOneWidget);
    await tester.tap(find.text(en.actionCancel));
    await tester.pumpAndSettle();
    expect(store.getString(StoreKeys.qcData), '{"version": 99}');

    await _tap(tester, find.text(en.qcDiscard));
    await tester.tap(find.text(en.actionDelete));
    await tester.pumpAndSettle();
    expect(store.getString(StoreKeys.qcData), isNull);
    expect(find.text(en.qcEmptyTitle), findsOneWidget);
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
