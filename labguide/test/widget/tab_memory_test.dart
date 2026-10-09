import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/app/shell.dart';
import 'package:labguide/features/qc/qc_model.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();

void main() {
  setUpAll(loadAppFonts);

  test('branchUnder: path prefix, query only on an exact match', () {
    final m = TabMemory()
      ..record(2, Uri.parse('/lab/calibration?maker=HUMAN'))
      ..record(1, Uri.parse('/tests/analyte/glucose-plasma-fasting'));
    expect(m.branchUnder('/lab/calibration'), 2);
    expect(m.branchUnder('/lab'), 2);
    expect(m.branchUnder('/lab/calibration?maker=HUMAN'), 2);
    expect(m.branchUnder('/lab/calibration?maker=Mindray'), isNull);
    expect(m.branchUnder('/lab/cal'), isNull);
    expect(m.branchUnder('/tests'), 1);
    expect(m.branchUnder('/learn'), isNull);
  });

  testWidgets('home shortcut keeps an open QC set instead of dropping it', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    final set = await tester.runAsync(
      () => s.qc.addSet(
        name: 'Glucose',
        unit: 'mmol/L',
        targetSource: QcTargetSource.laboratory,
        levels: [(label: '1', lot: 'A', mean: 5, sd: 0.2)],
      ),
    );
    await pumpApp(tester, s, size: const Size(390, 1600));
    await goTo(tester, '/lab/qc/set/${set!.id}');
    expect(find.text(en.qcAddRun), findsOneWidget);

    // Bosh tabga o'tib, “Sifat nazorati” tezkor tugmasini bosish.
    await tester.tap(find.text(en.navHome).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text(en.homeHeroLabCta).first);
    await tester.pumpAndSettle();
    // Ochiq to'plam joyida — ro'yxatga qaytarib yuborilmadi.
    expect(find.text(en.qcAddRun), findsOneWidget);
    // Orqaga — QC ro'yxati (stek saqlangan).
    await tester.tap(find.byTooltip(en.actionBack));
    await tester.pumpAndSettle();
    expect(find.text(en.qcAddSet), findsOneWidget);
  });

  // Bosh sahifa tugmasi ochiq to'plamga qaytaradi — yozilgan, hali
  // saqlanmagan qiymat va scroll joyi yo'qolmaydi.
  testWidgets('home shortcut keeps unsaved input in the open QC set', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    final set = await tester.runAsync(
      () => s.qc.addSet(
        name: 'Glucose',
        unit: 'mmol/L',
        targetSource: QcTargetSource.laboratory,
        levels: [(label: '1', lot: 'A', mean: 5, sd: 0.2)],
      ),
    );
    await pumpApp(tester, s, size: const Size(390, 1600));
    // Haqiqiy yo'l: Laboratoriya → Sifat nazorati → to'plam (push).
    await tester.tap(find.text(en.navLab).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text(en.featureQc).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text(set!.name).first);
    await tester.pumpAndSettle();
    expect(find.text(en.qcAddRun), findsOneWidget);
    final field = find.byType(EditableText).first;
    await tester.enterText(field, '5.3');
    await tester.pump();

    await tester.tap(find.text(en.navHome).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text(en.homeHeroLabCta).first);
    await tester.pumpAndSettle();
    expect(find.text(en.qcAddRun), findsOneWidget);
    expect(
      tester
          .widget<EditableText>(find.byType(EditableText).first)
          .controller
          .text,
      '5.3',
    );
    // Stek ham saqlangan: orqaga — QC ro'yxati, yana orqaga — Laboratoriya.
    await tester.tap(find.byTooltip(en.actionBack));
    await tester.pumpAndSettle();
    expect(find.text(en.qcAddSet), findsOneWidget);
  });

  testWidgets('re-tapping the active tab at its root scrolls to the top', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 844));
    await goTo(tester, '/tests');
    final list = find.byType(ListView).last;
    await tester.drag(list, const Offset(0, -600));
    await tester.pumpAndSettle();
    final scrollable = find.descendant(
      of: list,
      matching: find.byType(Scrollable),
    );
    double offset() =>
        tester.state<ScrollableState>(scrollable.first).position.pixels;
    expect(offset(), greaterThan(100));
    await tester.tap(find.text(en.navTests).last);
    await tester.pumpAndSettle();
    expect(offset(), 0);
  });
}
