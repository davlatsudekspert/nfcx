// REELS KADRINING MAKETI.
//
// Ikki narsani qulflaydi, ikkalasi ham egasining xabaridan keldi:
//
//   1) "reelsda rasmlar katta bo'lib ketyapti" — kadr tik (9:19),
//      lentadagi rasmlar esa ko'pincha yotiq. `BoxFit.cover` ularni
//      kattalashtirib chetini qirqardi. Endi `contain`: rasm
//      butunligicha ko'rinadi, orqada esa o'sha rasmning
//      qoraytirilgan nusxasi turadi.
//
//   2) "reelsda qaytish tugmasi bo'lsin" — Reels ildiz ekran va
//      undan chiqish yo'li ko'rinmasdi.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/icons.dart';
import 'package:nfcstore/design/components/media.dart';
import 'package:nfcstore/screens/content/reels.dart';
import 'package:nfcstore/state/app_state.dart';
import 'audit/harness.dart';

void main() {
  setUpAll(loadAuditFonts);

  Future<AppState> ready() async {
    final s = auditState();
    await s.boot();
    return s;
  }

  testWidgets('rasm qirqilmaydi — contain, orqa fon cover', (t) async {
    final s = await ready();
    await pumpScreen(t, const ReelsScreen(), state: s);
    await t.pumpAndSettle();

    final images = t.widgetList<NetImage>(find.byType(NetImage)).toList();
    expect(images, isNotEmpty, reason: 'kadrda rasm bo‘lishi kerak');

    // Kamida bittasi `contain` — bu asosiy rasm.
    expect(
      images.any((i) => i.fit == BoxFit.contain),
      isTrue,
      reason: 'asosiy rasm butunligicha ko‘rinishi kerak (contain)',
    );
    // Kamida bittasi `cover` — bu orqa fon (bo'shliqni to'ldiradi).
    expect(
      images.any((i) => i.fit == BoxFit.cover),
      isTrue,
      reason: 'orqa fon bo‘shliqni to‘ldirishi kerak (cover)',
    );
  });

  testWidgets('qaytish tugmasi bor', (t) async {
    final s = await ready();
    await pumpScreen(t, const ReelsScreen(), state: s);
    await t.pumpAndSettle();

    final back = find.byWidgetPredicate(
      (w) => w is NIcon && w.icon == Ico.chevronLeft,
    );
    expect(back, findsOneWidget);
  });
}
