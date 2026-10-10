import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/showcase/showcase_fullscreen.dart';

void main() {
  test('bosilmagan embed yo\'naltirishi odamniki emas', () {
    final c = EmbedTapClock();
    expect(c.recent, isFalse);
    c.touched();
    expect(c.recent, isTrue);
  });

  testWidgets('wrap tegilganini yozadi, bosishni ushlamaydi', (t) async {
    final c = EmbedTapClock();
    var tapped = 0;
    await t.pumpWidget(
      MaterialApp(
        home: c.wrap(
          GestureDetector(
            onTap: () => tapped++,
            child: const ColoredBox(
              color: Colors.black,
              child: SizedBox.expand(),
            ),
          ),
        ),
      ),
    );
    expect(c.recent, isFalse);
    await t.tap(find.byType(GestureDetector));
    expect(c.recent, isTrue);
    expect(tapped, 1);
  });
}
