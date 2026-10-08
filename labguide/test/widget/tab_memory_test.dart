import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/qc/qc_model.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();

void main() {
  setUpAll(loadAppFonts);

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
