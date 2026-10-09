import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/app/widgets/lg_page.dart';
import 'package:labguide/design/widgets/lg_widgets.dart';
import 'package:labguide/features/qc/qc_model.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();

Finder _editable(String label) => find.descendant(
  of: find.widgetWithText(LgField, label),
  matching: find.byType(EditableText),
);

/// QC seriya formasi (2 daraja), 2-daraja maydoni fokusda.
Future<Finder> _focusLevel2(WidgetTester tester) async {
  final s = await makeServices(tester, language: AppLanguage.en);
  final set = await tester.runAsync(
    () => s.qc.addSet(
      name: 'Glucose',
      unit: 'mmol/L',
      targetSource: QcTargetSource.laboratory,
      levels: [
        (label: '1', lot: 'A', mean: 5, sd: 0.2),
        (label: '2', lot: 'B', mean: 15, sd: 0.5),
      ],
    ),
  );
  await pumpApp(tester, s, size: const Size(360, 740));
  await goTo(tester, '/lab/qc/set/${set!.id}');
  await tester.scrollUntilVisible(
    find.text(en.qcNote),
    150,
    scrollable: find
        .descendant(
          of: find.byType(ListView).last,
          matching: find.byType(Scrollable),
        )
        .first,
  );
  final level2 = _editable('${en.qcLevel('2')}, mmol/L');
  await tester.ensureVisible(level2);
  await tester.pumpAndSettle();
  await tester.tap(level2);
  await tester.pump();
  return level2;
}

void _expectTypedIntoLevel2(WidgetTester tester, Finder level2) {
  final l2 = tester.widget<EditableText>(level2);
  expect(l2.controller.text, '15.2');
  expect(l2.focusNode.hasFocus, isTrue);
  final l1 = tester.widget<EditableText>(
    _editable('${en.qcLevel('1')}, mmol/L'),
  );
  expect(l1.controller.text, isEmpty);
}

void main() {
  setUpAll(loadAppFonts);

  // Klaviatura ochilganda balandlik kamayadi; sarlavha joylashuvi o'zgarib,
  // ro'yxat elementlari siljisa, yozilgan qiymat boshqa maydonga tushardi
  // (QC da 2-daraja qiymati 1-darajaga yozilib, soxta 1-3s rad).
  testWidgets('keyboard on a short screen keeps typing in the focused field', (
    tester,
  ) async {
    final level2 = await _focusLevel2(tester);

    tester.view.viewInsets = const FakeViewPadding(bottom: 280 * 3.0);
    addTearDown(tester.view.resetViewInsets);
    await tester.pump();
    await tester.pump();
    tester.testTextInput.enterText('15.2');
    await tester.pump();

    // Sarlavha joyi klaviatura ochiq paytda o'zgarmaydi (ro'yxat ustida).
    expect(find.byType(FitLongWordText), findsOneWidget);
    expect(
      find.ancestor(
        of: find.byType(FitLongWordText),
        matching: find.byType(Scrollable),
      ),
      findsNothing,
    );
    _expectTypedIntoLevel2(tester, level2);
  });

  // Klaviatura ochilmasdan balandlik o'zgarsa (tashqi klaviatura bilan
  // ekranni burish): sarlavha ro'yxatga ko'chadi, lekin maydonlar holati
  // (fokus, matn) o'z joyida qoladi.
  testWidgets('rotating with a focused field keeps its state', (tester) async {
    final level2 = await _focusLevel2(tester);
    tester.view.physicalSize = const Size(740, 360) * 3.0;
    await tester.pump();
    await tester.pump();
    // Sarlavha endi ro'yxat ichida (yoki scroll tufayli qurilmagan).
    expect(
      find
          .byType(FitLongWordText)
          .evaluate()
          .every((e) => e.findAncestorWidgetOfExactType<Scrollable>() != null),
      isTrue,
    );
    tester.testTextInput.enterText('15.2');
    await tester.pump();
    _expectTypedIntoLevel2(tester, level2);
  });

  testWidgets('search field keeps focus when the keyboard opens (SE size)', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(375, 667));
    await goTo(tester, '/tests');
    final search = find.byType(EditableText).first;
    await tester.tap(search);
    await tester.pump();
    tester.view.viewInsets = const FakeViewPadding(bottom: 260 * 3.0);
    addTearDown(tester.view.resetViewInsets);
    await tester.pump();
    await tester.pump();
    expect(tester.widget<EditableText>(search).focusNode.hasFocus, isTrue);
    tester.testTextInput.enterText('kreat');
    await tester.pump();
    expect(tester.widget<EditableText>(search).controller.text, 'kreat');
  });
}
