import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();

void main() {
  setUpAll(loadAppFonts);

  // Tizim ilovani fonda yopib, qayta ochganda (process death) foydalanuvchi
  // turgan joyiga qaytadi — tab va ichki sahifa tiklanadi.
  testWidgets('open page and tab survive a restart with restoration', (
    tester,
  ) async {
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 1600));
    await goTo(tester, '/lab/calculators/egfr');
    expect(find.text(en.calcEgfr), findsWidgets);

    await tester.restartAndRestore();
    await tester.pumpAndSettle();
    expect(find.text(en.calcEgfr), findsWidgets);
    // Orqaga — o'sha tabning oldingi sahifasi (stek tiklangan).
    await tester.tap(find.byTooltip(en.actionBack));
    await tester.pumpAndSettle();
    expect(find.text(en.calcTitle), findsWidgets);
  });
}
