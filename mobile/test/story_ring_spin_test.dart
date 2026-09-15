import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/story_ring.dart';
import 'package:nfcstore/design/components/sweep.dart';
import 'package:nfcstore/design/tokens.dart';

/// ISTORYA HALQASI AYLANADIMI.
///
/// NIMA UCHUN BU TEST BOR: qurilmada halqa KO'RINARDI, lekin QOTIB
/// turardi. Kodni o'qib buni sezish deyarli imkonsiz —
/// `AnimationController` yaratilgan, `repeat()` chaqirilgan,
/// hammasi to'g'ri ko'rinadi.
///
/// Sabab ANIMATSIYA XULQIDA edi: Android'da "Animator duration
/// scale" o'chirilgan yoki batareya tejash yoqilgan bo'lsa, tizim
/// ilovaga "animatsiyalarni o'chir" deb aytadi.
///
/// QAROR IKKI MARTA O'ZGARDI — OXIRGISI SHU.
///
/// Avval halqa tizim sozlamasidan qat'i nazar aylanardi. Keyin
/// "harakatni kamaytirish" rejimida qotadigan qilindi. Egasining
/// qarori (2026-09) esa: halqa BRENDNING IMZOSI va u har doim
/// aylanishi kerak — maketdagi `shimmerSpin 9s linear infinite`.
/// Qurilmada halqa qotib turgani aynan shu sababdan edi.
///
/// ISTISNO FAQAT HALQADA. Yorug'lik chizig'i, NFC to'lqini va
/// skeleton tizim sozlamasini avvalgidek hurmat qiladi — quyidagi
/// test shuni qo'riqlaydi, ya'ni istisno kengayib ketmaydi.
void main() {
  /// Halqaning joriy burilishi. `RotationTransition` ni topamiz va
  /// uni boshqarayotgan animatsiyaning qiymatini o'qiymiz.
  double turns(WidgetTester tester) {
    final t = tester.widget<RotationTransition>(find.byType(RotationTransition));
    return t.turns.value;
  }

  Widget wrap(Widget child) => Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: child),
      );

  testWidgets('ko‘rilmagan istoryada halqa aylanadi', (tester) async {
    await tester.pumpWidget(wrap(
      const StoryRing(name: 'Test', size: 72, showLabel: false),
    ));

    final start = turns(tester);
    // To'liq aylanish 9 soniya, ya'ni 3 soniyada burilish sezilarli
    // o'zgarishi kerak.
    await tester.pump(const Duration(seconds: 3));
    final later = turns(tester);

    expect(later, isNot(start), reason: 'Halqa umuman burilmadi');
    expect((later - start).abs(), greaterThan(0.2),
        reason: 'Burilish juda sekin: 9 soniyada bir aylanish kutilgan');

    // Testni tugatish uchun cheksiz animatsiyani to'xtatamiz.
    await tester.pumpWidget(wrap(const SizedBox()));
  });

  testWidgets('TIZIMDA ANIMATSIYA O‘CHIRILGAN BO‘LSA HAM halqa aylanadi',
      (tester) async {
    // Aynan shu holat qurilmada uchragan: Android sozlamalarida
    // "Animator duration scale" o'chirilgan yoki batareya tejash
    // yoqilgan bo'lsa, tizim ilovaga "animatsiyalarni o'chir" deydi
    // va halqa qotib qolardi.
    tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(
      tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
    );

    await tester.pumpWidget(wrap(
      const StoryRing(name: 'Test', size: 72, showLabel: false),
    ));

    final start = turns(tester);
    await tester.pump(const Duration(seconds: 3));
    final later = turns(tester);

    expect(later, isNot(start),
        reason: 'Halqa tizim sozlamasidan qat’i nazar aylanishi kerak');

    await tester.pumpWidget(wrap(const SizedBox()));
  });

  testWidgets('ISTISNO KENGAYMAYDI — yorug‘lik chizig‘i tizimni hurmat qiladi',
      (tester) async {
    // Halqa uchun qilingan istisno butun ilovaga tarqalib ketmasligi
    // kerak. Sweep kattaroq yuzada, uzluksiz harakatlanadi — aynan u
    // harakatga sezgir odamni charchatadi.
    tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(
      tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
    );

    await tester.pumpWidget(wrap(
      const SizedBox(
        width: 200,
        height: 120,
        child: LightSweep(child: SizedBox.expand()),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 100));

    // O'chirilgan sweep bolasini O'ZGARTIRMASDAN qaytaradi — ya'ni
    // uni chizadigan `AnimatedBuilder` umuman qurilmaydi.
    expect(find.byType(AnimatedBuilder), findsNothing,
        reason: 'Harakat kamaytirilganda sweep ishlamasligi kerak');
  });

  testWidgets('ko‘rilgan istoryada halqa aylanmaydi', (tester) async {
    // Ko'rilgan istoryada aylanish ATAYLAB yo'q: ekranda o'nlab
    // halqa bo'lsa, hammasi aylanib batareyani ham, e'tiborni ham
    // behuda sarflardi.
    await tester.pumpWidget(wrap(
      const StoryRing(name: 'Test', size: 72, showLabel: false, seen: true),
    ));
    expect(find.byType(RotationTransition), findsNothing);
  });

  test('aylanish davri dizayn manbasidagidek — 9 soniya', () {
    // Manba: `shimmerSpin 9s linear infinite`.
    expect(M.ring, const Duration(seconds: 9));
  });
}
