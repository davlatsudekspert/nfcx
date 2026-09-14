import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/story_ring.dart';
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
/// ilovaga "animatsiyalarni o'chir" deb aytadi va Flutter buni
/// hurmat qiladi. Halqa esa bezak emas — u "bu profilda yangi
/// istorya bor" degan MA'NONI tashiydi, shuning uchun
/// `AnimationBehavior.preserve` bilan saqlanishi kerak.
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

  testWidgets('TIZIMDA ANIMATSIYA O‘CHIRILGAN BO‘LSA HAM aylanadi',
      (tester) async {
    // Qurilmadagi holatning aynan o'zi: foydalanuvchi Android
    // sozlamalarida animatsiyalarni o'chirgan yoki batareya tejash
    // rejimini yoqqan.
    tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue);

    await tester.pumpWidget(wrap(
      const StoryRing(name: 'Test', size: 72, showLabel: false),
    ));

    final start = turns(tester);
    await tester.pump(const Duration(seconds: 3));
    final later = turns(tester);

    expect((later - start).abs(), greaterThan(0.2),
        reason: 'Tizim animatsiyalarni o‘chirganda halqa qotib qoldi — '
            'AnimationBehavior.preserve kerak');

    await tester.pumpWidget(wrap(const SizedBox()));
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
    expect(M.storyRing, const Duration(seconds: 9));
  });
}
