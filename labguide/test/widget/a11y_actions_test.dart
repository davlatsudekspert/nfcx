import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/settings/settings_controller.dart';
import 'package:labguide/l10n/gen/app_localizations_en.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/harness.dart';

final en = AppLocalizationsEn();

void main() {
  setUpAll(loadAppFonts);

  // Android TalkBack ikki marta bosishni semantik TAP amaliga aylantiradi;
  // amal bo'lmasa, hech narsa sodir bo'lmaydi (iOS VoiceOver esa teginishni
  // taqlid qiladi). Shuning uchun har tugmada tap amali bo'lishi shart.
  testWidgets('tabs, back and profile buttons expose a tap action', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    final s = await makeServices(tester, language: AppLanguage.en);
    await pumpApp(tester, s, size: const Size(390, 844));
    await goTo(tester, '/home');
    for (final label in [en.navHome, en.navTests, en.navLab]) {
      expect(find.semantics.byLabel(label), findsOne, reason: label);
      expect(
        tester.getSemantics(find.bySemanticsLabel(label).first),
        isSemantics(label: label, isButton: true, hasTapAction: true),
        reason: label,
      );
    }
    expect(
      tester.getSemantics(find.bySemanticsLabel(en.actionProfile).first),
      isSemantics(hasTapAction: true),
    );

    // TalkBack orqali tab almashtirish ishlaydi.
    tester.semantics.tap(find.semantics.byLabel(en.navLab));
    await tester.pumpAndSettle();
    expect(
      tester.getSemantics(find.bySemanticsLabel(en.navLab).first),
      isSemantics(isSelected: true),
    );

    await goTo(tester, '/lab/calculators');
    expect(
      tester.getSemantics(find.bySemanticsLabel(en.actionBack).first),
      isSemantics(isButton: true, hasTapAction: true),
    );
    handle.dispose();
  });
}
