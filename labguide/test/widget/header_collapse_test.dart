import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

void main() {
  setUpAll(loadAppFonts);

  // Tab ildizida kengaytirilgan holatda yuqori panelda brend, ixcham
  // holatda — sahifa sarlavhasi.
  Finder brand() => find.text('LabGuide');

  testWidgets('collapsed header expands when content stops scrolling', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 844));
    await goTo(tester, '/tests');
    expect(brand(), findsOneWidget);

    await tester.drag(find.byType(ListView).last, const Offset(0, -60));
    await tester.pumpAndSettle();
    expect(brand(), findsNothing, reason: 'collapsed after scrolling down');

    // Natijasiz qidiruv: kontent qisqaradi, scroll qilib bo'lmaydi —
    // sarlavha kengayishi shart (avval Android'da qotib qolardi).
    await tester.enterText(find.byType(TextField).first, 'zzzzqqqq');
    await tester.pumpAndSettle();
    expect(brand(), findsOneWidget, reason: 'expanded when not scrollable');
  });
}
