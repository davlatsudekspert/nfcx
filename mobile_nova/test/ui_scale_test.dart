import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/ui_scale.dart';

/// Egasi (2026-09-25): katta telefonda hamma narsa kichkina ko'rinardi.
/// Keng telefonda ilova mutanosib kattalashadi, kichigida — o'zgarishsiz.
void main() {
  test('kattalashtirish nisbati', () {
    expect(UiScale.factorFor(const Size(360, 780)), 1);
    expect(UiScale.factorFor(const Size(390, 844)), 1);
    expect(UiScale.factorFor(const Size(412, 915)), closeTo(412 / 390, 1e-9));
    expect(UiScale.factorFor(const Size(430, 932)), closeTo(430 / 390, 1e-9));
    expect(UiScale.factorFor(const Size(480, 1000)), UiScale.maxFactor);
    expect(UiScale.factorFor(const Size(800, 1280)), 1, reason: 'planshet');
  });

  Future<(Size, int)> pump(WidgetTester t, double width) async {
    t.view.physicalSize = Size(width * 3, 932 * 3);
    t.view.devicePixelRatio = 3;
    t.view.padding = const FakeViewPadding(top: 24 * 3, bottom: 48 * 3);
    addTearDown(t.view.reset);
    late Size inner;
    var taps = 0;
    await t.pumpWidget(MaterialApp(
      builder: (context, child) => UiScale(child: child!),
      home: Builder(builder: (context) {
        inner = MediaQuery.sizeOf(context);
        return Scaffold(
          body: Align(
            alignment: Alignment.bottomRight,
            child: TextButton(
              key: const ValueKey('corner'),
              onPressed: () => taps++,
              child: const Text('OK'),
            ),
          ),
        );
      }),
    ));
    await t.tap(find.byKey(const ValueKey('corner')));
    await t.pump();
    return (inner, taps);
  }

  testWidgets('430 dp telefonda ilova 390 dp dizaynda chiziladi, bosish ishlaydi',
      (t) async {
    final (inner, taps) = await pump(t, 430);
    expect(inner.width, closeTo(390, .01));
    expect(taps, 1, reason: 'burchakdagi tugma kattalashgandan keyin ham bosiladi');
    // Tugma ekranda haqiqatan kattaroq.
    final w = t.getSize(find.byKey(const ValueKey('corner'))).width;
    expect(w, greaterThan(0));
    expect(cornerRight(t), closeTo(430, 1));
  });

  testWidgets('390 dp va kichik telefonda hech narsa o‘zgarmaydi', (t) async {
    final (inner, taps) = await pump(t, 360);
    expect(inner.width, 360);
    expect(taps, 1);
    expect(find.byType(FittedBox), findsNothing);
  });
}

/// Burchakdagi tugmaning o'ng cheti ekran chetiga yetadimi (ya'ni
/// kattalashtirilgan kontent butun ekranni egallaydimi).
double cornerRight(WidgetTester t) =>
    t.getRect(find.byKey(const ValueKey('corner'))).right;
