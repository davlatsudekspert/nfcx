import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

void main() {
  setUpAll(loadAppFonts);

  testWidgets('research draft is kept without pressing Save', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 1600));
    await goTo(tester, '/library/research');
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'HbA1c vs fructosamine');
    await tester.enterText(fields.at(1), 'Compare in CKD stage 4');
    // Darhol boshqa sahifaga o'tish — “Saqlash” bosilmagan.
    await goTo(tester, '/library');
    await tester.pumpAndSettle();
    expect(
      s.store.getString(StoreKeys.researchQuestion),
      'HbA1c vs fructosamine',
    );
    expect(
      s.store.getString(StoreKeys.researchNotes),
      'Compare in CKD stage 4',
    );

    // Qayta ochilganda qoralama joyida.
    await goTo(tester, '/library/research');
    expect(find.text('HbA1c vs fructosamine'), findsOneWidget);
  });

  testWidgets('lesson draft autosaves after a short pause', (tester) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 1600));
    await goTo(tester, '/learn/lesson');
    await tester.enterText(find.byType(TextField).at(1), 'Pre-analytics');
    await tester.pump(const Duration(seconds: 1));
    expect(s.store.getString(StoreKeys.lessonNotes), 'Pre-analytics');
  });
}
